import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, noStoreHeaders } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try { const admin = await requireAdmin(); return NextResponse.json({ admin: { email: admin.email, displayName: admin.displayName } }, { headers: noStoreHeaders() }); }
  catch (error) { return jsonError(error); }
}
