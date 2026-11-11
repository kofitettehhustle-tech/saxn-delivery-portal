import test from "node:test";
import assert from "node:assert/strict";
import { hashDeliveryToken, newDeliveryToken, tokenLooksValid } from "../lib/security";
import { createDeliveryUrl } from "../lib/publicUrl";
import { allowedMime, safeArchiveFolder, safeFilename, formatBytes } from "../lib/validation";

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

test("filenames are flattened and path traversal is removed", () => {
  assert.equal(safeFilename("../../takeover.wav").includes("/"), false);
  assert.equal(safeFilename("C:\\mix\\final.wav").includes("\\"), false);
  assert.equal(safeArchiveFolder("../../root"), "04_EXTRAS");
});

test("file allowlist checks extension and MIME, and output sizes are stable", () => {
  assert.equal(allowedMime("mix.wav", "audio/wav"), true);
  assert.equal(allowedMime("readme.exe", "application/octet-stream"), false);
  assert.equal(formatBytes(1024), "1.0 KB");
});
