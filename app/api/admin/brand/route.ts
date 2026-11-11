import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { brandSettingsSchema } from "@/lib/validation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createPrivateSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
const defaults = { brand_name: "SAXN", logo_path: null, location: "Ghana", tagline: null, contact_email: null, social_links: {} };
export async function GET() {
  try { await requireAdmin(); const { data, error } = await createSupabaseServiceClient().from("brand_settings").select("id,brand_name,logo_path,location,tagline,contact_email,social_links,updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; const settings = data ?? defaults; const logoUrl = settings.logo_path ? await createPrivateSignedUrl("brand", settings.logo_path, 600) : null; return NextResponse.json({ settings: { ...settings, logo_path: undefined }, logoUrl }, { headers: noStoreHeaders() }); }
  catch (error) { return jsonError(error); }
}
export async function PUT(request: Request) {
  try {
    await requireAdmin(); assertSameOriginMutation(request);
    const parsed = brandSettingsSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Brand settings are invalid.", "VALIDATION_FAILED");
    const db = createSupabaseServiceClient();
    const { data: existing } = await db.from("brand_settings").select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const values = { brand_name: parsed.data.brandName, location: parsed.data.location, tagline: parsed.data.tagline, contact_email: parsed.data.contactEmail || null, social_links: parsed.data.socialLinks, updated_at: new Date().toISOString() };
    const query = existing ? db.from("brand_settings").update(values).eq("id", existing.id) : db.from("brand_settings").insert(values);
    const { data, error } = await query.select("id,brand_name,logo_path,location,tagline,contact_email,social_links,updated_at").single();
    if (error || !data) throw new ApiError(503, "Could not save brand settings.", "BRAND_SAVE_FAILED");
    const logoUrl = data.logo_path ? await createPrivateSignedUrl("brand", data.logo_path, 600) : null;
    return NextResponse.json({ settings: { ...data, logo_path: undefined }, logoUrl }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
