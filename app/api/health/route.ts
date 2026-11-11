import { NextResponse } from "next/server";
import { isSupabaseConfigured, isSupabaseServerConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ status: "ok", application: "saxn-delivery-portal", configuration: { supabasePublic: isSupabaseConfigured(), supabaseServer: isSupabaseServerConfigured() } }, { headers: { "Cache-Control": "no-store" } });
}
