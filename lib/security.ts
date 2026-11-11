import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requiredEnv } from "./supabase/config";

export function newDeliveryToken(): string { return randomBytes(32).toString("base64url"); }
export function hashDeliveryToken(token: string): string { return createHash("sha256").update(token, "utf8").digest("hex"); }
export function tokenLooksValid(token: string): boolean { return /^[A-Za-z0-9_-]{40,60}$/.test(token); }

export function passwordGateCookieValue(tokenHash: string, expiresAt: number): string {
  const body = `${tokenHash}.${expiresAt}`;
  const signature = createHmac("sha256", requiredEnv("DELIVERY_COOKIE_SECRET")).update(body).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function verifyPasswordGateCookie(tokenHash: string, value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf("."); if (dot < 1) return false;
  const expiresAt = Number(value.slice(0, dot)); const signature = value.slice(dot + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now() || !/^[A-Za-z0-9_-]{40,60}$/.test(signature)) return false;
  const body = `${tokenHash}.${expiresAt}`; const expected = createHmac("sha256", requiredEnv("DELIVERY_COOKIE_SECRET")).update(body).digest(); const received = Buffer.from(signature, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
export function hashRateLimitKey(scope: string, address: string): string { return createHmac("sha256", requiredEnv("DELIVERY_COOKIE_SECRET")).update(`${scope}:${address}`).digest("hex"); }
