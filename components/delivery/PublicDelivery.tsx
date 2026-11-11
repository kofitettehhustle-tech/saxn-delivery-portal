"use client";

import { CSSProperties, FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";

type Delivery = { id: string; clientName: string; trackTitle: string; serviceType: string; message: string | null; status: string; zipFilename: string | null; zipSize: number | null; previewEnabled: boolean; previewFileName: string | null; previewMimeType: string | null; deliveryDate: string; referenceNumber: string; expiresAt: string | null; requiresPassword: boolean; passwordVerified: boolean };
type Brand = { brandName: string; location: string; tagline: string | null; contactEmail: string | null; socialLinks: Record<string, string>; logoUrl: string | null };
type Payload = { delivery?: Delivery; brand?: Brand; locked?: boolean; passwordRequired?: boolean };

function SocialIcon({ name }: { name: string }) {
  const iconProps = { "aria-hidden": true as const, viewBox: "0 0 24 24", fill: "currentColor", className: "social-icon" };
  switch (name) {
    case "instagram":
      return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="18" cy="6.5" r="1.25" /></svg>;
    case "youtube":
      return <svg {...iconProps}><path d="M23 7.1a3 3 0 0 0-2.1-2.1C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9A3 3 0 0 0 3.1 19c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9ZM9.8 15.3V8.7l5.8 3.3-5.8 3.3Z" /></svg>;
    case "tiktok":
      return <svg {...iconProps}><path d="M19.6 6.1a5.8 5.8 0 0 1-3.5-1.2v8.2a6.1 6.1 0 1 1-5.3-6.1v3.2a3 3 0 1 0 2.1 2.9V2h3.2a5.8 5.8 0 0 0 3.5 3.3v.8Z" /></svg>;
    case "facebook":
      return <svg {...iconProps}><path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6a22 22 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8h3.4Z" /></svg>;
    case "x":
      return <svg {...iconProps}><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.8 5.8 22H2.6l7.3-8.4L1.8 2h6.5l4.4 6.6L18.9 2Zm-1.1 17.8h1.7L7.3 4H5.5l12.3 15.8Z" /></svg>;
    case "website":
      return <svg {...iconProps}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>;
    case "beatStore":
      return <svg {...iconProps}><path d="M12 3v12.2a3.7 3.7 0 1 1-2-3.3V6l10-2v11.2a3.7 3.7 0 1 1-2-3.3V3.8L12 5.2V3Z" /></svg>;
    default:
      return null;
  }
}

function HeadphonePortrait() {
  return <svg className="poster-portrait" viewBox="0 0 520 580" aria-hidden="true">
    <defs>
      <radialGradient id="portrait-light"><stop stopColor="rgba(var(--brand-accent-rgb),.42)" /><stop offset="1" stopColor="rgba(var(--brand-accent-rgb),0)" /></radialGradient>
      <linearGradient id="headphone-shine" x1="0" x2="1" y1="0" y2="1"><stop stopColor="rgba(var(--brand-accent-rgb),.95)" /><stop offset="1" stopColor="rgba(var(--brand-accent-rgb),.35)" /></linearGradient>
    </defs>
    <circle cx="266" cy="205" r="205" fill="url(#portrait-light)" />
    <circle cx="266" cy="205" r="154" fill="none" stroke="rgba(var(--brand-accent-rgb),.88)" strokeWidth="2" />
    <circle cx="266" cy="205" r="145" fill="none" stroke="rgba(var(--brand-accent-rgb),.12)" strokeWidth="18" />
    <path d="M75 580c20-73 62-111 121-130l35-17 72-1 35 17c64 24 100 66 116 131H75Z" fill="#050807" />
    <path d="M206 377v65c20 27 81 30 104 0l-9-83-95 18Z" fill="#080d0a" />
    <path d="M182 166c-19-28-12-72 20-96 35-27 90-29 129-9 38 20 57 60 51 98 19 19 24 47 15 74 9 23 3 48-15 64-2 40-28 68-66 78-36 10-81 1-104-27-12-14-17-31-18-49-16-9-24-21-19-33-12-11-15-23-8-35-9-17-3-39 15-65Z" fill="#050807" />
    <path d="M198 178c-7 22-9 43-6 63l-22 26 20 10c-4 15 4 25 19 31 1 32 19 56 48 65 30 10 69 3 88-20 13-16 17-38 15-60-2-29-8-54-20-77-21-40-91-61-142-38Z" fill="#090e0b" />
    <path d="M202 158c24-42 69-54 112-37 34 14 55 42 57 76-16-18-31-32-53-37-22-5-42 6-62 7-19 1-35-7-54-9Z" fill="#040705" />
    <path d="M181 205c-2-78 49-123 112-123 65 0 111 49 108 126" fill="none" stroke="#111a14" strokeWidth="22" strokeLinecap="round" />
    <path d="M181 205c-2-78 49-123 112-123 65 0 111 49 108 126" fill="none" stroke="url(#headphone-shine)" strokeWidth="3" strokeLinecap="round" />
    <rect x="163" y="188" width="46" height="106" rx="22" fill="#101712" stroke="url(#headphone-shine)" strokeWidth="4" />
    <rect x="170" y="202" width="31" height="77" rx="15" fill="#080c09" />
    <rect x="359" y="183" width="48" height="116" rx="23" fill="#101712" stroke="url(#headphone-shine)" strokeWidth="4" />
    <rect x="367" y="198" width="31" height="85" rx="15" fill="#080c09" />
    <path d="M383 296c-5 72-39 107-78 125" fill="none" stroke="rgba(var(--brand-accent-rgb),.42)" strokeWidth="2" />
  </svg>;
}

function AudioPreview({ token, fileName, artistName }: { token: string; fileName: string | null; artistName: string }) {
  const [audioUrl, setAudioUrl] = useState(""); const [audio, setAudio] = useState<HTMLAudioElement | null>(null); const [playing, setPlaying] = useState(false); const [current, setCurrent] = useState(0); const [duration, setDuration] = useState(0); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { const element = new Audio(); setAudio(element); element.preload = "metadata"; const time = () => setCurrent(element.currentTime); const loaded = () => setDuration(Number.isFinite(element.duration) ? element.duration : 0); const ended = () => setPlaying(false); const failed = () => setError("Preview audio could not be played."); element.addEventListener("timeupdate", time); element.addEventListener("loadedmetadata", loaded); element.addEventListener("ended", ended); element.addEventListener("error", failed); return () => { element.pause(); element.removeEventListener("timeupdate", time); element.removeEventListener("loadedmetadata", loaded); element.removeEventListener("ended", ended); element.removeEventListener("error", failed); }; }, []);
  async function toggle() { if (!audio) return; setError(""); if (!audioUrl) { setLoading(true); try { const response = await fetch(`/api/public/d/${token}/preview`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Preview is unavailable."); setAudioUrl(body.signedUrl); audio.src = body.signedUrl; await audio.play(); setPlaying(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview is unavailable."); } finally { setLoading(false); } return; } if (audio.paused) { try { await audio.play(); setPlaying(true); } catch { setError("Playback could not start. Try again."); } } else { audio.pause(); setPlaying(false); } }
  function seek(value: number) { if (!audio || !duration) return; audio.currentTime = value; setCurrent(value); }
  function skip(seconds: number) { if (!audio || !duration) return; seek(Math.max(0, Math.min(duration, audio.currentTime + seconds))); }
  const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  return <div className="poster-player">
    <div className="poster-track-info"><div className="poster-track-mark" aria-hidden="true"><span>♫</span></div><div className="poster-track-copy"><div className="poster-track-title">{fileName || "Audio preview"}</div><div className="poster-track-artist">{artistName}</div></div><span className="poster-ready-mark" aria-label="Private preview">✓</span></div>
    <input className="poster-seek" type="range" min={0} max={Math.max(duration, 0)} step={0.1} value={Math.min(current, duration)} onChange={(event) => seek(Number(event.target.value))} aria-label="Seek audio preview" style={{ "--seek-progress": `${duration ? current / duration * 100 : 0}%` } as CSSProperties} />
    <div className="poster-time-row"><span>{time(current)}</span><span>{time(duration)}</span></div>
    <div className="poster-controls">
      <button type="button" className="poster-skip" onClick={() => skip(-10)} aria-label="Back 10 seconds">↶<small>10</small></button>
      <button type="button" className="poster-play" onClick={() => void toggle()} aria-label={playing ? "Pause preview" : "Play preview"} disabled={loading}>{loading ? "…" : playing ? "Ⅱ" : "▶"}</button>
      <button type="button" className="poster-skip" onClick={() => skip(10)} aria-label="Forward 10 seconds">↷<small>10</small></button>
    </div>
    {error && <div className="poster-audio-error" role="alert">{error}</div>}
  </div>;
}

