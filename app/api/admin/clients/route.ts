import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { clientSchema } from "@/lib/validation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const q = (request.nextUrl.searchParams.get("q") ?? "").replace(/[^\p{L}\p{N} @._+-]/gu, " ").trim().slice(0, 80);
    let query = createSupabaseServiceClient().from("clients").select("id,name,email,created_at,updated_at");
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ clients: data ?? [] }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    await requireAdmin(); assertSameOriginMutation(request);
    const parsed = clientSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Client details are invalid.", "VALIDATION_FAILED");
    const { data, error } = await createSupabaseServiceClient().from("clients").insert({ name: parsed.data.name, email: parsed.data.email || null }).select("id,name,email,created_at,updated_at").single();
    if (error || !data) throw new ApiError(503, "Could not create the client.", "CLIENT_CREATE_FAILED");
    return NextResponse.json({ client: data }, { status: 201, headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
