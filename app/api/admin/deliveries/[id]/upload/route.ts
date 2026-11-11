import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders } from "@/lib/http";
import { authorizeUploadSlots } from "@/lib/uploads";
import { confirmDeliveryUploads } from "@/lib/adminService";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
function validId(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id); }
export async function GET(_request: Request, { params }: Context) {
  try { await requireAdmin(); if (!validId(params.id)) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND"); return NextResponse.json({ files: await authorizeUploadSlots(params.id) }, { headers: noStoreHeaders() }); }
  catch (error) { return jsonError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { await requireAdmin(); assertSameOriginMutation(request); if (!validId(params.id)) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND"); const fileCount = await confirmDeliveryUploads(params.id); return NextResponse.json({ verified: true, fileCount }, { headers: noStoreHeaders() }); }
  catch (error) { return jsonError(error); }
}
