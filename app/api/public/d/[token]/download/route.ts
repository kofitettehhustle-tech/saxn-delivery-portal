import { NextResponse } from "next/server";
import { resolvePublicDelivery, recordDeliveryEvent } from "@/lib/publicDelivery";
import { enforcePublicRateLimit } from "@/lib/rateLimit";
import { ApiError, jsonError, noStoreHeaders } from "@/lib/http";
import { createPrivateSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    await enforcePublicRateLimit(request, `delivery-download:${params.token.slice(0, 16)}`);
    const resolved = await resolvePublicDelivery(params.token);
    if (resolved.requiresPassword && !resolved.passwordVerified) throw new ApiError(401, "Enter the delivery password before downloading.", "PASSWORD_REQUIRED");
    if (resolved.delivery.status !== "READY" || !resolved.delivery.zip_storage_path || !resolved.delivery.zip_filename) throw new ApiError(409, "The project archive is not ready yet.", "ARCHIVE_NOT_READY");
    const signedUrl = await createPrivateSignedUrl("archives", resolved.delivery.zip_storage_path, 120, resolved.delivery.zip_filename);
    await recordDeliveryEvent(resolved.delivery.id, "download_requested");
    return NextResponse.json({ signedUrl, filename: resolved.delivery.zip_filename }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
