"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { BrandLogo } from "@/components/BrandLogo";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const client = createSupabaseBrowserClient();
      const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/login/update-password` });
      if (resetError) throw resetError;
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The reset request could not be completed."); }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><section className="login-panel">
    <div className="login-top"><BrandLogo name="SAXN" logoUrl={null} /><h1>Reset password</h1><p>We&apos;ll send a secure reset link if this address belongs to an administrator.</p></div>
    {sent ? <div className="success-box" role="status">If the account is eligible, a reset message has been sent. Follow its link to continue.</div> : <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      {!supabasePublicConfig() && <div className="notice-box">Supabase is not configured. See the project setup guide.</div>}
      <label className="form-field"><span className="form-label">Administrator email</span><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="button button-primary button-wide" disabled={busy || !supabasePublicConfig()}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>}
    <div style={{ marginTop: 20 }}><Link href="/login" className="small muted">Return to sign in</Link></div>
  </section></main>;
}
