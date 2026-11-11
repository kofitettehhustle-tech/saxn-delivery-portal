import "server-only";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { ApiError } from "./http";
import { allowedMime, createDeliverySchema, safeFilename } from "./validation";
import { createSupabaseServiceClient } from "./supabase/service";
import { bucketName, removePrivateObjects } from "./storage";
import { issueDeliveryLink } from "./links";
import type { DeliveryRecord } from "@/types/portal";

const fallbackMaxFile = Number(process.env.MAX_UPLOAD_BYTES ?? 2 * 1024 ** 3);
const fallbackMaxDelivery = Number(process.env.MAX_DELIVERY_BYTES ?? 10 * 1024 ** 3);

function expirationFor(value: string, custom?: string | null): string | null {
  if (value === "never") return null;
  if (value === "custom") {
    const timestamp = custom ? Date.parse(custom) : NaN;
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new ApiError(400, "Choose a future expiration date.", "INVALID_EXPIRATION");
    return new Date(timestamp).toISOString();
  }
  const days = Number(value);
  if (![7, 14, 30, 90].includes(days)) throw new ApiError(400, "Choose a supported expiration period.", "INVALID_EXPIRATION");
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function uniqueFilename(name: string, category: string, used: Set<string>) {
  const safe = safeFilename(name);
  const dot = safe.lastIndexOf("."); const stem = dot > 0 ? safe.slice(0, dot) : safe; const extension = dot > 0 ? safe.slice(dot) : "";
  let candidate = safe; let index = 2;
  while (used.has(`${category}:${candidate.toLocaleLowerCase()}`)) { candidate = `${stem} (${index})${extension}`; index += 1; }
  used.add(`${category}:${candidate.toLocaleLowerCase()}`); return candidate;
}

export async function createDelivery(input: unknown) {
  const parsed = createDeliverySchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Delivery details are invalid.", "VALIDATION_FAILED");
  const values = parsed.data;
  const db = createSupabaseServiceClient();
  const { data: settings } = await db.from("storage_settings").select("max_file_bytes,max_delivery_bytes,approved_extra_extensions").limit(1).maybeSingle();
  const maxFile = Number(settings?.max_file_bytes ?? fallbackMaxFile);
  const maxDelivery = Number(settings?.max_delivery_bytes ?? fallbackMaxDelivery);
  const extras = Array.isArray(settings?.approved_extra_extensions) ? settings.approved_extra_extensions as string[] : [];
  const sum = values.files.reduce((total, file) => total + file.fileSize, 0);
  if (!Number.isSafeInteger(sum) || sum > maxDelivery) throw new ApiError(413, "The files exceed this delivery's configured storage limit.", "DELIVERY_TOO_LARGE");
  for (const file of values.files) {
    if (file.fileSize > maxFile) throw new ApiError(413, `${file.originalFilename} exceeds the per-file size limit.`, "FILE_TOO_LARGE");
    if (!allowedMime(file.originalFilename, file.mimeType, extras)) throw new ApiError(415, `${file.originalFilename} is not an approved delivery format.`, "FILE_TYPE_NOT_ALLOWED");
    if (safeFilename(file.filename).includes("..")) throw new ApiError(400, "Delivery filenames cannot contain path segments.", "UNSAFE_FILENAME");
  }

  let clientId = values.clientId ?? null; let createdClientId: string | null = null;
  if (clientId) {
    const { data: client, error } = await db.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (error || !client) throw new ApiError(404, "Selected client was not found.", "CLIENT_NOT_FOUND");
  } else if (values.client) {
    const { data: client, error } = await db.from("clients").insert({ name: values.client.name, email: values.client.email || null }).select("id").single();
    if (error || !client) throw new ApiError(503, "Could not create the client record.", "CLIENT_CREATE_FAILED");
    clientId = client.id; createdClientId = client.id;
  }
  if (!clientId) throw new ApiError(400, "Choose a client.", "CLIENT_REQUIRED");

  const expiresAt = expirationFor(values.expiration, values.customExpiresAt);
  const passwordHash = values.password ? await bcrypt.hash(values.password, 12) : null;
  const referenceNumber = `SX-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const { data: delivery, error: deliveryError } = await db.from("deliveries").insert({
    client_id: clientId, track_title: values.trackTitle, service_type: values.serviceType, message: values.message,
    status: "UPLOADING", preview_enabled: values.previewEnabled, expires_at: expiresAt, password_hash: passwordHash, reference_number: referenceNumber,
  }).select("id").single();
  if (deliveryError || !delivery) { if (createdClientId) await db.from("clients").delete().eq("id", createdClientId); throw new ApiError(503, "Could not create the delivery record.", "DELIVERY_CREATE_FAILED"); }

  const usedNames = new Set<string>();
  const files = values.files.map((file) => {
    const filename = uniqueFilename(file.filename, file.category, usedNames);
    return { delivery_id: delivery.id, filename, original_filename: safeFilename(file.originalFilename), category: file.category, storage_path: `${delivery.id}/${randomUUID()}_${filename}`, file_size: file.fileSize, mime_type: file.mimeType };
  });
  const { data: inserted, error: filesError } = await db.from("delivery_files").insert(files).select("id,filename,original_filename,category,storage_path,file_size,mime_type");
  if (filesError || !inserted) {
    await db.from("deliveries").delete().eq("id", delivery.id);
    if (createdClientId) await db.from("clients").delete().eq("id", createdClientId);
    const categoryConstraintFailure = filesError?.code === "23514" &&
      (filesError.message.includes("delivery_files_category_check") || filesError.details?.includes("category"));
    if (categoryConstraintFailure) {
      throw new ApiError(503, "The database has not been updated for the new file categories. Apply migration 005_delivery_file_categories.sql in Supabase, then retry.", "FILE_CATEGORY_MIGRATION_REQUIRED");
    }
    throw new ApiError(503, "Could not register the delivery files.", "FILE_RECORD_CREATE_FAILED");
  }
  if (values.previewEnabled && values.previewFileIndex != null) {
    const preview = inserted[values.previewFileIndex];
    const { error } = await db.from("deliveries").update({ preview_file_id: preview.id }).eq("id", delivery.id);
    if (error) throw new ApiError(503, "Could not set the selected preview file.", "PREVIEW_SETUP_FAILED");
  }
  await db.from("clients").update({ updated_at: new Date().toISOString() }).eq("id", clientId);
  return { id: delivery.id, referenceNumber, files: inserted.map((file) => ({ id: file.id, filename: file.filename, category: file.category, fileSize: file.file_size, mimeType: file.mime_type, storagePath: file.storage_path })), storageBucket: bucketName("originals") };
}

export async function confirmDeliveryUploads(deliveryId: string) {
  const db = createSupabaseServiceClient();
  const { data: delivery, error: deliveryError } = await db.from("deliveries").select("id,status,revoked_at").eq("id", deliveryId).maybeSingle();
  if (deliveryError || !delivery) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
  if (delivery.revoked_at || delivery.status === "REVOKED") throw new ApiError(409, "This delivery has been revoked.", "DELIVERY_REVOKED");
  const { data: files, error: filesError } = await db.from("delivery_files").select("storage_path,file_size,mime_type").eq("delivery_id", deliveryId);
  if (filesError || !files?.length) throw new ApiError(400, "Add at least one file before packaging.", "FILES_REQUIRED");
  const { data: stored, error: storageError } = await db.storage.from(bucketName("originals")).list(deliveryId, { limit: 1000 });
  if (storageError) throw new ApiError(503, "Could not verify uploaded files.", "UPLOAD_VERIFY_FAILED");
  const storedMap = new Map((stored ?? []).map((item) => [`${deliveryId}/${item.name}`, item]));
  for (const file of files) {
    const object = storedMap.get(file.storage_path);
    if (!object) throw new ApiError(409, "One or more file uploads have not completed. Retry the failed uploads first.", "UPLOADS_INCOMPLETE");
    const metadata = object.metadata as { size?: number | string; mimetype?: string; contentType?: string } | null;
    const storedSize = Number(metadata?.size ?? 0);
    if (storedSize > 0 && storedSize !== Number(file.file_size)) throw new ApiError(409, "An uploaded file's size does not match its registered metadata.", "UPLOAD_SIZE_MISMATCH");
    const storedMime = String(metadata?.mimetype ?? metadata?.contentType ?? "").toLowerCase();
    if (storedMime && storedMime !== file.mime_type.toLowerCase()) throw new ApiError(409, "An uploaded file's content type does not match its registered metadata.", "UPLOAD_MIME_MISMATCH");
  }
  const { error } = await db.from("deliveries").update({ status: "DRAFT", updated_at: new Date().toISOString() }).eq("id", deliveryId);
  if (error) throw new ApiError(503, "Could not finalize upload state.", "UPLOAD_FINALIZE_FAILED");
  return files.length;
}

export async function requestPackaging(deliveryId: string) {
  const db = createSupabaseServiceClient();
  const { data: delivery, error } = await db.from("deliveries").select("id,status,revoked_at").eq("id", deliveryId).maybeSingle();
  if (error || !delivery) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
  if (delivery.revoked_at || delivery.status === "REVOKED") throw new ApiError(409, "This delivery has been revoked.", "DELIVERY_REVOKED");
  if (["READY", "FAILED", "PROCESSING"].includes(delivery.status)) throw new ApiError(409, "This delivery is already packaged or processing. Use the retry/regenerate action.", "JOB_ALREADY_ACTIVE");
  await confirmDeliveryUploads(deliveryId);
  const { error: jobError } = await db.from("processing_jobs").insert({ delivery_id: deliveryId, status: "queued", attempts: 0 });
  if (jobError) throw new ApiError(jobError.code === "23505" ? 409 : 503, jobError.code === "23505" ? "Packaging is already active." : "Could not queue the packaging job.", "JOB_CREATE_FAILED");
  const { error: updateError } = await db.from("deliveries").update({ status: "PROCESSING", updated_at: new Date().toISOString() }).eq("id", deliveryId);
  if (updateError) throw new ApiError(503, "Packaging was queued but delivery status did not update.", "DELIVERY_UPDATE_FAILED");
  const link = await issueDeliveryLink(deliveryId);
  return { queued: true, token: link.token, expiresAt: link.expiresAt };
}

export async function retryPackaging(deliveryId: string) {
  const db = createSupabaseServiceClient();
  const { data: delivery, error } = await db.from("deliveries").select("id,status,revoked_at").eq("id", deliveryId).maybeSingle();
  if (error || !delivery) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
  if (delivery.revoked_at || delivery.status === "REVOKED") throw new ApiError(409, "This delivery has been revoked.", "DELIVERY_REVOKED");
  if (!["FAILED", "READY"].includes(delivery.status)) throw new ApiError(409, "Only failed or ready deliveries can be retried or regenerated.", "RETRY_NOT_ALLOWED");
  await confirmDeliveryUploads(deliveryId);
  const { data: active } = await db.from("processing_jobs").select("id").eq("delivery_id", deliveryId).in("status", ["queued", "processing"]).maybeSingle();
  if (active) throw new ApiError(409, "Packaging is already active.", "JOB_ALREADY_ACTIVE");
  const { data: failed } = await db.from("processing_jobs").select("id").eq("delivery_id", deliveryId).eq("status", "failed").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (failed) {
    const { error: jobError } = await db.from("processing_jobs").update({ status: "queued", attempts: 0, error_message: null, locked_at: null, updated_at: new Date().toISOString() }).eq("id", failed.id);
    if (jobError) throw new ApiError(503, "Could not retry packaging.", "RETRY_FAILED");
  } else {
    const { error: jobError } = await db.from("processing_jobs").insert({ delivery_id: deliveryId, status: "queued", attempts: 0 });
    if (jobError) throw new ApiError(503, "Could not queue packaging retry.", "RETRY_FAILED");
  }
  const { error: updateError } = await db.from("deliveries").update({ status: "PROCESSING", updated_at: new Date().toISOString() }).eq("id", deliveryId);
  if (updateError) throw new ApiError(503, "Could not update delivery state.", "DELIVERY_UPDATE_FAILED");
  return { queued: true };
}

export async function safelyDeleteDelivery(deliveryId: string) {
  const db = createSupabaseServiceClient();
  const { data: delivery, error } = await db.from("deliveries").select("id,status,zip_storage_path,preview_storage_path").eq("id", deliveryId).maybeSingle();
  if (error || !delivery) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
  if (["PROCESSING", "UPLOADING"].includes(delivery.status)) throw new ApiError(409, "Finish or revoke this delivery before deleting it.", "DELIVERY_ACTIVE");
  const { data: activeJob } = await db.from("processing_jobs").select("id").eq("delivery_id", deliveryId).in("status", ["queued", "processing"]).maybeSingle();
  if (activeJob) throw new ApiError(409, "An active worker job still owns this delivery.", "DELIVERY_ACTIVE");
  const { data: files } = await db.from("delivery_files").select("storage_path").eq("delivery_id", deliveryId);
  const originals = (files ?? []).map((file) => file.storage_path);
  if (originals.length) await removePrivateObjects("originals", originals);
  if (delivery.zip_storage_path) await removePrivateObjects("archives", [delivery.zip_storage_path]);
  if (delivery.preview_storage_path) await removePrivateObjects("previews", [delivery.preview_storage_path]);
  const { error: deleteError } = await db.from("deliveries").delete().eq("id", deliveryId);
  if (deleteError) throw new ApiError(503, "Files were removed but the delivery record could not be deleted; contact the administrator before retrying.", "DELIVERY_DELETE_FAILED");
}

export function asDeliveryRecord(value: unknown) { return value as DeliveryRecord; }
