import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { clientSchema } from "@/lib/validation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try { await requireAdmin(); if (!validId(params.id)) throw new ApiError(404, "Client not found.", "CLIENT_NOT_FOUND");
    const db = createSupabaseServiceClient();
    const [{ data: client, error }, { data: deliveries }] = await Promise.all([
      db.from("clients").select("id,name,email,created_at,updated_at").eq("id", params.id).maybeSingle(),
      db.from("deliveries").select("id,track_title,service_type,status,created_at,expires_at,zip_filename,zip_size,reference_number").eq("client_id", params.id).order("created_at", { ascending: false }),
    ]);
    if (error || !client) throw new ApiError(404, "Client not found.", "CLIENT_NOT_FOUND");
    return NextResponse.json({ client, deliveries: deliveries ?? [] }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try { await requireAdmin(); assertSameOriginMutation(request); if (!validId(params.id)) throw new ApiError(404, "Client not found.", "CLIENT_NOT_FOUND");
    const parsed = clientSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Client details are invalid.", "VALIDATION_FAILED");
    const { data, error } = await createSupabaseServiceClient().from("clients").update({ name: parsed.data.name, email: parsed.data.email || null, updated_at: new Date().toISOString() }).eq("id", params.id).select("id,name,email,updated_at").maybeSingle();
    if (error || !data) throw new ApiError(503, "Could not update this client.", "CLIENT_UPDATE_FAILED");
    return NextResponse.json({ client: data }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try { await requireAdmin(); assertSameOriginMutation(request); if (!validId(params.id)) throw new ApiError(404, "Client not found.", "CLIENT_NOT_FOUND");
    const db = createSupabaseServiceClient();
    const { count } = await db.from("deliveries").select("id", { count: "exact", head: true }).eq("client_id", params.id);
    if ((count ?? 0) > 0) throw new ApiError(409, "This client has delivery history. Keep the client record so those deliveries remain intact.", "CLIENT_HAS_DELIVERIES");
    const { error } = await db.from("clients").delete().eq("id", params.id);
    if (error) throw new ApiError(503, "Could not delete the client.", "CLIENT_DELETE_FAILED");
    return NextResponse.json({ deleted: true }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
