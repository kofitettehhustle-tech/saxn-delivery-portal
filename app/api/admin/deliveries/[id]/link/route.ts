import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders } from "@/lib/http";
import { issueDeliveryLink } from "@/lib/links";
import { createDeliveryShareUrl } from "@/lib/shortio";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    assertSameOriginMutation(request);
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
    const link = await issueDeliveryLink(params.id);
    const shareLink = await createDeliveryShareUrl(link.token, request.url);
    return NextResponse.json({ ...link, ...shareLink }, { headers: noStoreHeaders() });
  }
  catch (error) { return jsonError(error); }
}
