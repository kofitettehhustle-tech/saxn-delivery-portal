import { NextResponse } from "next/server";
import { resolvePublicDelivery, recordDeliveryEvent } from "@/lib/publicDelivery";
import { enforcePublicRateLimit } from "@/lib/rateLimit";
import { ApiError, jsonError, noStoreHeaders } from "@/lib/http";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createPrivateSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    await enforcePublicRateLimit(request, `delivery-preview:${params.token.slice(0, 16)}`);
    const resolved = await resolvePublicDelivery(params.token);
    if (resolved.requiresPassword && !resolved.passwordVerified) throw new ApiError(401, "Enter the delivery password before listening.", "PASSWORD_REQUIRED");
    if (!resolved.delivery.preview_enabled || !resolved.delivery.preview_file_id) throw new ApiError(404, "Audio preview is not enabled for this delivery.", "PREVIEW_DISABLED");
    const { data: file, error } = await createSupabaseServiceClient().from("delivery_files").select("storage_path,filename,mime_type").eq("id", resolved.delivery.preview_file_id).eq("delivery_id", resolved.delivery.id).maybeSingle();
    if (error || !file) throw new ApiError(404, "Preview audio was not found.", "PREVIEW_NOT_FOUND");
    const generatedPath = resolved.delivery.preview_storage_path as string | null;
    const generatedMime = resolved.delivery.preview_mime_type as string | null;
    const mimeType = generatedPath ? generatedMime : file.mime_type;
    if (!mimeType || !/^audio\/(wav|x-wav|wave|mpeg|mp3)$/i.test(mimeType)) throw new ApiError(415, "This preview format is not supported in the browser.", "PREVIEW_FORMAT_UNSUPPORTED");
    const signedUrl = await createPrivateSignedUrl(generatedPath ? "previews" : "originals", generatedPath ?? file.storage_path, 120);
    await recordDeliveryEvent(resolved.delivery.id, "preview_requested");
    const filename = generatedPath ? `${file.filename.replace(/\.[^.]+$/, "")}.mp3` : file.filename;
    return NextResponse.json({ signedUrl, filename, mimeType }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
