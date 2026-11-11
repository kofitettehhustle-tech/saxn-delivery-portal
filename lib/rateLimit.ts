import "server-only";
import { hashRateLimitKey } from "./security";
import { createSupabaseServiceClient } from "./supabase/service";
import { ApiError } from "./http";

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function enforcePublicRateLimit(request: Request, scope: string) {
  const limit = Number(process.env.PUBLIC_RATE_LIMIT_PER_MINUTE ?? 30);
  const keyHash = hashRateLimitKey(scope, clientAddress(request));
  const { data, error } = await createSupabaseServiceClient().rpc("consume_public_rate_limit", { p_key_hash: keyHash, p_limit: limit, p_window_seconds: 60 });
  if (error) throw new ApiError(503, "Public request protection is temporarily unavailable.", "RATE_LIMIT_UNAVAILABLE");
  if (data !== true) throw new ApiError(429, "Too many requests. Wait a moment and try again.", "RATE_LIMITED");
}
