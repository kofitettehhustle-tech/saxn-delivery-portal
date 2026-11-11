import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { safelyDeleteDelivery } from "@/lib/adminService";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { serviceTypes } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
type DeliveryUpdate = { updated_at: string; track_title?: string; service_type?: string; message?: string | null };
function validId(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id); }
export async function GET(_request: Request, { params }: Context) {
  try {
    await requireAdmin(); if (!validId(params.id)) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
    const db = createSupabaseServiceClient();
    const { data: row, error } = await db.from("deliveries").select("id,client_id,track_title,service_type,message,status,zip_filename,zip_size,preview_enabled,preview_file_id,preview_mime_type,preview_size,expires_at,revoked_at,created_at,updated_at,reference_number").eq("id", params.id).maybeSingle();
    if (error || !row) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
    const [clientResult, filesResult, archivesResult, jobsResult, eventsResult] = await Promise.all([
      db.from("clients").select("id,name,email,created_at").eq("id", row.client_id).maybeSingle(),
      db.from("delivery_files").select("id,filename,original_filename,category,file_size,mime_type,created_at").eq("delivery_id", row.id),
      db.from("delivery_archives").select("id,filename,file_size").eq("delivery_id", row.id).order("created_at", { ascending: true }),
      db.from("processing_jobs").select("id,status,attempts,error_message,created_at,updated_at").eq("delivery_id", row.id).order("created_at", { ascending: false }),
      db.from("download_events").select("id,event_type,created_at").eq("delivery_id", row.id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (clientResult.error || filesResult.error || archivesResult.error || jobsResult.error || eventsResult.error) throw new ApiError(503, "Could not load delivery details.", "DELIVERY_READ_FAILED");
    return NextResponse.json({ delivery: { ...row, clients: clientResult.data, delivery_files: filesResult.data ?? [], delivery_archives: archivesResult.data ?? [], processing_jobs: jobsResult.data ?? [], download_events: eventsResult.data ?? [] } }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireAdmin(); assertSameOriginMutation(request); if (!validId(params.id)) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
    const body = await readJson<{ trackTitle?: string; serviceType?: string; message?: string | null }>(request);
    const updates: DeliveryUpdate = { updated_at: new Date().toISOString() };
    if (body.trackTitle !== undefined) { if (!body.trackTitle.trim() || body.trackTitle.length > 180) throw new ApiError(400, "Track title must be between 1 and 180 characters.", "VALIDATION_FAILED"); updates.track_title = body.trackTitle.trim(); }
    if (body.serviceType !== undefined) { if (!(serviceTypes as readonly string[]).includes(body.serviceType)) throw new ApiError(400, "Choose a valid service type.", "VALIDATION_FAILED"); updates.service_type = body.serviceType; }
    if (body.message !== undefined) updates.message = body.message?.slice(0, 4000) ?? null;
    const { data, error } = await createSupabaseServiceClient().from("deliveries").update(updates).eq("id", params.id).select("id,track_title,service_type,message,status,updated_at").maybeSingle();
    if (error || !data) throw new ApiError(503, "Could not update the delivery.", "DELIVERY_UPDATE_FAILED");
    return NextResponse.json({ delivery: data }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { await requireAdmin(); assertSameOriginMutation(request); if (!validId(params.id)) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND"); await safelyDeleteDelivery(params.id); return NextResponse.json({ deleted: true }, { headers: noStoreHeaders() }); }
  catch (error) { return jsonError(error); }
}
