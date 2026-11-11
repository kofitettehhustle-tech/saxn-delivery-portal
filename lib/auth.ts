import "server-only";
import { ApiError } from "./http";
import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured, isSupabaseServerConfigured } from "./supabase/config";

export type AdminIdentity = { id: string; email: string | null; displayName: string | null };

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase.from("admin_profiles").select("id,email,display_name,is_active").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.is_active !== true) return null;
  return { id: user.id, email: profile.email ?? user.email ?? null, displayName: profile.display_name ?? null };
}

export async function requireAdmin(): Promise<AdminIdentity> {
  if (!isSupabaseConfigured()) throw new ApiError(503, "Supabase public configuration is missing.", "SERVICE_NOT_CONFIGURED");
  const admin = await getAdminIdentity();
  if (!admin) throw new ApiError(401, "Administrator sign-in is required.", "ADMIN_REQUIRED");
  if (!isSupabaseServerConfigured()) throw new ApiError(503, "The server-side Supabase service key is not configured.", "SERVER_CONFIGURATION_MISSING");
  return admin;
}
