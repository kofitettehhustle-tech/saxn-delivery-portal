import test from "node:test";
import assert from "node:assert/strict";
import { hashDeliveryToken, newDeliveryToken, tokenLooksValid } from "../lib/security";
import { createDeliveryUrl } from "../lib/publicUrl";
import { allowedMime, safeArchiveFolder, safeArchivePath, safeFilename, formatBytes } from "../lib/validation";
import { supabaseStorageUploadEndpoint } from "../lib/supabase/config";
import { MAX_ARCHIVE_SIZE_BYTES, planDeliveryArchives } from "../lib/archivePackaging";
import { createDeliveryShareUrl } from "../lib/shortio";

test("delivery tokens are unpredictable base64url bearer credentials with stable hashes", () => {
  const first = newDeliveryToken(); const second = newDeliveryToken();
  assert.notEqual(first, second); assert.equal(tokenLooksValid(first), true); assert.equal(hashDeliveryToken(first).length, 64); assert.notEqual(hashDeliveryToken(first), first);
});

test("private delivery URLs use the production domain on preview deployments", () => {
  assert.equal(
    createDeliveryUrl("private-token", "https://project-git-main.vercel.app/api", {
      VERCEL_PROJECT_PRODUCTION_URL: "project.vercel.app",
    }),
    "https://project.vercel.app/d/private-token",
  );
  assert.equal(
    createDeliveryUrl("private-token", "http://localhost:3000/api"),
    "http://localhost:3000/d/private-token",
  );
  assert.throws(() =>
    createDeliveryUrl("private-token", "https://preview.vercel.app", {
      PUBLIC_APP_URL: "http://public.example.com",
    }),
  );
});

test("delivery links use Short.io automatically when configured", async () => {
  const captured: { request?: { url: string; authorization: string; body: { originalURL: string; domain: string; allowDuplicates: boolean } } } = {};
  const result = await createDeliveryShareUrl(
    "private-token",
    "https://preview.vercel.app/api",
    { VERCEL_PROJECT_PRODUCTION_URL: "project.vercel.app", SHORTIO_API_KEY: "server-secret", SHORTIO_DOMAIN: "go.example.com" },
    async (url, init) => {
      captured.request = {
        url: String(url),
        authorization: new Headers(init?.headers).get("Authorization") ?? "",
        body: JSON.parse(String(init?.body)),
      };
      return new Response(JSON.stringify({ shortURL: "https://go.example.com/abc123" }), { status: 200 });
    },
  );
  assert.equal(result.url, "https://go.example.com/abc123");
  assert.equal(result.shortened, true);
  assert.equal("shorteningWarning" in result, false);
  assert.equal(captured.request?.url, "https://api.short.io/links");
  assert.equal(captured.request?.authorization, "server-secret");
  assert.deepEqual(captured.request?.body, {
    originalURL: "https://project.vercel.app/d/private-token",
    domain: "go.example.com",
    allowDuplicates: false,
  });
});

test("delivery links fall back to their canonical URL with a warning when Short.io is not configured", async () => {
  let called = false;
  const result = await createDeliveryShareUrl(
    "private-token",
    "https://preview.vercel.app/api",
    { VERCEL_PROJECT_PRODUCTION_URL: "project.vercel.app" },
    async () => {
      called = true;
      return new Response(null, { status: 500 });
    },
  );
  assert.equal(result.url, "https://project.vercel.app/d/private-token");
  assert.equal(result.shortened, false);
  assert.match(result.shorteningWarning ?? "", /SHORTIO_API_KEY and SHORTIO_DOMAIN/);
  assert.equal(called, false);
});

test("delivery links fall back to the full URL with a warning when Short.io rejects a request", async () => {
  const result = await createDeliveryShareUrl(
    "private-token",
    "https://project.vercel.app/api",
    { SHORTIO_API_KEY: "server-secret", SHORTIO_DOMAIN: "go.example.com" },
    async () => new Response(null, { status: 401 }),
  );
  assert.equal(result.url, "https://project.vercel.app/d/private-token");
  assert.equal(result.shortened, false);
  assert.match(result.shorteningWarning ?? "", /HTTP 401/);
});

