"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicConfig } from "./config";

let singleton: SupabaseClient<any> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<any> {
  const config = supabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured. Add the public project URL and anon key to the local environment.");
  if (!singleton) {
    singleton = createBrowserClient<any>(config.url, config.anonKey, {
      cookieOptions: { sameSite: "none", secure: true, path: "/" },
    });
  }
  return singleton;
}
