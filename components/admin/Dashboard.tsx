"use client";

import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useState } from "react";
import { formatBytes } from "@/lib/validation";

type DashboardStats = { total: number; ready: number; downloaded: number; awaiting: number; expired: number; revoked: number; storageBytes: number };
type RecentDelivery = { id: string; track_title: string; service_type: string; status: string; created_at: string; clients: { name: string } | null };
type ActivityEvent = { id: string; event_type: string; created_at: string; deliveries: { track_title: string; clients: { name: string } | null } | null };
type DashboardData = { stats: DashboardStats; recent: RecentDelivery[]; activity: ActivityEvent[] };

const metrics: { label: string; key: keyof Pick<DashboardStats, "total" | "ready" | "downloaded" | "awaiting">; caption: string; icon: string }[] = [
  { label: "Total deliveries", key: "total", caption: "Across your studio", icon: "◫" },
  { label: "Ready to download", key: "ready", caption: "Available to clients", icon: "↗" },
  { label: "Download requests", key: "downloaded", caption: "Secure links requested", icon: "⇩" },
  { label: "Awaiting download", key: "awaiting", caption: "Ready, not yet requested", icon: "◷" },
];

const activityLabels: Record<string, string> = {
  download_requested: "Download requested",
  preview_requested: "Preview played",
  page_view: "Delivery page opened",
  password_failed: "Password attempt",
};

