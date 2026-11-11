import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { setDeliveryExpiration } from "@/lib/links";
import { retryPackaging } from "@/lib/adminService";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(); assertSameOriginMutation(request); if (!validId(params.id)) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
    const body = await readJson<{ action: "revoke" | "extend" | "retry"; expiration?: "7" | "14" | "30" | "90" | "custom" | "never"; customExpiresAt?: string }>(request);
    const db = createSupabaseServiceClient();
    if (body.action === "revoke") {
      const now = new Date().toISOString();
      const { error } = await db.from("deliveries").update({ status: "REVOKED", revoked_at: now, updated_at: now }).eq("id", params.id);
      if (error) throw new ApiError(503, "Could not revoke this delivery.", "REVOCATION_FAILED");
      await db.from("delivery_tokens").update({ revoked_at: now }).eq("delivery_id", params.id).is("revoked_at", null);
      return NextResponse.json({ revoked: true }, { headers: noStoreHeaders() });
    }
    if (body.action === "extend") {
      if (!body.expiration) throw new ApiError(400, "Choose an expiration period.", "INVALID_EXPIRATION");
      return NextResponse.json({ expiresAt: await setDeliveryExpiration(params.id, body.expiration, body.customExpiresAt) }, { headers: noStoreHeaders() });
    }
    if (body.action === "retry") return NextResponse.json(await retryPackaging(params.id), { status: 202, headers: noStoreHeaders() });
    throw new ApiError(400, "Choose a supported delivery action.", "INVALID_ACTION");
  } catch (error) { return jsonError(error); }
}
