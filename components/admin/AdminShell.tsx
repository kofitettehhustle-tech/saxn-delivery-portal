"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { BrandLogo } from "@/components/BrandLogo";

const links = [
  { href: "/admin", label: "Overview", icon: "◫", exact: true },
  { href: "/admin/deliveries/new", label: "New Delivery", icon: "+" },
  { href: "/admin/deliveries", label: "All Deliveries", icon: "≡" },
  { href: "/admin/clients", label: "Clients", icon: "◌" },
  { href: "/admin/settings/brand", label: "Brand Settings", icon: "◈" },
  { href: "/admin/storage", label: "Storage Management", icon: "▣" },
  { href: "/admin/account", label: "Account Settings", icon: "○" },
];
export function AdminShell({ children, displayName }: { children: React.ReactNode; displayName: string | null }) {
  const pathname = usePathname(); const router = useRouter(); const [busy, setBusy] = useState(false); const [brandName, setBrandName] = useState("SAXN"); const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/admin/brand", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (response.ok) { setBrandName(body.settings.brand_name || "SAXN"); setLogoUrl(body.logoUrl || null); } }).catch(() => undefined); }, []);
  async function signOut() { setBusy(true); try { await createSupabaseBrowserClient().auth.signOut(); router.replace("/login"); router.refresh(); } finally { setBusy(false); } }
  return <div className="app-shell">
    <aside className="sidebar"><div className="sidebar-brand"><Link href="/admin" className="wordmark"><BrandLogo name={brandName} logoUrl={logoUrl} /></Link><div className="eyebrow" style={{ marginTop: 10 }}>Delivery portal</div></div>
      <nav className="sidebar-nav" aria-label="Admin navigation"><div className="nav-label">Workspace</div>{links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`) || (link.href === "/admin/deliveries" && pathname.startsWith("/admin/deliveries/"));
        return <Link key={link.href} href={link.href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{link.icon}</span>{link.label}</Link>;
      })}</nav>
      <div className="sidebar-bottom">Private studio workspace<br />{brandName} · Ghana</div>
    </aside>
    <div className="main-column"><header className="topbar"><span className="eyebrow">Studio / <span className="muted">Delivery</span></span><div className="topbar-right"><span className="small muted">{displayName || "Administrator"}</span><button className="button button-quiet button-small" type="button" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button></div></header><main className="main-content">{children}</main></div>
  </div>;
}
