import "server-only";
import { ApiError } from "./http";
import { hashDeliveryToken, newDeliveryToken } from "./security";
import { createSupabaseServiceClient } from "./supabase/service";

export async function issueDeliveryLink(deliveryId: string) {
  const db = createSupabaseServiceClient();
  const { data: delivery, error: readError } = await db.from("deliveries").select("id,status,expires_at,revoked_at,password_hash").eq("id", deliveryId).maybeSingle();
  if (readError || !delivery) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
  if (delivery.revoked_at || delivery.status === "REVOKED") throw new ApiError(409, "A revoked delivery cannot receive a new link.", "DELIVERY_REVOKED");
  const token = newDeliveryToken(); const now = new Date().toISOString();
  const { error: rotateError } = await db.from("delivery_tokens").update({ revoked_at: now }).eq("delivery_id", deliveryId).is("revoked_at", null);
  if (rotateError) throw new ApiError(503, "Could not rotate previous delivery access.", "LINK_ROTATION_FAILED");
  const { error } = await db.from("delivery_tokens").insert({ delivery_id: deliveryId, token_hash: hashDeliveryToken(token), password_hash: delivery.password_hash, expires_at: delivery.expires_at, created_at: now });
  if (error) throw new ApiError(503, "Could not create a private delivery link.", "LINK_CREATE_FAILED");
  return { token, expiresAt: delivery.expires_at as string | null };
}

export async function setDeliveryExpiration(deliveryId: string, expiration: "7" | "14" | "30" | "90" | "custom" | "never", customExpiresAt?: string | null) {
  let expiresAt: string | null = null;
  if (expiration === "custom") { const custom = customExpiresAt ? Date.parse(customExpiresAt) : NaN; if (!Number.isFinite(custom) || custom <= Date.now()) throw new ApiError(400, "Choose a future expiration date.", "INVALID_EXPIRATION"); expiresAt = new Date(custom).toISOString(); }
  else if (expiration !== "never") { const days = Number(expiration); if (![7, 14, 30, 90].includes(days)) throw new ApiError(400, "Choose a supported expiration period.", "INVALID_EXPIRATION"); expiresAt = new Date(Date.now() + days * 86_400_000).toISOString(); }
  const db = createSupabaseServiceClient();
  const { data: delivery, error: readError } = await db.from("deliveries").select("id,revoked_at,status,zip_storage_path").eq("id", deliveryId).maybeSingle();
  if (readError || !delivery) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
  if (delivery.revoked_at || delivery.status === "REVOKED") throw new ApiError(409, "A revoked delivery cannot be extended.", "DELIVERY_REVOKED");
  const restoredStatus = delivery.status === "EXPIRED" && (!expiresAt || Date.parse(expiresAt) > Date.now()) ? (delivery.zip_storage_path ? "READY" : "FAILED") : delivery.status;
  const { error } = await db.from("deliveries").update({ expires_at: expiresAt, status: restoredStatus, updated_at: new Date().toISOString() }).eq("id", deliveryId);
  if (error) throw new ApiError(503, "Could not extend delivery access.", "EXPIRATION_UPDATE_FAILED");
  const { error: tokenError } = await db.from("delivery_tokens").update({ expires_at: expiresAt }).eq("delivery_id", deliveryId).is("revoked_at", null);
  if (tokenError) throw new ApiError(503, "Delivery expiry changed, but existing link metadata did not update. Rotate the link before sharing it.", "TOKEN_EXPIRATION_UPDATE_FAILED");
  return expiresAt;
}
