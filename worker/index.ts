import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import archiver from "archiver";
import * as yauzl from "yauzl";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { safeArchiveFolder, safeFilename, type FileCategory } from "../lib/validation";
import { startHealthServer } from "./health";

loadEnvConfig(process.cwd());
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the worker environment.");
const db = createClient<any>(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const buckets = {
  originals: process.env.SUPABASE_BUCKET_ORIGINALS || "delivery-originals",
  archives: process.env.SUPABASE_BUCKET_ARCHIVES || "delivery-archives",
  previews: process.env.SUPABASE_BUCKET_PREVIEWS || "delivery-previews",
};
const pollMs = Math.max(1000, Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000));
const maxAttempts = Math.max(1, Number(process.env.MAX_PROCESSING_ATTEMPTS ?? 3));
const staleSeconds = Math.max(60, Number(process.env.WORKER_STALE_SECONDS ?? 900));
const notesText = (delivery: { track_title: string; service_type: string; message: string | null; reference_number: string }, clientName: string) => [
  "SAXN MUSIC DELIVERY NOTES", "=========================", `Track: ${delivery.track_title}`, `Service: ${delivery.service_type}`,
  `Client: ${clientName}`, `Reference: ${delivery.reference_number}`, `Delivery date: ${new Date().toISOString().slice(0, 10)}`, "",
  delivery.message ? `Message from the studio:\n${delivery.message}` : "Prepared by SAXN Music Producer & Audio Engineer, Ghana.", "",
].join("\n");

async function downloadToFile(storagePath: string, destination: string) {
  const { data, error } = await db.storage.from(buckets.originals).createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) throw new Error("Could not authorize a private source file.");
  const response = await fetch(data.signedUrl, { cache: "no-store" });
  if (!response.ok || !response.body) throw new Error(`Private source download failed with status ${response.status}.`);
  await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), createWriteStream(destination, { flags: "wx" }));
}

function validateArchive(zipPath: string, expected: Set<string>) {
  return new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (openError, zip) => {
      if (openError || !zip) { reject(openError ?? new Error("ZIP archive could not be opened.")); return; }
      const actual = new Set<string>(); let settled = false;
      const fail = (error: Error) => { if (settled) return; settled = true; zip.close(); reject(error); };
      zip.on("error", fail);
      zip.on("end", () => {
        if (settled) return; settled = true;
        const missing = [...expected].filter((name) => !actual.has(name));
        if (missing.length) reject(new Error(`ZIP validation failed: ${missing.length} expected entries are missing.`)); else resolve();
      });
      zip.on("entry", (entry) => {
        const name = entry.fileName.replace(/\\/g, "/");
        if (name.startsWith("/") || name.split("/").some((segment: string) => segment === ".." || segment === "")) { fail(new Error("ZIP contains an unsafe archive path.")); return; }
        if (actual.has(name)) { fail(new Error("ZIP contains duplicate archive entry names.")); return; }
        actual.add(name);
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { fail(streamError ?? new Error("ZIP entry could not be read.")); return; }
          stream.on("error", fail); stream.on("end", () => { if (!settled) zip.readEntry(); }); stream.resume();
        });
      });
      zip.readEntry();
    });
  });
}

async function uploadPrivateObject(filePath: string, targetBucket: string, storagePath: string, contentType: string) {
  const size = (await stat(filePath)).size;
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(createReadStream(filePath), {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 8000, 15000],
      headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey!, "x-upsert": "false" },
      metadata: { bucketName: targetBucket, objectName: storagePath, contentType, cacheControl: "3600" },
      uploadSize: size, chunkSize: 6 * 1024 * 1024, uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
      onError: reject, onSuccess: () => resolve(),
    });
    upload.start();
  });
  return size;
}

