"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatBytes } from "@/lib/validation";

type DashboardData = { stats: { total: number; ready: number; downloaded: number; awaiting: number; expired: number; revoked: number; storageBytes: number }; recent: any[]; activity: any[] };
const tiles = [
  ["Total deliveries", "total", "All-time projects"], ["Ready", "ready", "Available to clients"], ["Download requests", "downloaded", "Signed download access issued"], ["Awaiting download", "awaiting", "Ready with no request recorded"],
  ["Expired", "expired", "Access window elapsed"], ["Revoked", "revoked", "Access manually withdrawn"],
] as const;

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const response = await fetch("/api/admin/dashboard", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load dashboard data."); setData(body); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load dashboard data."); }
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15000); return () => window.clearInterval(timer); }, [refresh]);
  return <>
    <div className="page-heading"><div><div className="eyebrow">Workspace overview</div><h1 className="page-title" style={{ marginTop: 8 }}>Your studio, in focus.</h1><p>Delivery activity and access at a glance.</p></div><Link href="/admin/deliveries/new" className="button button-primary">＋ New delivery</Link></div>
    {error && <div className="error-box" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
    <section className="stats-grid" aria-label="Delivery statistics">{tiles.map(([label, key, detail]) => <article className="stat-card" key={key}><div className="stat-label">{label}</div><div className="stat-value">{data ? data.stats[key] : "—"}</div><div className="stat-detail">{detail}</div></article>)}<article className="stat-card"><div className="stat-label">Storage in use</div><div className="stat-value" style={{ fontSize: 22 }}>{data ? formatBytes(data.stats.storageBytes) : "—"}</div><div className="stat-detail">Originals, ZIP archives and previews</div></article></section>
    <div className="content-grid">
      <section className="card"><header className="card-heading"><h2 className="section-title">Recent deliveries</h2><Link className="small muted" href="/admin/deliveries">View all →</Link></header>
        {data?.recent.length ? <div className="table-wrap"><table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Date</th></tr></thead><tbody>{data.recent.map((item) => { const client = Array.isArray(item.clients) ? item.clients[0] : item.clients; return <tr key={item.id}><td><Link href={`/admin/deliveries/${item.id}`} className="table-main">{item.track_title}</Link><div className="quiet small">{item.service_type}</div></td><td>{client?.name ?? "—"}</td><td><span className={`status status-${String(item.status).toLowerCase()}`}>{item.status}</span></td><td>{new Date(item.created_at).toLocaleDateString()}</td></tr>; })}</tbody></table></div> : <div className="empty-state"><div className="empty-mark">◌</div><div>{data ? "No deliveries yet." : "Loading live delivery records…"}</div>{data && <Link href="/admin/deliveries/new" className="button button-small" style={{ marginTop: 14 }}>Create the first delivery</Link>}</div>}
      </section>
      <section className="card"><header className="card-heading"><h2 className="section-title">Recent access activity</h2><span className="eyebrow">Live records</span></header>
        {data?.activity.length ? <div style={{ padding: "4px 20px" }}>{data.activity.map((event) => { const delivery = Array.isArray(event.deliveries) ? event.deliveries[0] : event.deliveries; const client = delivery?.clients; return <div key={event.id} style={{ padding: "14px 0", borderBottom: "1px solid #ffffff0b" }}><div className="table-main" style={{ fontSize: 12 }}>{event.event_type === "download_requested" ? "Download requested" : event.event_type === "preview_requested" ? "Preview accessed" : event.event_type === "page_view" ? "Delivery page opened" : "Password attempt"}</div><div className="muted small" style={{ marginTop: 3 }}>{delivery?.track_title ?? "Delivery"}{client?.name ? ` · ${client.name}` : ""}</div><div className="quiet" style={{ fontSize: 10, marginTop: 4 }}>{new Date(event.created_at).toLocaleString()}</div></div>; })}</div> : <div className="empty-state"><div className="empty-mark">⌁</div><div>{data ? "No client activity recorded." : "Loading activity…"}</div></div>}
      </section>
    </div>
    <p className="quiet small" style={{ marginTop: 16 }}>Download counts record authorized signed-link requests; storage delivery completion cannot be confirmed from the signed redirect.</p>
  </>;
}
