import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { bucketName, removePrivateObjects } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin(); const db = createSupabaseServiceClient();
    const [{ data: files, error: fileError }, { data: deliveries, error: deliveryError }, { data: settings }] = await Promise.all([
      db.from("delivery_files").select("file_size,category,created_at"),
      db.from("deliveries").select("id,track_title,status,expires_at,updated_at,zip_size,zip_storage_path,preview_size,preview_storage_path,created_at"),
      db.from("storage_settings").select("retention_days,max_file_bytes,max_delivery_bytes,approved_extra_extensions,updated_at").limit(1).maybeSingle(),
    ]);
    if (fileError || deliveryError) throw new ApiError(503, "Could not load storage usage.", "STORAGE_USAGE_FAILED");
    const originalBytes = (files ?? []).reduce((sum, row) => sum + Number(row.file_size || 0), 0);
    const archiveBytes = (deliveries ?? []).reduce((sum, row) => sum + Number(row.zip_size || 0), 0);
    const previewBytes = (deliveries ?? []).reduce((sum, row) => sum + Number(row.preview_size || 0), 0);
    const expired = (deliveries ?? []).filter((row) => row.status === "EXPIRED" || Boolean(row.expires_at && Date.parse(row.expires_at) <= Date.now())).length;
    return NextResponse.json({ usage: { originalBytes, archiveBytes, previewBytes, totalBytes: originalBytes + archiveBytes + previewBytes, fileCount: (files ?? []).length, deliveryCount: (deliveries ?? []).length, expiredCount: expired }, settings: settings ?? { retention_days: 365, max_file_bytes: 2147483648, max_delivery_bytes: 10737418240, approved_extra_extensions: [] }, largestDeliveries: (deliveries ?? []).sort((a, b) => Number(b.zip_size ?? 0) - Number(a.zip_size ?? 0)).slice(0, 8).map(({ id, track_title, zip_size, status }) => ({ id, track_title, zip_size, status })) }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}

