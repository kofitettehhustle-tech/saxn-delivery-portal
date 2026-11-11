import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "./config";

export function createSupabaseServerClient() {
  const config = supabasePublicConfig();
  if (!config) return null;
  const store = cookies();
  return createServerClient<any>(config.url, config.anonKey, {
    cookieOptions: { sameSite: "none", secure: true, path: "/" },
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values: Parameters<SetAllCookies>[0]) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, { ...options, sameSite: "none", secure: true, path: "/" }));
        } catch {
          // Server Components cannot write cookies; middleware refreshes sessions on requests.
        }
      },
    },
  });
}
