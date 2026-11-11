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
      <linearGradient id="headphone-shine" x1="0" x2="1" y1="0" y2="1"><stop stopColor="rgba(var(--brand-accent-rgb),.95)" /><stop offset="1" stopColor="rgba(var(--brand-accent-rgb),.35)" /></linearGradient>
    </defs>
    <path d="M62 580c25-84 73-135 151-162l42-46 80 11 46 37c49 35 77 82 90 160H62Z" fill="#030504" />
    <path d="M228 344c8 34 10 69 3 102 20 22 69 27 98 3l-11-111-90 6Z" fill="#070b08" />
    <path d="M184 211c-8-85 35-145 105-147 69-2 111 49 107 135" fill="none" stroke="#111812" strokeWidth="24" strokeLinecap="round" />
    <path d="M184 211c-8-85 35-145 105-147 69-2 111 49 107 135" fill="none" stroke="url(#headphone-shine)" strokeWidth="3" strokeLinecap="round" />
    <path d="M201 211c-16-9-24-25-18-42-9-17-2-36 14-47-2-20 11-37 31-41 10-20 32-27 51-16 17-13 41-9 51 10 21-1 36 15 34 35 17 10 22 29 12 46 12 18 8 37-9 50l-27 13-118 13-21-21Z" fill="#010302" />
    <g fill="#010302">
      <circle cx="201" cy="139" r="25" /><circle cx="223" cy="112" r="28" /><circle cx="256" cy="99" r="31" />
      <circle cx="288" cy="105" r="29" /><circle cx="315" cy="127" r="27" /><circle cx="328" cy="156" r="24" />
    </g>
    <path d="M320 151c-20-13-51-16-75-7-20 8-34 23-39 44-4 12-9 21-18 28l-18 15c-5 5-2 10 9 13l11 3-14 9c-5 5-2 9 8 12l8 3-8 9c-2 6 5 10 17 11 6 24 22 40 44 49l-1 37c-18 24-47 40-81 53l-36 34h291c-15-58-47-97-96-122-28-14-42-39-44-71l-1-42c25-14 38-42 38-79 0-19-2-34-4-49Z" fill="#080b09" stroke="rgba(var(--brand-accent-rgb),.24)" strokeWidth="2" strokeLinejoin="round" />
    <path d="M356 186c19 4 29 21 28 44l-2 31c-1 21-13 35-32 38l-12-9 7-94 11-10Z" fill="#101511" stroke="url(#headphone-shine)" strokeWidth="4" />
    <ellipse cx="353" cy="230" rx="12" ry="31" fill="#080b09" />
    <path d="M374 296c-9 59-38 96-82 123" fill="none" stroke="rgba(var(--brand-accent-rgb),.38)" strokeWidth="2" />
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
  const [payload, setPayload] = useState<Payload | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState(""); const [downloadError, setDownloadError] = useState(""); const [brandAccent, setBrandAccent] = useState("220, 228, 222");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/d/${token}`, { cache: "no-store" });
      const body = await response.json();
      if (response.status === 401 && body.passwordRequired) {
        setPayload({ locked: true, passwordRequired: true });
        return;
      }
      if (!response.ok) throw new Error(body.error || "This delivery link is unavailable.");
      setPayload(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This delivery link is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function unlock(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch(`/api/public/d/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Password verification failed."); setPayload(body); setPassword(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Password verification failed."); } finally { setBusy(false); } }
  async function download() { setBusy(true); setDownloadError(""); setFeedback("Requesting a secure download link…"); try { const response = await fetch(`/api/public/d/${token}/download`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Download could not start."); setFeedback("Your secure download is starting."); window.location.assign(body.signedUrl); } catch (cause) { setFeedback(""); setDownloadError(cause instanceof Error ? cause.message : "Download could not start."); } finally { setBusy(false); } }
  const delivery = payload?.delivery; const brand = payload?.brand ?? null; const socials = brand?.socialLinks ?? {};
  const socialEntries = Object.entries(socials).filter(([, url]) => typeof url === "string" && url.length > 0);
  useEffect(() => {
    if (!brand?.logoUrl) { setBrandAccent("220, 228, 222"); return; }
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
        let neutral = { count: 0, r: 0, g: 0, b: 0 };
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], alpha = pixels[i + 3];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (alpha < 180 || max < 55 || max > 248) continue;
          if ((max - min) / max < 0.2) { neutral.count++; neutral.r += r; neutral.g += g; neutral.b += b; continue; }
          const hue = Math.round((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI + 360) % 360);
          const bucket = Math.floor(hue / 15);
          const color = colors.get(bucket) ?? { count: 0, r: 0, g: 0, b: 0 };
          color.count++; color.r += r; color.g += g; color.b += b; colors.set(bucket, color);
        }
        const dominant = [...colors.values()].sort((a, b) => b.count - a.count)[0];
        const sampled = dominant ?? (neutral.count ? neutral : null);
        if (active && sampled) setBrandAccent(`${Math.round(sampled.r / sampled.count)}, ${Math.round(sampled.g / sampled.count)}, ${Math.round(sampled.b / sampled.count)}`);
      } catch {
        if (active) setBrandAccent("220, 228, 222");
      }
    };
    image.onerror = () => { if (active) setBrandAccent("220, 228, 222"); };
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
          {brand?.logoUrl && <Image className="poster-brand-emblem" src={brand.logoUrl} alt="" width={500} height={500} unoptimized />}
          <HeadphonePortrait />
          {!brand?.logoUrl && <div className="poster-brand-emblem-fallback" aria-hidden="true"><span>{brandName}</span></div>}
          <div className="poster-content">
            <div className="poster-status">{delivery.status === "READY" ? "PRIVATE STUDIO DELIVERY" : delivery.status === "FAILED" ? "PACKAGE BEING REVIEWED" : "YOUR PROJECT IS BEING PREPARED"}</div>
            <h1 className="poster-heading">{delivery.status === "READY" ? "YOUR MUSIC IS READY." : delivery.status === "FAILED" ? "DELIVERY IN PROGRESS." : "YOUR PROJECT IS ALMOST READY."}</h1>
            {delivery.previewEnabled ? <AudioPreview token={token} fileName={delivery.previewFileName} artistName={delivery.clientName} /> : <div className="poster-no-preview">Your studio preview is not enabled for this delivery.</div>}
            <div className="poster-action-area">{downloadButton}{downloadError && <p className="poster-feedback poster-error" role="alert">{downloadError}</p>}{feedback && <p className="poster-feedback" role="status">{feedback}</p>}</div>
          </div>
          <div className="poster-meta"><span>{delivery.serviceType}</span><span>{new Date(delivery.deliveryDate).toLocaleDateString()}</span>{delivery.expiresAt && <span>Link expires {new Date(delivery.expiresAt).toLocaleDateString()}</span>}</div>
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
