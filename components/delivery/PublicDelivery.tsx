"use client";

import { CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

type Delivery = { id: string; clientName: string; trackTitle: string; serviceType: string; message: string | null; status: string; zipFilename: string | null; zipSize: number | null; archives: { id: string; filename: string; fileSize: number }[]; previewEnabled: boolean; previewFileName: string | null; previewMimeType: string | null; previewFiles: { filename: string; mimeType: string; category: string }[]; deliveryDate: string; referenceNumber: string; expiresAt: string | null; requiresPassword: boolean; passwordVerified: boolean };
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

function ArtworkCarousel({ files, selected, onSelect }: { files: Delivery["previewFiles"]; selected: number; onSelect: (index: number) => void }) {
  const activeFiles = files.length ? files : [{ filename: "Audio preview", mimeType: "audio/mpeg", category: "" }];
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (!window.matchMedia("(max-width: 740px)").matches) return;
    const carousel = carouselRef.current;
    const card = cardRefs.current[selected];
    if (!carousel || !card) return;
    const carouselRect = carousel.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    carousel.scrollTo({
      left: carousel.scrollLeft + cardRect.left - carouselRect.left - (carousel.clientWidth - cardRect.width) / 2,
      behavior: "smooth",
    });
  }, [selected, activeFiles.length]);
  return <div ref={carouselRef} className={`poster-carousel${activeFiles.length === 1 ? " poster-carousel-single" : ""}`} aria-label="Delivery files">
    {activeFiles.map((file, index) => {
      let offset = index - selected;
      if (activeFiles.length > 2) {
        if (offset > activeFiles.length / 2) offset -= activeFiles.length;
        if (offset < -activeFiles.length / 2) offset += activeFiles.length;
      }
      const visible = Math.abs(offset) <= 2;
      const offsetScale = Math.max(0.7, 1 - Math.abs(offset) * 0.13);
      return <button
        ref={(element) => { cardRefs.current[index] = element; }}
        className={`poster-art-card${offset === 0 ? " is-active" : ""}${visible ? "" : " is-out-of-range"}`}
        key={`${file.filename}-${index}`}
        type="button"
        style={{ transform: `translate(calc(-50% + ${offset * 135}px), -50%) scale(${offsetScale})`, opacity: Math.max(0.18, 1 - Math.abs(offset) * 0.22), zIndex: 5 - Math.abs(offset) } as CSSProperties}
        aria-label={`Show ${file.filename}`}
        aria-pressed={offset === 0}
        onClick={() => onSelect(index)}
      >
        <span className="poster-art-graphic" aria-hidden="true"><span className="poster-art-symbol">♪</span></span>
        <span className="poster-art-caption"><strong>{file.filename.replace(/\.[^.]+$/, "")}</strong><small>{file.category.replace(/^\d+_/, "").replace(/_/g, " ") || file.mimeType.split("/")[0]}</small></span>
      </button>;
    })}
    {activeFiles.length > 1 && <div className="poster-carousel-controls">
      <button type="button" aria-label="Previous file" onClick={() => onSelect((selected - 1 + activeFiles.length) % activeFiles.length)}>‹</button>
      <span>{selected + 1} / {activeFiles.length}</span>
      <button type="button" aria-label="Next file" onClick={() => onSelect((selected + 1) % activeFiles.length)}>›</button>
    </div>}
  </div>;
}

function AudioPreview({ token, fileName, artistName }: { token: string; fileName: string | null; artistName: string }) {
  const [audioUrl, setAudioUrl] = useState(""); const [audio, setAudio] = useState<HTMLAudioElement | null>(null); const [playing, setPlaying] = useState(false); const [current, setCurrent] = useState(0); const [duration, setDuration] = useState(0); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { const element = new Audio(); setAudio(element); element.preload = "metadata"; const time = () => setCurrent(element.currentTime); const loaded = () => setDuration(Number.isFinite(element.duration) ? element.duration : 0); const ended = () => setPlaying(false); const failed = () => setError("Preview audio could not be played."); element.addEventListener("timeupdate", time); element.addEventListener("loadedmetadata", loaded); element.addEventListener("ended", ended); element.addEventListener("error", failed); return () => { element.pause(); element.removeEventListener("timeupdate", time); element.removeEventListener("loadedmetadata", loaded); element.removeEventListener("ended", ended); element.removeEventListener("error", failed); }; }, []);
  async function toggle() { if (!audio) return; setError(""); if (!audioUrl) { setLoading(true); try { const response = await fetch(`/api/public/d/${token}/preview`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Preview is unavailable."); setAudioUrl(body.signedUrl); audio.src = body.signedUrl; await audio.play(); setPlaying(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview is unavailable."); } finally { setLoading(false); } return; } if (audio.paused) { try { await audio.play(); setPlaying(true); } catch { setError("Playback could not start. Try again."); } } else { audio.pause(); setPlaying(false); } }
  function seek(value: number) { if (!audio || !duration) return; audio.currentTime = value; setCurrent(value); }
  function skip(seconds: number) { if (!audio || !duration) return; seek(Math.max(0, Math.min(duration, audio.currentTime + seconds))); }
  const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  return <div className="poster-player">
    <button type="button" className="poster-skip" onClick={() => skip(-10)} aria-label="Back 10 seconds">↶<small>10</small></button>
    <div className="poster-player-center">
      <div className="poster-track-info"><div className="poster-track-mark" aria-hidden="true"><span>♫</span></div><div className="poster-track-copy"><div className="poster-track-title">{fileName || "Audio preview"}</div><div className="poster-track-artist">{artistName}</div></div></div>
      <input className="poster-seek" type="range" min={0} max={Math.max(duration, 0)} step={0.1} value={Math.min(current, duration)} onChange={(event) => seek(Number(event.target.value))} aria-label="Seek audio preview" style={{ "--seek-progress": `${duration ? current / duration * 100 : 0}%` } as CSSProperties} />
      <div className="poster-time-row"><span>{time(current)}</span><span>{time(duration)}</span></div>
    </div>
    <button type="button" className="poster-play" onClick={() => void toggle()} aria-label={playing ? "Pause preview" : "Play preview"} disabled={loading}>{loading ? "…" : playing ? "Ⅱ" : "▶"}</button>
    <button type="button" className="poster-skip" onClick={() => skip(10)} aria-label="Forward 10 seconds">↷<small>10</small></button>
    {error && <div className="poster-audio-error" role="alert">{error}</div>}
  </div>;
}