export function PublicDelivery({ token }: { token: string }) {
  const [payload, setPayload] = useState<Payload | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState(""); const [downloadError, setDownloadError] = useState(""); const [brandAccent, setBrandAccent] = useState("22, 216, 112");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/public/d/${token}`, { cache: "no-store" }); const body = await response.json(); if (response.status === 401 && body.passwordRequired) { setPayload({ locked: true, passwordRequired: true }); return; } if (!response.ok) throw new Error(body.error || "This delivery link is unavailable."); setPayload(body); } catch (cause) { setError(cause instanceof Error ? cause.message : "This delivery link is unavailable."); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function unlock(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch(`/api/public/d/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Password verification failed."); setPayload(body); setPassword(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Password verification failed."); } finally { setBusy(false); } }
  async function download() { setBusy(true); setDownloadError(""); setFeedback("Requesting a secure download link…"); try { const response = await fetch(`/api/public/d/${token}/download`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Download could not start."); setFeedback("Your secure download is starting."); window.location.assign(body.signedUrl); } catch (cause) { setFeedback(""); setDownloadError(cause instanceof Error ? cause.message : "Download could not start."); } finally { setBusy(false); } }
  const delivery = payload?.delivery; const brand = payload?.brand ?? null; const socials = brand?.socialLinks ?? {};
  const socialEntries = Object.entries(socials).filter(([, url]) => typeof url === "string" && url.length > 0);
  useEffect(() => {
    if (!brand?.logoUrl) { setBrandAccent("22, 216, 112"); return; }
    let active = true;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 48;
        const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return;
        context.drawImage(image, 0, 0, 48, 48);
        const pixels = context.getImageData(0, 0, 48, 48).data;
        const colors = new Map<number, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], alpha = pixels[i + 3];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (alpha < 180 || max < 55 || max > 248 || (max - min) / max < 0.2) continue;
          const hue = Math.round((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI + 360) % 360);
          const bucket = Math.floor(hue / 15);
          const color = colors.get(bucket) ?? { count: 0, r: 0, g: 0, b: 0 };
          color.count++; color.r += r; color.g += g; color.b += b; colors.set(bucket, color);
        }
        const dominant = [...colors.values()].sort((a, b) => b.count - a.count)[0];
        if (active && dominant) setBrandAccent(`${Math.round(dominant.r / dominant.count)}, ${Math.round(dominant.g / dominant.count)}, ${Math.round(dominant.b / dominant.count)}`);
      } catch {
        if (active) setBrandAccent("22, 216, 112");
      }
    };
    image.onerror = () => { if (active) setBrandAccent("22, 216, 112"); };
    image.src = brand.logoUrl;
    return () => { active = false; };
  }, [brand?.logoUrl]);
  const themeStyle = { "--brand-accent-rgb": brandAccent } as CSSProperties;
  const brandName = brand?.brandName || "SAXN";
  const downloadButton = delivery?.status === "READY"
    ? <button className="poster-download" onClick={() => void download()} disabled={busy}>{busy ? "Preparing secure download…" : `Download ${delivery.zipFilename || "project ZIP"}`}</button>
    : <div className="poster-download-notice" role="status">{delivery?.status === "FAILED" ? "The studio is reviewing your package." : "Your private package is still being prepared."}</div>;
  return <div className="delivery-page delivery-poster-page" style={themeStyle}>
    {loading ? <main className="poster-state"><div className="empty-mark">⌁</div>Opening your private delivery…</main>
      : error ? <main className="poster-state"><section className="delivery-panel"><div className="eyebrow">Private access</div><h1 className="page-title" style={{ margin: "12px 0" }}>This link is unavailable.</h1><p className="muted">{error}</p><p className="quiet small">If you believe this is a mistake, contact the studio that shared it.</p></section></main>
      : payload?.locked ? <main className="poster-state"><section className="delivery-panel poster-password"><div className="eyebrow">Protected delivery</div><h1 className="page-title" style={{ margin: "11px 0" }}>Enter your access password.</h1><p className="muted">This private handoff is password protected.</p><form onSubmit={unlock} style={{ display: "grid", gap: 12, marginTop: 22 }}><label className="form-field"><span className="form-label">Delivery password</span><input className="input" type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="error-box" role="alert">{error}</div>}<button className="button button-primary" disabled={busy}>{busy ? "Checking…" : "Unlock delivery"}</button></form></section></main>
      : delivery ? <main className="poster-main">
        <section className="delivery-poster">
          <div className="poster-halo" aria-hidden="true" />
          <HeadphonePortrait />
          <div className="poster-brand-emblem">{brand?.logoUrl ? <Image src={brand.logoUrl} alt="" width={180} height={70} unoptimized /> : <span>{brandName}</span>}</div>
          <div className="poster-content">
            <div className="poster-status">{delivery.status === "READY" ? "PRIVATE STUDIO DELIVERY" : delivery.status === "FAILED" ? "PACKAGE BEING REVIEWED" : "YOUR PROJECT IS BEING PREPARED"}</div>
            <h1 className="poster-heading">{delivery.status === "READY" ? "YOUR MUSIC IS READY." : delivery.status === "FAILED" ? "DELIVERY IN PROGRESS." : "YOUR PROJECT IS ALMOST READY."}</h1>
            {delivery.previewEnabled ? <AudioPreview token={token} fileName={delivery.previewFileName} artistName={delivery.clientName} /> : <div className="poster-no-preview">Your studio preview is not enabled for this delivery.</div>}
            <div className="poster-action-area">{downloadButton}{downloadError && <p className="poster-feedback poster-error" role="alert">{downloadError}</p>}{feedback && <p className="poster-feedback" role="status">{feedback}</p>}</div>
          </div>
          <div className="poster-meta"><span>{delivery.referenceNumber}</span><span>{delivery.serviceType}</span><span>{new Date(delivery.deliveryDate).toLocaleDateString()}</span>{delivery.expiresAt && <span>Link expires {new Date(delivery.expiresAt).toLocaleDateString()}</span>}</div>
          {delivery.message && <p className="poster-note">{delivery.message}</p>}
          <div className="poster-footer">
            <div className="poster-brand-lockup"><BrandLogo name={brandName} logoUrl={brand?.logoUrl ?? null} className="poster-brand-fallback" /><span>{brandName}</span></div>
            <div className="poster-artist-lockup"><span>ARTIST</span><strong>{delivery.clientName}</strong></div>
          </div>
        </section>
        <footer className="poster-connect">
          {brand?.contactEmail && <a href={`mailto:${brand.contactEmail}`} className="poster-connect-link">Contact</a>}
          {socialEntries.map(([name, url]) => <a className="poster-connect-link" key={name} href={url} target="_blank" rel="noreferrer"><SocialIcon name={name} />{name === "beatStore" ? "Beat store" : name === "website" ? "Website" : name}</a>)}
          <span className="poster-copyright">© {new Date().getFullYear()} {brandName} · {brand?.location || "Ghana"}</span>
        </footer>
      </main> : null}
  </div>;
}
