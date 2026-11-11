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
    if (resolved.delivery.status !== "READY") throw new ApiError(409, "The project archives are not ready yet.", "ARCHIVE_NOT_READY");
    const archiveId = new URL(request.url).searchParams.get("archiveId");
    const archive = archiveId
      ? resolved.delivery.delivery_archives.find((item) => item.id === archiveId)
      : resolved.delivery.delivery_archives[0];
    if (archiveId && !archive) throw new ApiError(404, "This download is not available.", "ARCHIVE_NOT_FOUND");
    const storagePath = archive?.storage_path ?? resolved.delivery.zip_storage_path;
    const filename = archive?.filename ?? resolved.delivery.zip_filename;
    if (!storagePath || !filename) throw new ApiError(409, "The project archives are not ready yet.", "ARCHIVE_NOT_READY");
    const signedUrl = await createPrivateSignedUrl("archives", storagePath, 120, filename);
    await recordDeliveryEvent(resolved.delivery.id, "download_requested");
    return NextResponse.json({ signedUrl, filename }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