export function PublicDelivery({ token }: { token: string }) {
  const [payload, setPayload] = useState<Payload | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState(""); const [downloadError, setDownloadError] = useState("");
  const [selectedCard, setSelectedCard] = useState(0);
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
  async function download(archiveId?: string) { setBusy(true); setDownloadError(""); setFeedback("Requesting a secure download link…"); try { const query = archiveId ? `?archiveId=${encodeURIComponent(archiveId)}` : ""; const response = await fetch(`/api/public/d/${token}/download${query}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Download could not start."); setFeedback("Your secure download is starting."); window.location.assign(body.signedUrl); } catch (cause) { setFeedback(""); setDownloadError(cause instanceof Error ? cause.message : "Download could not start."); } finally { setBusy(false); } }
  const delivery = payload?.delivery; const brand = payload?.brand ?? null; const socials = brand?.socialLinks ?? {};
  useEffect(() => {
    const previewIndex = delivery?.previewFiles.findIndex((file) => file.filename === delivery.previewFileName) ?? -1;
    setSelectedCard(Math.max(previewIndex, 0));
  }, [delivery]);
  const socialEntries = Object.entries(socials).filter(([, url]) => typeof url === "string" && url.length > 0);
  const themeStyle = { "--brand-accent-rgb": "252, 147, 31" } as CSSProperties;
  const brandName = brand?.brandName || "SAXN";
  const downloadButtons = delivery?.status === "READY"
    ? delivery.archives.length
      ? delivery.archives.map((archive) => <button key={archive.id} className="poster-download" onClick={() => void download(archive.id)} disabled={busy}>Download {archive.filename}</button>)
      : <button className="poster-download" onClick={() => void download()} disabled={busy}>{busy ? "Preparing secure download…" : `Download ${delivery.zipFilename || "project ZIP"}`}</button>
    : <div className="poster-download-notice" role="status">{delivery?.status === "FAILED" ? "The studio is reviewing your package." : "Your private package is still being prepared."}</div>;
  return <div className="delivery-page delivery-poster-page" style={themeStyle}>
    {loading ? <main className="poster-state"><div className="empty-mark">⌁</div>Opening your private delivery…</main>
      : error ? <main className="poster-state"><section className="delivery-panel"><div className="eyebrow">Private access</div><h1 className="page-title" style={{ margin: "12px 0" }}>This link is unavailable.</h1><p className="muted">{error}</p><p className="quiet small">If you believe this is a mistake, contact the studio that shared it.</p></section></main>
      : payload?.locked ? <main className="poster-state"><section className="delivery-panel poster-password"><div className="eyebrow">Protected delivery</div><h1 className="page-title" style={{ margin: "11px 0" }}>Enter your access password.</h1><p className="muted">This private handoff is password protected.</p><form onSubmit={unlock} style={{ display: "grid", gap: 12, marginTop: 22 }}><label className="form-field"><span className="form-label">Delivery password</span><input className="input" type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="error-box" role="alert">{error}</div>}<button className="button button-primary" disabled={busy}>{busy ? "Checking…" : "Unlock delivery"}</button></form></section></main>
      : delivery ? <main className="poster-main">
        <section className="delivery-poster" style={themeStyle}>
          <header className="poster-brand-header">{brand?.logoUrl && <BrandLogo name={brandName} logoUrl={brand.logoUrl} />}<span>{brandName}</span></header>
          <ArtworkCarousel files={delivery.previewFiles ?? []} selected={selectedCard} onSelect={setSelectedCard} />
          <div className="poster-content">
            {delivery.previewEnabled ? <AudioPreview token={token} fileName={delivery.previewFileName || delivery.trackTitle} artistName={delivery.clientName} /> : <div className="poster-no-preview">Your studio preview is not enabled for this delivery.</div>}
            <div className="poster-action-area">{downloadButtons}{downloadError && <p className="poster-feedback poster-error" role="alert">{downloadError}</p>}{feedback && <p className="poster-feedback" role="status">{feedback}</p>}</div>
          </div>
          {delivery.message && <p className="poster-note">{delivery.message}</p>}
          <footer className="poster-footer">
            <div className="poster-social-links">
              {brand?.contactEmail && <a href={`mailto:${brand.contactEmail}`} className="poster-connect-link">Contact</a>}
              {socialEntries.map(([name, url]) => <a className="poster-connect-link" key={name} href={url} target="_blank" rel="noreferrer" aria-label={name}><SocialIcon name={name} /></a>)}
            </div>
            <div className="poster-artist-lockup"><strong>{delivery.clientName}</strong></div>
          </footer>
        </section>
      </main> : null}
  </div>;
}
