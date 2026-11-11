import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "./http";
import { hashDeliveryToken, tokenLooksValid, verifyPasswordGateCookie } from "./security";
import { createSupabaseServiceClient } from "./supabase/service";

export async function resolvePublicDelivery(token: string) {
  if (!tokenLooksValid(token)) throw new ApiError(404, "This delivery link is not available.", "DELIVERY_NOT_FOUND");
  const db = createSupabaseServiceClient(); const tokenHash = hashDeliveryToken(token);
  const { data: tokenRow, error: tokenError } = await db.from("delivery_tokens").select("id,delivery_id,token_hash,password_hash,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (tokenError || !tokenRow) throw new ApiError(404, "This delivery link is not available.", "DELIVERY_NOT_FOUND");
  const { data: deliveryRow, error: deliveryError } = await db.from("deliveries").select("id,client_id,track_title,service_type,message,status,zip_storage_path,zip_filename,zip_size,preview_enabled,preview_file_id,preview_storage_path,preview_mime_type,preview_size,password_hash,expires_at,revoked_at,created_at,reference_number").eq("id", tokenRow.delivery_id).maybeSingle();
  if (deliveryError || !deliveryRow) throw new ApiError(404, "This delivery link is not available.", "DELIVERY_NOT_FOUND");
  const [clientResult, filesResult] = await Promise.all([
    db.from("clients").select("name").eq("id", deliveryRow.client_id).maybeSingle(),
    db.from("delivery_files").select("id,filename,category,file_size,mime_type,storage_path,created_at").eq("delivery_id", deliveryRow.id).order("created_at", { ascending: true }),
  ]);
  if (clientResult.error || filesResult.error) throw new ApiError(503, "Delivery details are temporarily unavailable.", "DELIVERY_READ_FAILED");
  const delivery = { ...deliveryRow, clients: clientResult.data, delivery_files: filesResult.data ?? [] };
  const expiration = tokenRow.expires_at ?? delivery.expires_at;
  if (tokenRow.revoked_at || delivery.revoked_at || delivery.status === "REVOKED") throw new ApiError(410, "This delivery link has been revoked.", "DELIVERY_REVOKED");
  if ((expiration && Date.parse(expiration) <= Date.now()) || delivery.status === "EXPIRED") {
    if (delivery.status !== "EXPIRED") await db.from("deliveries").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).eq("id", delivery.id).neq("status", "REVOKED");
    throw new ApiError(410, "This delivery link has expired.", "DELIVERY_EXPIRED");
  }
  const requiresPassword = Boolean(tokenRow.password_hash || delivery.password_hash);
  const cookieName = `saxn_delivery_${tokenHash.slice(0, 20)}`;
  const accessCookie = cookies().get(cookieName)?.value;
  const passwordVerified = !requiresPassword || verifyPasswordGateCookie(tokenHash, accessCookie);
  return { tokenHash, tokenRow, delivery, requiresPassword, passwordVerified, cookieName };
}

export async function recordDeliveryEvent(deliveryId: string, eventType: "page_view" | "password_failed" | "download_requested" | "preview_requested") {
  const { error } = await createSupabaseServiceClient().from("download_events").insert({ delivery_id: deliveryId, event_type: eventType });
  if (error) throw new ApiError(503, "Could not record the delivery event.", "EVENT_WRITE_FAILED");
}

export function sanitizePublicDelivery(resolved: Awaited<ReturnType<typeof resolvePublicDelivery>>) {
  const { delivery } = resolved; const preview = delivery.preview_file_id ? delivery.delivery_files.find((file) => file.id === delivery.preview_file_id) : null;
  const previewFileName = delivery.preview_storage_path ? `${(preview?.filename ?? "Preview").replace(/\.[^.]+$/, "")}.mp3` : (preview?.filename ?? null);
  return {
    clientName: delivery.clients?.name ?? "Client", trackTitle: delivery.track_title, serviceType: delivery.service_type, message: delivery.message,
    status: delivery.status, zipFilename: delivery.zip_filename, zipSize: delivery.zip_size, previewEnabled: delivery.preview_enabled,
    previewFileName, previewMimeType: delivery.preview_mime_type ?? preview?.mime_type ?? null,
    previewFiles: (delivery.delivery_files ?? []).map((file) => ({ filename: file.filename, mimeType: file.mime_type, category: file.category })),
    deliveryDate: delivery.created_at, referenceNumber: delivery.reference_number,
    expiresAt: resolved.tokenRow.expires_at ?? delivery.expires_at, requiresPassword: resolved.requiresPassword, passwordVerified: resolved.passwordVerified,
  };
}
