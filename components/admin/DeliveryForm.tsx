"use client";

import { FormEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { Upload } from "tus-js-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabasePublicConfig, supabaseStorageUploadEndpoint } from "@/lib/supabase/config";
import { fileCategories, serviceTypes, formatBytes, type FileCategory } from "@/lib/validation";

type DraftFile = { id: string; file: File; filename: string; category: string; progress: number; error: string; uploaded: boolean };
const categoryLabels: Record<FileCategory, string> = {
  "01_FINISHED_TRACKS": "Finished Tracks",
  "02_INSTRUMENTALS": "Instrumentals",
  "03_PERFORMANCE_TRACKS": "Performance Tracks",
  "04_VOCAL_TRACKS": "Vocal Tracks",
  "05_OTHER": "Other",
};
const audioTypes = ["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3", "application/octet-stream"];
function isPreviewAudio(file: DraftFile) { const extension = file.file.name.toLowerCase().split(".").pop() ?? ""; return ["wav", "mp3"].includes(extension) && audioTypes.includes(file.file.type || "application/octet-stream"); }

export function DeliveryForm() {
  const [files, setFiles] = useState<DraftFile[]>([]); const [clients, setClients] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [approvedExtensions, setApprovedExtensions] = useState<string[]>([]);
  const [existingClient, setExistingClient] = useState(""); const [clientName, setClientName] = useState(""); const [clientEmail, setClientEmail] = useState(""); const [trackTitle, setTrackTitle] = useState(""); const [serviceType, setServiceType] = useState<string>(serviceTypes[0]); const [message, setMessage] = useState("");
  const [expiration, setExpiration] = useState("30"); const [customExpiresAt, setCustomExpiresAt] = useState(""); const [password, setPassword] = useState(""); const [previewEnabled, setPreviewEnabled] = useState(false); const [previewFileIndex, setPreviewFileIndex] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [deliveryId, setDeliveryId] = useState(""); const [privateLink, setPrivateLink] = useState(""); const [dragging, setDragging] = useState(false);
  const totalBytes = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  useEffect(() => { void Promise.all([fetch("/api/admin/clients", { cache: "no-store" }), fetch("/api/admin/storage", { cache: "no-store" })]).then(async ([clientsResponse, storageResponse]) => { const [clientBody, storageBody] = await Promise.all([clientsResponse.json(), storageResponse.json()]); if (clientsResponse.ok) setClients(clientBody.clients); if (storageResponse.ok) setApprovedExtensions(storageBody.settings.approved_extra_extensions ?? []); }).catch(() => undefined); }, []);
  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list); const next = incoming.map((file) => ({ id: crypto.randomUUID(), file, filename: file.name, category: "05_OTHER", progress: 0, error: "", uploaded: false }));
    setFiles((current) => [...current, ...next].slice(0, 100)); setError("");
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); }
  function patchFile(id: string, values: Partial<DraftFile>) { setFiles((current) => current.map((item) => item.id === id ? { ...item, ...values } : item)); }

  function uploadTus(file: File, bucket: string, path: string, onProgress: (percent: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const start = async () => {
        try {
          const config = supabasePublicConfig(); if (!config) throw new Error("Supabase public configuration is missing.");
          const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
          if (!session?.access_token) throw new Error("Your admin session expired. Sign in again before uploading.");
          const upload = new Upload(file, {
            endpoint: supabaseStorageUploadEndpoint(config.url), retryDelays: [0, 2000, 5000, 10000],
            headers: { authorization: `Bearer ${session.access_token}`, apikey: config.anonKey, "x-upsert": "false" },
            metadata: { bucketName: bucket, objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
            chunkSize: 6 * 1024 * 1024, uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
            onError: reject, onProgress: (sent, total) => onProgress(total ? Math.round(sent / total * 100) : 0), onSuccess: () => resolve(),
          });
          const previous = await upload.findPreviousUploads(); if (previous.length) upload.resumeFromPreviousUpload(previous[0]); upload.start();
        } catch (cause) { reject(cause); }
      };
      void start();
    });
  }

  async function uploadPending(currentId: string, id: string, index: number) {
    const draft = files.find((item) => item.id === id); if (!draft) return;
    patchFile(id, { error: "", progress: 0 });
    try {
      const auth = await fetch(`/api/admin/deliveries/${currentId}/upload`, { cache: "no-store" }); const authBody = await auth.json();
      if (!auth.ok) throw new Error(authBody.error || "Could not authorize upload.");
      const slot = authBody.files[index]; if (!slot) throw new Error("The server did not return an upload slot for this file.");
      await uploadTus(draft.file, slot.bucket, slot.storagePath, (progress) => patchFile(id, { progress })); patchFile(id, { progress: 100, uploaded: true });
    } catch (cause) { patchFile(id, { error: cause instanceof Error ? cause.message : "Upload failed." }); throw cause; }
  }

  async function uploadAndPackage(currentId: string) {
    const pending = files.map((item, index) => ({ item, index })).filter(({ item }) => !item.uploaded);
    for (const { item, index } of pending) await uploadPending(currentId, item.id, index);
    const verified = await fetch(`/api/admin/deliveries/${currentId}/upload`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const verifiedBody = await verified.json(); if (!verified.ok) throw new Error(verifiedBody.error || "Upload verification failed.");
    setNotice(`${verifiedBody.fileCount} file${verifiedBody.fileCount === 1 ? "" : "s"} verified. Starting ZIP packaging…`);
    const response = await fetch(`/api/admin/deliveries/${currentId}/package`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not queue packaging.");
    setPrivateLink(body.url || ""); setNotice("Packaging is queued in the background. The delivery link is active, but share it only after the archive reaches READY.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!files.length) { setError("Add at least one delivery file."); return; }
    if (!existingClient && !clientName.trim()) { setError("Select an existing client or enter a client name."); return; }
    if (previewEnabled && previewFileIndex === "") { setError("Select a WAV or MP3 preview file."); return; }
    if (expiration === "custom" && !customExpiresAt) { setError("Choose a custom expiry date."); return; }
    setBusy(true);
    try {
      const body = { clientId: existingClient || null, client: existingClient ? undefined : { name: clientName, email: clientEmail }, trackTitle, serviceType, message, previewEnabled, previewFileIndex: previewEnabled ? Number(previewFileIndex) : null, expiration, customExpiresAt: expiration === "custom" ? new Date(customExpiresAt).toISOString() : null, password: password || undefined, files: files.map((item) => ({ filename: item.filename, originalFilename: item.file.name, category: item.category, fileSize: item.file.size, mimeType: item.file.type || "application/octet-stream" })) };
      const response = await fetch("/api/admin/deliveries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not create delivery.");
      setDeliveryId(result.delivery.id); setNotice("Delivery record created. Uploading files securely…"); await uploadAndPackage(result.delivery.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Delivery setup failed."); }
    finally { setBusy(false); }
  }
  async function retryUploads() { if (!deliveryId) return; setBusy(true); setError(""); try { await uploadAndPackage(deliveryId); } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload retry failed."); } finally { setBusy(false); } }
  async function copyLink() { if (!privateLink) return; try { await navigator.clipboard.writeText(privateLink); setNotice("Private link copied. Share it only after ZIP status is READY."); } catch { setNotice(`Copy this private link: ${privateLink}`); } }

  return <><div className="page-heading"><div><div className="eyebrow">New project handoff</div><h1 className="page-title" style={{ marginTop: 8 }}>Create a delivery.</h1><p>Build a private handoff with an auditable upload and packaging flow.</p></div></div>
    {error && <div className="error-box" role="alert" style={{ marginBottom: 15 }}>{error}</div>}{notice && <div className="success-box" role="status" style={{ marginBottom: 15 }}>{notice}{privateLink && <button type="button" className="button button-small" onClick={() => void copyLink()} style={{ marginLeft: 12 }}>Copy private link</button>}</div>}
    <form onSubmit={submit} className="card card-pad" style={{ display: "grid", gap: 25 }}>
      <section><div className="eyebrow">01 / Client & project</div><div className="form-grid" style={{ marginTop: 14 }}>
        <label className="form-field"><span className="form-label">Existing client</span><select className="select" value={existingClient} onChange={(e) => setExistingClient(e.target.value)}><option value="">Create a new client…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.email ? ` · ${client.email}` : ""}</option>)}</select></label>
        {!existingClient && <><label className="form-field"><span className="form-label">Client name</span><input className="input" required maxLength={160} value={clientName} onChange={(e) => setClientName(e.target.value)} /></label><label className="form-field"><span className="form-label">Client email (optional)</span><input className="input" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></label></>}
        <label className="form-field"><span className="form-label">Track title</span><input className="input" required maxLength={180} value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} /></label><label className="form-field"><span className="form-label">Service type</span><select className="select" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>{serviceTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="form-field form-field-full"><span className="form-label">Personal message (optional)</span><textarea className="textarea" maxLength={4000} placeholder="A note for your client…" value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      </div></section>
      <section><div className="eyebrow">02 / Project files</div><p className="form-help" style={{ margin: "7px 0 14px" }}>Accepted: WAV, MP3, FLAC, AIFF and PDF, plus admin-approved formats. Finished Tracks and Instrumentals are sorted into WAV/MP3 folders automatically; other categories stay grouped without format subfolders. New files start in Other so they are not classified automatically.</p>
        <div className={`drop-zone${dragging ? " dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><div className="empty-mark">↑</div><div className="table-main">Drop files here</div><div className="muted small" style={{ margin: "5px 0 13px" }}>or choose files from this device</div><label className="button button-small">Browse files<input type="file" multiple accept={[".wav", ".mp3", ".flac", ".aif", ".aiff", ".pdf", ...approvedExtensions.map((extension) => `.${extension}`)].join(",")} hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }} /></label></div>
        {files.length > 0 && <div style={{ marginTop: 13 }}>{files.map((item) => <div className="file-row" key={item.id}><div style={{ minWidth: 0 }}><input className="input" aria-label="Package filename" value={item.filename} onChange={(e) => patchFile(item.id, { filename: e.target.value })} disabled={busy || Boolean(deliveryId)} /><div className="quiet" style={{ fontSize: 10, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis" }}>{item.file.name}{item.error ? ` · ${item.error}` : item.uploaded ? " · Uploaded" : ""}</div>{deliveryId && <div className="progress-track" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${item.progress}%` }} /></div>}</div><select className="select" aria-label="File category" value={item.category} onChange={(e) => patchFile(item.id, { category: e.target.value })} disabled={busy || Boolean(deliveryId)}>{fileCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select><span className="muted small file-size">{formatBytes(item.file.size)}</span><button className="icon-button" type="button" aria-label={`Remove ${item.file.name}`} disabled={busy || Boolean(deliveryId)} onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}>×</button></div>)}</div>}
        <div className="small muted" style={{ marginTop: 10 }}>{files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(totalBytes)} total</div>{deliveryId && files.some((file) => file.error) && <button type="button" className="button button-small" disabled={busy} onClick={() => void retryUploads()} style={{ marginTop: 12 }}>Retry failed uploads and continue</button>}
      </section>
      <section><div className="eyebrow">03 / Access & listening</div><div className="form-grid" style={{ marginTop: 14 }}>
        <label className="form-field"><span className="form-label">Link expiration</span><select className="select" value={expiration} onChange={(e) => setExpiration(e.target.value)}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="custom">Custom date</option><option value="never">Never expire until revoked</option></select></label>
        {expiration === "custom" && <label className="form-field"><span className="form-label">Custom expiry</span><input className="input" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0,10)} value={customExpiresAt} onChange={(e) => setCustomExpiresAt(e.target.value)} /></label>}
        <label className="form-field"><span className="form-label">Optional delivery password</span><input className="input" type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
        <div className="form-field"><span className="form-label">Audio preview</span><label className="checkbox-row"><input type="checkbox" checked={previewEnabled} onChange={(e) => { setPreviewEnabled(e.target.checked); if (e.target.checked && previewFileIndex === "") { const firstAudio = files.findIndex(isPreviewAudio); if (firstAudio >= 0) setPreviewFileIndex(String(firstAudio)); } }} /><span>Enable a protected preview player</span></label></div>
        {previewEnabled && <label className="form-field"><span className="form-label">Preview file (WAV/MP3)</span><select className="select" value={previewFileIndex} onChange={(e) => setPreviewFileIndex(e.target.value)}><option value="" disabled>Choose a WAV or MP3 file…</option>{files.map((file, index) => <option key={file.id} value={index} disabled={!isPreviewAudio(file)}>{file.filename}{isPreviewAudio(file) ? "" : " (not browser preview audio)"}</option>)}</select></label>}
      </div></section>
      <div className="form-actions"><button type="submit" className="button button-primary" disabled={busy || Boolean(deliveryId)}>{busy ? "Working…" : deliveryId ? "Packaging in progress" : "Create delivery & package files"}</button></div>
      <p className="quiet small" style={{ margin: 0 }}>Uploads use resumable TUS transfers where supported. ZIP processing runs in a separate worker and reports READY only after archive validation.</p>
    </form>
  </>;
}