function DeliveryMix({ stats }: { stats: DashboardStats }) {
  const remaining = Math.max(0, stats.total - stats.ready - stats.expired - stats.revoked);
  const segments = [
    { label: "Ready", value: stats.ready, color: "var(--success)" },
    { label: "Expired", value: stats.expired, color: "var(--warning)" },
    { label: "Revoked", value: stats.revoked, color: "var(--danger)" },
    { label: "In progress / other", value: remaining, color: "var(--silver)" },
  ];

  return <div className="studio-mix">
    <div className="studio-mix-bar" role="img" aria-label={`${stats.ready} ready, ${stats.expired} expired, ${stats.revoked} revoked, ${remaining} in progress or other`}>
      {stats.total > 0 && segments.filter((segment) => segment.value > 0).map((segment) => <span key={segment.label} style={{ width: `${segment.value / stats.total * 100}%`, background: segment.color }} />)}
    </div>
    <div className="studio-mix-legend">
      {segments.map((segment) => <div className="studio-mix-item" key={segment.label}>
        <span className="studio-mix-dot" style={{ background: segment.color }} />
        <span>{segment.label}</span>
        <strong>{segment.value}</strong>
      </div>)}
    </div>
  </div>;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load dashboard data.");
      setData(body as DashboardData);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dashboard data.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stats = data?.stats;
  const waveformBars = [14, 23, 18, 33, 24, 44, 28, 54, 37, 62, 31, 47, 21, 39, 26, 50, 34, 19, 42, 27, 57, 34, 46, 22, 38, 17];

  return <div className="studio-dashboard">
    <header className="studio-page-heading">
      <div>
        <div className="eyebrow">SAXN studio · private delivery</div>
        <h1 className="page-title">Your studio, in focus.</h1>
        <p>Every client handoff, at a glance.</p>
      </div>
      <div className="studio-heading-actions">
        <span className="studio-live-indicator"><i /> Live overview</span>
        <button className="studio-refresh" type="button" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh dashboard">
          <span aria-hidden="true">↻</span>{refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>
    </header>

    {error && <div className="error-box" role="alert">{error}</div>}

    <section className="studio-hero">
      <div className="studio-hero-copy">
        <div className="studio-hero-kicker"><span /> Your delivery room</div>
        <h2>Make every handoff<br />feel finished.</h2>
        <p>Keep projects moving, files organized, and every client delivery in one private workspace.</p>
        <div className="studio-hero-actions">
          <Link href="/admin/deliveries/new" className="studio-hero-primary">＋ New delivery <span aria-hidden="true">↗</span></Link>
          <Link href="/admin/deliveries" className="studio-hero-secondary">Browse deliveries</Link>
        </div>
        <div className="studio-hero-stats">
          <div><strong>{stats ? stats.ready : "—"}</strong><span>Ready projects</span></div>
          <div><strong>{stats ? stats.awaiting : "—"}</strong><span>Awaiting download</span></div>
          <div><strong>{stats ? stats.downloaded : "—"}</strong><span>Download requests</span></div>
        </div>
      </div>
      <div className="studio-hero-art" aria-hidden="true">
        <div className="studio-art-glow" />
        <div className="studio-vinyl">
          <div className="studio-vinyl-label">S<br /><span>AXN</span></div>
        </div>
        <div className="studio-waveform">{waveformBars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
        <div className="studio-art-caption"><span>PRIVATE STUDIO</span><strong>Secure by design</strong></div>
      </div>
    </section>

    <section className="studio-metrics" aria-label="Delivery statistics">
      {metrics.map((metric, index) => <article className={`studio-metric studio-metric-${index + 1}`} key={metric.key}>
        <div className="studio-metric-top"><span>{metric.label}</span><i aria-hidden="true">{metric.icon}</i></div>
        <strong>{stats ? stats[metric.key].toLocaleString() : "—"}</strong>
        <small>{metric.caption}</small>
      </article>)}
    </section>

    <div className="studio-content-grid">
      <section className="studio-glass-card studio-recent-card">
        <header className="studio-card-heading">
          <div><div className="eyebrow">Your latest work</div><h2>Recent deliveries</h2></div>
          <Link href="/admin/deliveries" className="studio-card-link">View all <span aria-hidden="true">↗</span></Link>
        </header>
        {data?.recent.length ? <div className="studio-record-list">
          {data.recent.map((item, index) => <Link href={`/admin/deliveries/${item.id}`} className="studio-record" key={item.id}>
            <span className={`studio-record-art studio-record-art-${index % 4}`} aria-hidden="true">♫</span>
            <span className="studio-record-details"><strong>{item.track_title}</strong><small>{item.clients?.name ?? "Client"} <i>·</i> {item.service_type}</small></span>
            <span className={`status status-${String(item.status).toLowerCase()}`}>{item.status}</span>
            <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
            <span className="studio-record-arrow" aria-hidden="true">↗</span>
          </Link>)}
        </div> : <div className="studio-empty">
          <span className="studio-empty-icon" aria-hidden="true">♫</span>
          <strong>{data ? "Your next handoff starts here." : "Loading live delivery records…"}</strong>
          {data && <Link href="/admin/deliveries/new" className="studio-card-link">Create your first delivery ↗</Link>}
        </div>}
      </section>

      <div className="studio-side-stack">
        <section className="studio-glass-card studio-pulse-card">
          <header className="studio-card-heading">
            <div><div className="eyebrow">At a glance</div><h2>Delivery pulse</h2></div>
            <span className="studio-card-orbit" aria-hidden="true">◌</span>
          </header>
          {stats ? <div className="studio-pulse-content">
            <div className="studio-pulse-total"><strong>{stats.total.toLocaleString()}</strong><span>total projects</span></div>
            <DeliveryMix stats={stats} />
            <div className="studio-pulse-footer"><span>Storage in use</span><strong>{formatBytes(stats.storageBytes)}</strong></div>
          </div> : <div className="studio-pulse-loading">Loading delivery stats…</div>}
        </section>

        <section className="studio-glass-card studio-activity-card">
          <header className="studio-card-heading">
            <div><div className="eyebrow">Client touchpoints</div><h2>Access activity</h2></div>
            <span className="studio-activity-live"><i /> Live</span>
          </header>
          {data?.activity.length ? <div className="studio-activity-list">
            {data.activity.slice(0, 5).map((event) => <article className="studio-activity-item" key={event.id}>
              <span className={`studio-activity-icon studio-activity-${event.event_type}`} aria-hidden="true">{event.event_type === "download_requested" ? "↓" : event.event_type === "preview_requested" ? "▶" : event.event_type === "password_failed" ? "!" : "↗"}</span>
              <div><strong>{activityLabels[event.event_type] ?? "Delivery activity"}</strong><small>{event.deliveries?.track_title ?? "Delivery"}{event.deliveries?.clients?.name ? ` · ${event.deliveries.clients.name}` : ""}</small></div>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
            </article>)}
          </div> : <div className="studio-activity-empty">{data ? "Client activity will appear here." : "Loading activity…"}</div>}
        </section>
      </div>
    </div>

    <p className="studio-footnote">Download counts represent authorized secure-link requests, not confirmed file transfers.</p>
  </div>;
}
