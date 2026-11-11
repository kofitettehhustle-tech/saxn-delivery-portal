import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolvePublicDelivery, recordDeliveryEvent, sanitizePublicDelivery } from "@/lib/publicDelivery";
import { passwordGateCookieValue } from "@/lib/security";
import { enforcePublicRateLimit } from "@/lib/rateLimit";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders, readJson } from "@/lib/http";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createPrivateSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
type Context = { params: { token: string } };
export async function GET(request: Request, { params }: Context) {
  try {
    await enforcePublicRateLimit(request, `delivery-page:${params.token.slice(0, 16)}`);
    const resolved = await resolvePublicDelivery(params.token);
    if (resolved.requiresPassword && !resolved.passwordVerified) return NextResponse.json({ locked: true, passwordRequired: true }, { status: 401, headers: noStoreHeaders() });
    await recordDeliveryEvent(resolved.delivery.id, "page_view");
    const publicData = sanitizePublicDelivery(resolved);
    const { data: brand } = await createSupabaseServiceClient().from("brand_settings").select("brand_name,logo_path,location,tagline,contact_email,social_links").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const logoUrl = brand?.logo_path ? await createPrivateSignedUrl("brand", brand.logo_path, 600) : null;
    return NextResponse.json({ delivery: publicData, brand: { brandName: brand?.brand_name ?? "SAXN", location: brand?.location ?? "Ghana", tagline: brand?.tagline ?? null, contactEmail: brand?.contact_email ?? null, socialLinks: brand?.social_links ?? {}, logoUrl } }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOriginMutation(request); await enforcePublicRateLimit(request, `delivery-password:${params.token.slice(0, 16)}`);
    const body = await readJson<{ password?: string }>(request);
    if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 128) throw new ApiError(400, "Enter the delivery password.", "PASSWORD_REQUIRED");
    const resolved = await resolvePublicDelivery(params.token);
    if (!resolved.requiresPassword) return NextResponse.json({ delivery: sanitizePublicDelivery(resolved) }, { headers: noStoreHeaders() });
    const passwordHash = resolved.tokenRow.password_hash as string | null;
    const valid = passwordHash ? await bcrypt.compare(body.password, passwordHash) : false;
    if (!valid) { await recordDeliveryEvent(resolved.delivery.id, "password_failed"); throw new ApiError(401, "That password did not match. Try again.", "PASSWORD_INVALID"); }
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const value = passwordGateCookieValue(resolved.tokenHash, expiresAt);
    cookies().set(resolved.cookieName, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/public", maxAge: 3600 });
    await recordDeliveryEvent(resolved.delivery.id, "page_view");
    const { data: brand } = await createSupabaseServiceClient().from("brand_settings").select("brand_name,logo_path,location,tagline,contact_email,social_links").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const logoUrl = brand?.logo_path ? await createPrivateSignedUrl("brand", brand.logo_path, 600) : null;
    return NextResponse.json({ delivery: { ...sanitizePublicDelivery(resolved), passwordVerified: true }, brand: { brandName: brand?.brand_name ?? "SAXN", location: brand?.location ?? "Ghana", tagline: brand?.tagline ?? null, contactEmail: brand?.contact_email ?? null, socialLinks: brand?.social_links ?? {}, logoUrl } }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
