import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { createDelivery } from "@/lib/adminService";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { deliveryStatuses } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const search = (request.nextUrl.searchParams.get("q") ?? "").replace(/[^\p{L}\p{N} _.-]/gu, " ").trim().slice(0, 80);
    const service = request.nextUrl.searchParams.get("service"); const status = request.nextUrl.searchParams.get("status");
    const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? 0) || 0);
    const pageSize = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get("pageSize") ?? 50) || 50)); const db = createSupabaseServiceClient();
    let query = db.from("deliveries").select("id,client_id,track_title,service_type,message,status,zip_filename,zip_size,preview_enabled,preview_file_id,preview_mime_type,preview_size,expires_at,revoked_at,created_at,updated_at,reference_number", { count: "exact" });
    if (service && service !== "all") query = query.eq("service_type", service);
    if (status && status !== "all" && (deliveryStatuses as readonly string[]).includes(status)) query = query.eq("status", status);
    if (search) {
      const { data: matchingClients, error: clientSearchError } = await db.from("clients").select("id").ilike("name", `%${search}%`).limit(100);
      if (clientSearchError) throw new ApiError(503, "Could not search clients.", "DELIVERY_SEARCH_FAILED");
      const ids = (matchingClients ?? []).map((row) => row.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
      if (ids.length) query = query.or(`track_title.ilike.%${search}%,client_id.in.(${ids.join(",")})`); else query = query.ilike("track_title", `%${search}%`);
    }
    const { data: rows, error, count } = await query.order("created_at", { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    const deliveryRows = rows ?? []; const clientIds = [...new Set(deliveryRows.map((row) => row.client_id))]; const deliveryIds = deliveryRows.map((row) => row.id);
    let clients: Array<{ id: string; name: string; email: string | null }> = [];
    let files: Array<{ id: string; delivery_id: string; filename: string; original_filename: string; category: string; file_size: number; mime_type: string }> = [];
    if (clientIds.length) { const result = await db.from("clients").select("id,name,email").in("id", clientIds); if (result.error) throw new ApiError(503, "Could not load delivery clients.", "DELIVERY_READ_FAILED"); clients = result.data ?? []; }
    if (deliveryIds.length) { const result = await db.from("delivery_files").select("id,delivery_id,filename,original_filename,category,file_size,mime_type").in("delivery_id", deliveryIds); if (result.error) throw new ApiError(503, "Could not load delivery file metadata.", "DELIVERY_READ_FAILED"); files = result.data ?? []; }
    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const fileMap = new Map<string, typeof files>(); for (const file of files) fileMap.set(file.delivery_id, [...(fileMap.get(file.delivery_id) ?? []), file]);
    const deliveries = deliveryRows.map((row) => ({ ...row, clients: clientMap.get(row.client_id) ?? null, delivery_files: fileMap.get(row.id) ?? [] }));
    return NextResponse.json({ deliveries, page, pageSize, total: count ?? 0 }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { await requireAdmin(); assertSameOriginMutation(request); const body = await readJson<unknown>(request); const delivery = await createDelivery(body); return NextResponse.json({ delivery }, { status: 201, headers: noStoreHeaders() }); }
  catch (error) { return jsonError(error); }
}
