import { NextResponse } from "next/server";

export class ApiError extends Error { constructor(public status: number, message: string, public code = "REQUEST_FAILED") { super(message); } }
export function jsonError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  console.error("Request failed", error instanceof Error ? error.message : "unknown error");
  return NextResponse.json({ error: "The request could not be completed.", code: "INTERNAL_ERROR" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
export async function readJson<T>(request: Request): Promise<T> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) throw new ApiError(415, "Send a JSON request body.", "UNSUPPORTED_MEDIA_TYPE");
  try { return await request.json() as T; } catch { throw new ApiError(400, "The request body is not valid JSON.", "INVALID_JSON"); }
}
export function assertSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin"); const referer = request.headers.get("referer");
  if (!origin) throw new ApiError(403, "A same-origin browser request is required.", "ORIGIN_REQUIRED");
  let parsedOrigin: URL; try { parsedOrigin = new URL(origin); } catch { throw new ApiError(403, "Invalid request origin.", "INVALID_ORIGIN"); }
  const localHost = parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1" || parsedOrigin.hostname === "[::1]";
  if (parsedOrigin.protocol !== "https:" && !(parsedOrigin.protocol === "http:" && localHost)) throw new ApiError(403, "HTTPS is required for this action.", "HTTPS_REQUIRED");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") throw new ApiError(403, "Cross-origin form submissions are not allowed.", "CROSS_ORIGIN");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!fetchSite && host && parsedOrigin.host.toLowerCase() !== host.toLowerCase()) throw new ApiError(403, "Cross-origin form submissions are not allowed.", "CROSS_ORIGIN");
  if (referer) {
    try { if (new URL(referer).origin !== parsedOrigin.origin) throw new ApiError(403, "Cross-origin form submissions are not allowed.", "CROSS_ORIGIN"); }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(403, "Invalid request referrer.", "INVALID_REFERER"); }
  }
}
export function noStoreHeaders() { return { "Cache-Control": "no-store, private", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff" }; }
