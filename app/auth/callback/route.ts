import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/admin";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const supabase = createSupabaseServerClient();
  if (!code || !supabase) return new NextResponse(null, { status: 303, headers: { Location: "/login?error=auth_callback" } });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return new NextResponse(null, { status: 303, headers: { Location: "/login?error=auth_callback" } });
  return new NextResponse(null, { status: 303, headers: { Location: next } });
}
