import "server-only";
import { ApiError } from "./http";
import { createSupabaseServiceClient } from "./supabase/service";

export type PrivateBucket = "originals" | "archives" | "previews" | "brand";
export interface PrivateStorageAdapter {
  createSignedUrl(bucket: PrivateBucket, path: string, seconds: number, download?: string): Promise<string>;
  removeObjects(bucket: PrivateBucket, paths: string[]): Promise<void>;
}
const envNames: Record<PrivateBucket, string> = { originals: "SUPABASE_BUCKET_ORIGINALS", archives: "SUPABASE_BUCKET_ARCHIVES", previews: "SUPABASE_BUCKET_PREVIEWS", brand: "SUPABASE_BUCKET_BRAND" };
const defaults: Record<PrivateBucket, string> = { originals: "delivery-originals", archives: "delivery-archives", previews: "delivery-previews", brand: "brand-assets" };
export function bucketName(bucket: PrivateBucket) { return process.env[envNames[bucket]]?.trim() || defaults[bucket]; }
function assertSafeObjectPath(path: string) {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some((segment) => !segment || segment === "." || segment === "..")) throw new ApiError(400, "Private object path is invalid.", "INVALID_OBJECT_PATH");
}
export function createSupabaseStorageAdapter(): PrivateStorageAdapter {
  return {
    async createSignedUrl(bucket, path, seconds, download) {
      assertSafeObjectPath(path); const safeSeconds = Math.max(30, Math.min(seconds, 600));
      const { data, error } = await createSupabaseServiceClient().storage.from(bucketName(bucket)).createSignedUrl(path, safeSeconds, download ? { download } : undefined);
      if (error || !data?.signedUrl) throw new ApiError(503, "Private file access is temporarily unavailable.", "STORAGE_SIGNING_FAILED");
      return data.signedUrl;
    },
    async removeObjects(bucket, paths) {
      if (!paths.length) return; paths.forEach(assertSafeObjectPath);
      const { error } = await createSupabaseServiceClient().storage.from(bucketName(bucket)).remove(paths);
      if (error) throw new ApiError(502, `Could not safely remove ${bucket} objects.`, "STORAGE_DELETE_FAILED");
    },
  };
}
export async function createPrivateSignedUrl(bucket: PrivateBucket, path: string, seconds = Number(process.env.SIGNED_URL_TTL_SECONDS ?? 120), download?: string) {
  return createSupabaseStorageAdapter().createSignedUrl(bucket, path, seconds, download);
}
export async function removePrivateObjects(bucket: PrivateBucket, paths: string[]) { return createSupabaseStorageAdapter().removeObjects(bucket, paths); }
