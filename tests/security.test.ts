import test from "node:test";
import assert from "node:assert/strict";
import { hashDeliveryToken, newDeliveryToken, tokenLooksValid } from "../lib/security";
import { allowedMime, safeArchiveFolder, safeFilename, formatBytes } from "../lib/validation";

test("delivery tokens are unpredictable base64url bearer credentials with stable hashes", () => {
  const first = newDeliveryToken(); const second = newDeliveryToken();
  assert.notEqual(first, second); assert.equal(tokenLooksValid(first), true); assert.equal(hashDeliveryToken(first).length, 64); assert.notEqual(hashDeliveryToken(first), first);
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
