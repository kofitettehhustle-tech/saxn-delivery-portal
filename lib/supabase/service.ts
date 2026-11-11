import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requiredEnv } from "./config";

let serviceClient: SupabaseClient<any> | null = null;

export function createSupabaseServiceClient(): SupabaseClient<any> {
  if (serviceClient) return serviceClient;
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  serviceClient = createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "saxn-delivery-portal-server" } },
  });
  return serviceClient;
}