test("delivery links do not accept unexpected Short.io domains", async () => {
  const result = await createDeliveryShareUrl(
    "private-token",
    "https://project.vercel.app/api",
    { SHORTIO_API_KEY: "server-secret", SHORTIO_DOMAIN: "go.example.com" },
    async () => new Response(JSON.stringify({ shortURL: "https://attacker.example/abc123" }), { status: 200 }),
  );
  assert.equal(result.url, "https://project.vercel.app/d/private-token");
  assert.equal(result.shortened, false);
  assert.match(result.shorteningWarning ?? "", /unexpected domain/);
});

test("resumable uploads use the direct Supabase Storage hostname", () => {
  assert.equal(
    supabaseStorageUploadEndpoint("https://project-ref.supabase.co"),
    "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
  );
  assert.equal(
    supabaseStorageUploadEndpoint("http://127.0.0.1:54321"),
    "http://127.0.0.1:54321/storage/v1/upload/resumable",
  );
});

test("filenames are flattened and path traversal is removed", () => {
  assert.equal(safeFilename("../../takeover.wav").includes("/"), false);
  assert.equal(safeFilename("C:\\mix\\final.wav").includes("\\"), false);
  assert.equal(safeArchiveFolder("../../root"), "05_OTHER");
});

test("ZIP paths group WAV and MP3 only for finished tracks and instrumentals", () => {
  assert.equal(safeArchivePath("01_FINISHED_TRACKS", "song.wav"), "01_FINISHED_TRACKS/WAV/song.wav");
  assert.equal(safeArchivePath("01_FINISHED_TRACKS", "song.mp3"), "01_FINISHED_TRACKS/MP3/song.mp3");
  assert.equal(safeArchivePath("02_INSTRUMENTALS", "beat.wav"), "02_INSTRUMENTALS/WAV/beat.wav");
  assert.equal(safeArchivePath("03_PERFORMANCE_TRACKS", "performance.mp3"), "03_PERFORMANCE_TRACKS/performance.mp3");
  assert.equal(safeArchivePath("04_VOCAL_TRACKS", "vocals.wav"), "04_VOCAL_TRACKS/vocals.wav");
  assert.equal(safeArchivePath("01_FINISHED_TRACKS", "notes.pdf"), "01_FINISHED_TRACKS/notes.pdf");
  assert.equal(safeArchivePath("../../root", "song.wav"), "05_OTHER/song.wav");
});

test("delivery archives keep all MP3s together and split WAVs per track", () => {
  const plans = planDeliveryArchives("Nyame", [
    { filename: "finished.mp3", category: "01_FINISHED_TRACKS", file_size: 2_400_000 },
    { filename: "instrumental.mp3", category: "02_INSTRUMENTALS", file_size: 2_400_000 },
    { filename: "finished.wav", category: "01_FINISHED_TRACKS", file_size: 41_300_000 },
    { filename: "instrumental.wav", category: "02_INSTRUMENTALS", file_size: 41_300_000 },
  ]);
  assert.equal(plans.length, 3);
  assert.deepEqual(plans[0].files.map((file) => file.filename), ["finished.mp3", "instrumental.mp3"]);
  assert.equal(plans[0].filename, "Nyame_MP3.zip");
  assert.deepEqual(plans.slice(1).map((plan) => plan.files.length), [1, 1]);
  assert.ok(41_300_000 < MAX_ARCHIVE_SIZE_BYTES);
});

test("oversized source files fail archive planning explicitly", () => {
  assert.throws(() => planDeliveryArchives("Nyame", [
    { filename: "large.wav", category: "01_FINISHED_TRACKS", file_size: MAX_ARCHIVE_SIZE_BYTES + 1 },
  ]), /too large to fit/);
});

test("file allowlist checks extension and MIME, and output sizes are stable", () => {
  assert.equal(allowedMime("mix.wav", "audio/wav"), true);
  assert.equal(allowedMime("readme.exe", "application/octet-stream"), false);
  assert.equal(formatBytes(1024), "1.0 KB");
});
