"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabasePublicConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const router = useRouter(); const configured = Boolean(supabasePublicConfig());
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const client = createSupabaseBrowserClient(); const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      if (!response.ok) { await client.auth.signOut(); const body = await response.json().catch(() => ({})); throw new Error(body.error || "This account is not enabled as a SAXN administrator."); }
      router.replace("/admin"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in failed. Check your credentials and try again."); }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><section className="login-panel" aria-labelledby="login-heading">
    <div className="login-top"><div className="wordmark">SAXN</div><h1 id="login-heading">Studio access</h1><p>Sign in to manage private project deliveries.</p></div>
    {!configured && <div className="notice-box" role="status">Supabase is not configured yet. Add the public project URL and anon key to `.env.local`, then restart the app.</div>}
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 22 }}><label className="form-field"><span className="form-label">Administrator email</span><input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="form-field"><span className="form-label">Password</span><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <div className="error-box" role="alert">{error}</div>}<button className="button button-primary button-wide" type="submit" disabled={busy || !configured}>{busy ? "Signing in…" : "Sign in"}</button>
    </form><div style={{ textAlign: "right", marginTop: 16 }}><Link href="/login/reset-password" className="small muted">Forgot password?</Link></div><div className="login-footer">Private music delivery · Ghana</div>
  </section></main>;
}
