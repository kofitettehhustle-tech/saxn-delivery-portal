"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { serviceTypes, formatBytes } from "@/lib/validation";

type Row = { id: string; track_title: string; service_type: string; status: string; created_at: string; zip_size: number | null; clients: { name: string } | { name: string }[] | null; reference_number: string };
const statuses = ["DRAFT", "UPLOADING", "PROCESSING", "READY", "FAILED", "EXPIRED", "REVOKED"];
export function DeliveriesTable() {
  const [rows, setRows] = useState<Row[]>([]); const [query, setQuery] = useState(""); const [status, setStatus] = useState("all"); const [service, setService] = useState("all"); const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [retryingId, setRetryingId] = useState<string | null>(null);
  const load = useCallback(async () => { setBusy(true); try { const params = new URLSearchParams({ q: query, status, service, pageSize: "100" }); const response = await fetch(`/api/admin/deliveries?${params}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not load deliveries."); setRows(body.deliveries); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load deliveries."); } finally { setBusy(false); } }, [query, status, service]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(timer); }, [load]);
  async function retryPackaging(id: string) {
    setRetryingId(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/deliveries/${id}/package`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retry: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not queue packaging.");
      setNotice("Packaging retry queued.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not queue packaging.");
    } finally {
      setRetryingId(null);
    }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">Studio records</div><h1 className="page-title" style={{ marginTop: 8 }}>All deliveries</h1><p>Search and manage private project handoffs.</p></div><Link className="button button-primary" href="/admin/deliveries/new">＋ New delivery</Link></div>
    <section className="card"><div className="filter-row"><input className="input" aria-label="Search client or track" placeholder="Search client or track title" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="select" aria-label="Filter by service" value={service} onChange={(e) => setService(e.target.value)} style={{ width: "auto" }}><option value="all">All services</option>{serviceTypes.map((value) => <option key={value}>{value}</option>)}</select><select className="select" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select><span className="quiet small" style={{ marginLeft: "auto" }}>{busy ? "Updating…" : `${rows.length} records`}</span></div>
      {error && <div className="error-box" role="alert" style={{ margin: 16 }}>{error}</div>}
      {notice && <div className="success-box" role="status" style={{ margin: 16 }}>{notice}</div>}
      {rows.length ? <div className="table-wrap"><table><thead><tr><th>Project</th><th>Client</th><th>Reference</th><th>Package</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => { const client = Array.isArray(row.clients) ? row.clients[0] : row.clients; return <tr key={row.id}><td><Link href={`/admin/deliveries/${row.id}`} className="table-main">{row.track_title}</Link><div className="quiet small">{row.service_type}</div></td><td>{client?.name ?? "—"}</td><td>{row.reference_number}</td><td>{row.zip_size ? formatBytes(Number(row.zip_size)) : "—"}</td><td><span className={`status status-${row.status.toLowerCase()}`}>{row.status}</span></td><td>{new Date(row.created_at).toLocaleDateString()}</td><td><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><Link href={`/admin/deliveries/${row.id}`} className="button button-small">View details</Link>{["FAILED", "READY"].includes(row.status) && <button className="button button-small" disabled={retryingId !== null} onClick={() => void retryPackaging(row.id)}>{retryingId === row.id ? "Queuing…" : row.status === "READY" ? "Regenerate ZIP" : "Retry packaging"}</button>}</div></td></tr>; })}</tbody></table></div> : <div className="empty-state"><div className="empty-mark">◌</div><div>{busy ? "Loading delivery records…" : "No deliveries match this view."}</div></div>}
    </section>
  </>;
}
