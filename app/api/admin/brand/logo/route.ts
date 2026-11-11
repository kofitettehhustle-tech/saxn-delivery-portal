import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOriginMutation, ApiError, jsonError, noStoreHeaders } from "@/lib/http";
import { bucketName } from "@/lib/storage";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function imageType(bytes: Uint8Array) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
export async function POST(request: Request) {
  try {
    await requireAdmin(); assertSameOriginMutation(request);
    const form = await request.formData(); const file = form.get("logo");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a logo image.", "FILE_REQUIRED");
    if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new ApiError(413, "Logo images must be smaller than 5 MB.", "FILE_TOO_LARGE");
    const bytes = new Uint8Array(await file.arrayBuffer()); const type = imageType(bytes);
    if (!type) throw new ApiError(415, "Use a PNG, JPEG or WebP logo image.", "FILE_TYPE_NOT_ALLOWED");
    const ext = type === "image/jpeg" ? "jpg" : type.slice("image/".length);
    const path = `brand/${randomUUID()}.${ext}`;
    const db = createSupabaseServiceClient();
    const { error: uploadError } = await db.storage.from(bucketName("brand")).upload(path, bytes, { contentType: type, upsert: false });
    if (uploadError) throw new ApiError(503, "Could not upload the logo to private storage.", "LOGO_UPLOAD_FAILED");
    const { data: existing } = await db.from("brand_settings").select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const values = { brand_name: "SAXN", location: "Ghana", logo_path: path, updated_at: new Date().toISOString() };
    const { error } = existing ? await db.from("brand_settings").update({ logo_path: path, updated_at: values.updated_at }).eq("id", existing.id) : await db.from("brand_settings").insert(values);
    if (error) throw new ApiError(503, "Logo uploaded, but brand settings could not be updated.", "LOGO_RECORD_FAILED");
    return NextResponse.json({ uploaded: true }, { status: 201, headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
