import { z } from "zod";

export const serviceTypes = ["Mixing", "Mastering", "Mixing & Mastering", "Beat Production", "Custom Production", "Instrumental", "Other"] as const;
export const fileCategories = ["01_FINISHED_TRACKS", "02_INSTRUMENTALS", "03_PERFORMANCE_TRACKS", "04_VOCAL_TRACKS", "05_OTHER"] as const;
export const deliveryStatuses = ["DRAFT", "UPLOADING", "PROCESSING", "READY", "FAILED", "EXPIRED", "REVOKED"] as const;
export type ServiceType = (typeof serviceTypes)[number];
export type FileCategory = (typeof fileCategories)[number];

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
export const clientSchema = z.object({ name: z.string().trim().min(1).max(160), email: z.string().trim().email().max(254).or(z.literal("")).optional() });
export const deliveryFileSchema = z.object({ filename: z.string().trim().min(1).max(180), originalFilename: z.string().trim().min(1).max(240), category: z.enum(fileCategories), fileSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), mimeType: z.string().trim().min(1).max(160) });
export const createDeliverySchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  client: clientSchema.optional(),
  trackTitle: z.string().trim().min(1).max(180),
  serviceType: z.enum(serviceTypes),
  message: optionalText(4000),
  previewEnabled: z.boolean().default(false),
  previewFileIndex: z.number().int().min(0).optional().nullable(),
  expiration: z.enum(["7", "14", "30", "90", "custom", "never"]),
  customExpiresAt: z.string().datetime().optional().nullable(),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
  files: z.array(deliveryFileSchema).min(1).max(100),
}).superRefine((value, ctx) => {
  if (!value.clientId && !value.client) ctx.addIssue({ code: "custom", path: ["client"], message: "Select an existing client or enter a new client name." });
  if (value.expiration === "custom" && !value.customExpiresAt) ctx.addIssue({ code: "custom", path: ["customExpiresAt"], message: "Choose a custom expiry date." });
  if (value.previewEnabled && (value.previewFileIndex == null || value.previewFileIndex >= value.files.length)) ctx.addIssue({ code: "custom", path: ["previewFileIndex"], message: "Select a preview file." });
  if (value.previewEnabled && value.previewFileIndex != null) {
    const preview = value.files[value.previewFileIndex];
    const ext = preview?.filename.toLowerCase().split(".").pop();
    const mime = preview?.mimeType.toLowerCase();
    if (!preview || !(["wav", "mp3"].includes(ext ?? "") && ["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3", "application/octet-stream"].includes(mime ?? ""))) ctx.addIssue({ code: "custom", path: ["previewFileIndex"], message: "Select a browser-compatible WAV or MP3 preview file." });
  }
});

export const brandSettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(80), location: z.string().trim().min(1).max(100), tagline: optionalText(180), contactEmail: z.string().trim().email().max(254).or(z.literal("")).optional(),
  socialLinks: z.object({ instagram: z.string().url().or(z.literal("")).optional(), youtube: z.string().url().or(z.literal("")).optional(), tiktok: z.string().url().or(z.literal("")).optional(), facebook: z.string().url().or(z.literal("")).optional(), x: z.string().url().or(z.literal("")).optional(), website: z.string().url().or(z.literal("")).optional(), beatStore: z.string().url().or(z.literal("")).optional() }).default({}),
});

export function safeFilename(input: string): string {
  const trimmed = input.normalize("NFKC").replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\.\./g, "_").replace(/[:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
  return (trimmed || "file").slice(0, 180);
}

export function safeArchiveFolder(category: string): FileCategory {
  return (fileCategories as readonly string[]).includes(category) ? category as FileCategory : "05_OTHER";
}

export function safeArchivePath(category: string, filename: string): string {
  const folder = safeArchiveFolder(category);
  const safeName = safeFilename(filename);
  const extension = safeName.toLowerCase().split(".").pop();
  if ((folder === "01_FINISHED_TRACKS" || folder === "02_INSTRUMENTALS") && (extension === "wav" || extension === "mp3")) {
    return `${folder}/${extension.toUpperCase()}/${safeName}`;
  }
  return `${folder}/${safeName}`;
}

export function allowedMime(filename: string, mimeType: string, approvedExtensions: readonly string[] = []): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const mime = mimeType.toLowerCase();
  const allowed: Record<string, string[]> = {
    wav: ["audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"],
    mp3: ["audio/mpeg", "audio/mp3", "application/octet-stream"],
    flac: ["audio/flac", "audio/x-flac", "application/octet-stream"],
    aif: ["audio/aiff", "audio/x-aiff", "application/octet-stream"],
    aiff: ["audio/aiff", "audio/x-aiff", "application/octet-stream"],
    pdf: ["application/pdf", "application/octet-stream"],
  };
  if (allowed[ext]) return allowed[ext].includes(mime);
  const customAllowed = approvedExtensions.some((entry) => entry.toLowerCase().replace(/^\./, "") === ext);
  return customAllowed && /^(application|audio|text|video)\/[a-z0-9.+-]+$/.test(mime);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