function transcodeWavToMp3(sourcePath: string, targetPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const command = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
    let child: ReturnType<typeof spawn>;
    try { child = spawn(command, ["-y", "-hide_banner", "-loglevel", "error", "-i", sourcePath, "-vn", "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", targetPath], { stdio: ["ignore", "ignore", "ignore"] }); }
    catch { resolve(false); return; }
    child.once("error", () => resolve(false));
    child.once("close", async (code) => {
      if (code !== 0) { resolve(false); return; }
      try { resolve((await stat(targetPath)).size > 0); } catch { resolve(false); }
    });
  });
}

async function processJob(job: { job_id: string; delivery_id: string; attempts: number }) {
  const workdir = await mkdtemp(join(tmpdir(), `saxn-${job.job_id}-`));
  let archivePath = ""; let remotePath = ""; let newPreviewPath = ""; let completed = false;
  let previousPreviewPath: string | null = null;
  try {
    const { data: deliveryRow, error: deliveryError } = await db.from("deliveries").select("id,track_title,service_type,message,status,reference_number,client_id,preview_enabled,preview_file_id,preview_storage_path,preview_size,expires_at").eq("id", job.delivery_id).maybeSingle();
    if (deliveryError || !deliveryRow) throw new Error("Delivery data could not be loaded.");
    const [clientResult, filesResult] = await Promise.all([
      db.from("clients").select("name").eq("id", deliveryRow.client_id).maybeSingle(),
      db.from("delivery_files").select("id,filename,original_filename,category,storage_path,file_size,mime_type").eq("delivery_id", deliveryRow.id),
    ]);
    if (clientResult.error || filesResult.error) throw new Error("Delivery client or file records could not be loaded.");
    const delivery = { ...deliveryRow, clients: clientResult.data, delivery_files: filesResult.data ?? [] };
    if (delivery.status === "REVOKED" || delivery.status === "EXPIRED" || (delivery.expires_at && Date.parse(delivery.expires_at) <= Date.now())) throw new Error("Delivery was revoked or expired before packaging.");
    if (!delivery.delivery_files.length) throw new Error("No delivery files are registered.");
    const archiveFilename = `${safeFilename(delivery.track_title)}_SAXN.zip`;
    const folderPath = join(workdir, "sources"); await mkdir(folderPath, { recursive: true });
    const expected = new Set<string>(); const inputFiles: Array<{ localPath: string; archiveName: string }> = []; const localFiles = new Map<string, string>();
    for (let index = 0; index < delivery.delivery_files.length; index += 1) {
      const file = delivery.delivery_files[index]; const category = safeArchiveFolder(file.category) as FileCategory; const safeName = safeFilename(file.filename);
      const relative = posix.join(category, safeName);
      if (relative.startsWith("/") || relative.split("/").includes("..")) throw new Error("Unsafe archive entry rejected.");
      const localPath = join(folderPath, `${index}-${randomUUID()}`); await downloadToFile(file.storage_path, localPath);
      inputFiles.push({ localPath, archiveName: relative }); expected.add(relative); localFiles.set(file.id, localPath);
    }
    const notesPath = join(workdir, "DELIVERY_NOTES.txt"); await writeFile(notesPath, notesText(delivery, delivery.clients?.name ?? "Client"), "utf8"); expected.add("DELIVERY_NOTES.txt");
    archivePath = join(workdir, "delivery.zip");
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(archivePath, { flags: "wx" }); const archive = archiver("zip", { zlib: { level: 6 } }); let finished = false;
      const fail = (error: Error) => { if (finished) return; finished = true; output.destroy(); reject(error); };
      output.on("close", () => { if (!finished) { finished = true; resolve(); } }); output.on("error", fail); archive.on("error", fail);
      archive.on("warning", (error) => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; fail(error); }); archive.pipe(output);
      inputFiles.forEach((file) => archive.file(file.localPath, { name: file.archiveName })); archive.file(notesPath, { name: "DELIVERY_NOTES.txt" }); archive.finalize().catch(fail);
    });
    await validateArchive(archivePath, expected);
    const outputSize = (await stat(archivePath)).size;
    const { data: storagePolicy } = await db.from("storage_settings").select("max_delivery_bytes").limit(1).maybeSingle();
    if (outputSize > Number(storagePolicy?.max_delivery_bytes ?? process.env.MAX_DELIVERY_BYTES ?? 10 * 1024 ** 3)) throw new Error("Validated ZIP exceeds the configured per-delivery storage limit.");
    remotePath = `${delivery.id}/${job.job_id}_${safeFilename(delivery.track_title)}.zip`; await uploadPrivateObject(archivePath, buckets.archives, remotePath, "application/zip");

    previousPreviewPath = delivery.preview_storage_path ?? null;
    let previewPath: string | null = delivery.preview_enabled ? previousPreviewPath : null;
    let previewSize: number | null = delivery.preview_enabled ? Number(delivery.preview_size ?? 0) || null : null;
    const previewSource = delivery.preview_file_id ? delivery.delivery_files.find((file) => file.id === delivery.preview_file_id) : null;
    if (delivery.preview_enabled && previewSource && /wav/i.test(previewSource.mime_type)) {
      const sourcePath = localFiles.get(previewSource.id);
      if (sourcePath) {
        const generatedPath = join(workdir, "preview.mp3");
        if (await transcodeWavToMp3(sourcePath, generatedPath)) {
          const candidatePath = `${delivery.id}/${job.job_id}_preview.mp3`;
          try { previewSize = await uploadPrivateObject(generatedPath, buckets.previews, candidatePath, "audio/mpeg"); previewPath = candidatePath; newPreviewPath = candidatePath; }
          catch { await db.storage.from(buckets.previews).remove([candidatePath]).catch(() => undefined); }
        }
      }
    }
    const { data: completeResult, error: completedError } = await db.rpc("complete_processing_job", {
      p_job_id: job.job_id, p_zip_path: remotePath, p_zip_filename: archiveFilename, p_zip_size: outputSize,
      p_preview_path: previewPath, p_preview_size: previewSize,
    });
    if (completedError || completeResult !== true) throw new Error("Validated archive could not be finalized; delivery was not marked READY.");
    completed = true;
    if (previousPreviewPath && previousPreviewPath !== previewPath) await db.storage.from(buckets.previews).remove([previousPreviewPath]).catch(() => undefined);
    console.info(`Packaged delivery ${delivery.id} (${expected.size} entries, ${outputSize} bytes).`);
  } catch (cause) {
    if (remotePath) await db.storage.from(buckets.archives).remove([remotePath]).catch(() => undefined);
    if (newPreviewPath) await db.storage.from(buckets.previews).remove([newPreviewPath]).catch(() => undefined);
    const message = cause instanceof Error ? cause.message.slice(0, 800) : "Unexpected packaging failure.";
    const { error } = await db.rpc("fail_processing_job", { p_job_id: job.job_id, p_error: message, p_max_attempts: maxAttempts });
    if (error) console.error(`Could not update failure status for job ${job.job_id}.`);
    console.error(`Packaging job ${job.job_id} failed: ${message}`);
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function sleep(ms: number) { await new Promise((resolve) => setTimeout(resolve, ms)); }
let stopping = false;
process.on("SIGINT", () => { stopping = true; }); process.on("SIGTERM", () => { stopping = true; });
async function main() {
  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 8787); startHealthServer(healthPort);
  console.info(`SAXN packaging worker online; health port ${healthPort}.`);
  while (!stopping) {
    try {
      await db.rpc("requeue_stale_processing_jobs", { p_stale_seconds: staleSeconds, p_max_attempts: maxAttempts });
      const { data, error } = await db.rpc("claim_processing_job"); if (error) throw error;
      const job = Array.isArray(data) ? data[0] : null; if (job) await processJob(job); else await sleep(pollMs);
    } catch (error) { console.error("Worker polling failed; retrying after a delay.", error instanceof Error ? error.message : "unknown error"); await sleep(Math.max(pollMs, 5000)); }
  }
  console.info("SAXN packaging worker stopped cleanly.");
}
void main();