const baseMimes = ["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3", "audio/flac", "audio/x-flac", "audio/aiff", "audio/x-aiff", "application/pdf", "application/octet-stream"];
const extraMimeByExtension: Record<string, string> = { mid: "audio/midi", midi: "audio/midi", m4a: "audio/mp4", ogg: "audio/ogg", opus: "audio/ogg", txt: "text/plain", csv: "text/csv", zip: "application/zip", aifc: "audio/aiff" };
export async function PUT(request: Request) {
  try {
    await requireAdmin(); assertSameOriginMutation(request);
    const body = await readJson<{ retentionDays: number; maxFileBytes: number; maxDeliveryBytes: number; approvedExtraExtensions?: string[] }>(request);
    if (![30, 90, 180, 365, 730, 0].includes(body.retentionDays) || !Number.isSafeInteger(body.maxFileBytes) || body.maxFileBytes < 1024 * 1024 || !Number.isSafeInteger(body.maxDeliveryBytes) || body.maxDeliveryBytes < body.maxFileBytes) throw new ApiError(400, "Storage limits or retention policy are invalid.", "VALIDATION_FAILED");
    if (body.maxFileBytes > 20 * 1024 ** 3 || body.maxDeliveryBytes > 100 * 1024 ** 3) throw new ApiError(400, "Storage limits exceed the supported portal maximum.", "LIMIT_TOO_LARGE");
    const extensions = [...new Set((body.approvedExtraExtensions ?? []).map((ext) => ext.toLowerCase().replace(/^\./, "")).filter((ext) => /^[a-z0-9]{1,10}$/.test(ext)))].slice(0, 30);
    const allowedMimes = [...new Set([...baseMimes, ...extensions.map((ext) => extraMimeByExtension[ext] ?? "application/octet-stream")])];
    const db = createSupabaseServiceClient();
    const [originals, archives] = await Promise.all([
      db.storage.updateBucket(bucketName("originals"), { public: false, fileSizeLimit: body.maxFileBytes, allowedMimeTypes: allowedMimes }),
      db.storage.updateBucket(bucketName("archives"), { public: false, fileSizeLimit: body.maxDeliveryBytes, allowedMimeTypes: ["application/zip", "application/x-zip-compressed"] }),
    ]);
    if (originals.error || archives.error) throw new ApiError(503, "Could not update private bucket limits. Check bucket configuration and retry; database policy was not changed.", "BUCKET_POLICY_FAILED");
    const { data: existing } = await db.from("storage_settings").select("id").limit(1).maybeSingle();
    const values = { retention_days: body.retentionDays, max_file_bytes: body.maxFileBytes, max_delivery_bytes: body.maxDeliveryBytes, approved_extra_extensions: extensions, updated_at: new Date().toISOString() };
    const result = existing ? await db.from("storage_settings").update(values).eq("id", existing.id) : await db.from("storage_settings").insert(values);
    if (result.error) throw new ApiError(503, "Bucket limits changed but storage policy could not be saved; review the policy and retry.", "STORAGE_POLICY_FAILED");
    return NextResponse.json({ saved: true }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(); assertSameOriginMutation(request);
    const body = await readJson<{ confirm?: string }>(request); if (body.confirm !== "CLEAN EXPIRED STORAGE") throw new ApiError(400, "Explicit cleanup confirmation is required.", "CONFIRMATION_REQUIRED");
    const db = createSupabaseServiceClient(); const { data: settings } = await db.from("storage_settings").select("retention_days").limit(1).maybeSingle();
    const retentionDays = Number(settings?.retention_days ?? 365); if (retentionDays === 0) throw new ApiError(409, "Automatic retention cleanup is disabled by policy.", "RETENTION_DISABLED");
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const [{ data: expired, error: expiredError }, { data: revoked, error: revokedError }] = await Promise.all([
      db.from("deliveries").select("id,status,zip_storage_path,preview_storage_path").lt("expires_at", cutoff).neq("status", "REVOKED").limit(200),
      db.from("deliveries").select("id,status,zip_storage_path,preview_storage_path").eq("status", "REVOKED").lt("updated_at", cutoff).limit(200),
    ]);
    if (expiredError || revokedError) throw new ApiError(503, "Could not load cleanup candidates.", "CLEANUP_QUERY_FAILED");
    const candidates = Array.from(new Map([...(expired ?? []), ...(revoked ?? [])].map((item) => [item.id, item])).values());
    let cleaned = 0;
    for (const delivery of candidates) {
      const { data: active } = await db.from("processing_jobs").select("id").eq("delivery_id", delivery.id).in("status", ["queued", "processing"]).maybeSingle(); if (active) continue;
      const { data: files, error: filesError } = await db.from("delivery_files").select("storage_path").eq("delivery_id", delivery.id); if (filesError) throw new ApiError(503, "Could not inspect original files for cleanup.", "CLEANUP_QUERY_FAILED");
      if (files?.length) await removePrivateObjects("originals", files.map((file) => file.storage_path));
      if (delivery.zip_storage_path) await removePrivateObjects("archives", [delivery.zip_storage_path]);
      if (delivery.preview_storage_path) await removePrivateObjects("previews", [delivery.preview_storage_path]);
      const { error: fileError } = await db.from("delivery_files").delete().eq("delivery_id", delivery.id); if (fileError) throw new ApiError(503, "Objects were removed but file records could not be cleared; stop cleanup and review the delivery.", "CLEANUP_RECORD_FAILED");
      const { error: updateError } = await db.from("deliveries").update({ status: delivery.status === "REVOKED" ? "REVOKED" : "EXPIRED", zip_storage_path: null, zip_size: null, preview_storage_path: null, preview_size: null, preview_mime_type: null, updated_at: new Date().toISOString() }).eq("id", delivery.id);
      if (updateError) throw new ApiError(503, "Objects were removed but delivery metadata could not be updated.", "CLEANUP_RECORD_FAILED"); cleaned += 1;
    }
    return NextResponse.json({ cleaned }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
