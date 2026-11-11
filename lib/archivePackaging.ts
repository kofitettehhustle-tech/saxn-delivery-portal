import { safeFilename } from "./validation";

export type PackageFile = { filename: string; category: string; file_size: number | string };
export type ArchivePlan = { filename: string; files: PackageFile[] };

export const MAX_ARCHIVE_SIZE_BYTES = 45 * 1024 * 1024;
const MAX_PLANNED_CONTENT_BYTES = 44 * 1024 * 1024;

function splitIntoParts(files: PackageFile[], maxBytes: number): PackageFile[][] {
  const parts: PackageFile[][] = [];
  let current: PackageFile[] = [];
  let currentSize = 0;
  for (const file of files) {
    const size = Number(file.file_size);
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error(`The size for ${file.filename} is invalid.`);
    if (size > maxBytes) throw new Error(`${file.filename} is too large to fit in a downloadable ZIP under the current storage limit.`);
    if (current.length && currentSize + size > maxBytes) {
      parts.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(file);
    currentSize += size;
  }
  if (current.length) parts.push(current);
  return parts;
}

function numberedName(prefix: string, suffix: string, index: number, count: number) {
  const part = count > 1 ? `_${String(index + 1).padStart(2, "0")}` : "";
  return `${safeFilename(`${prefix}${part}_${suffix}`)}.zip`;
}

export function planDeliveryArchives(trackTitle: string, files: PackageFile[]): ArchivePlan[] {
  if (!files.length) throw new Error("No delivery files are registered.");
  const title = safeFilename(trackTitle);
  const mp3Files = files.filter((file) => file.filename.toLowerCase().endsWith(".mp3"));
  const wavFiles = files.filter((file) => file.filename.toLowerCase().endsWith(".wav"));
  const otherFiles = files.filter((file) => !file.filename.toLowerCase().endsWith(".mp3") && !file.filename.toLowerCase().endsWith(".wav"));
  const plans: ArchivePlan[] = [];

  const mp3Parts = splitIntoParts(mp3Files, MAX_PLANNED_CONTENT_BYTES);
  mp3Parts.forEach((part, index) => plans.push({ filename: numberedName(title, "MP3", index, mp3Parts.length), files: part }));

  wavFiles.forEach((file, index) => {
    const [part] = splitIntoParts([file], MAX_PLANNED_CONTENT_BYTES);
    plans.push({ filename: numberedName(title, `WAV_${String(index + 1).padStart(2, "0")}`, 0, 1), files: part });
  });

  const otherByCategory = new Map<string, PackageFile[]>();
  for (const file of otherFiles) otherByCategory.set(file.category, [...(otherByCategory.get(file.category) ?? []), file]);
  for (const [category, categoryFiles] of otherByCategory) {
    const parts = splitIntoParts(categoryFiles, MAX_PLANNED_CONTENT_BYTES);
    const label = category.replace(/^\d+_/, "");
    parts.forEach((part, index) => plans.push({ filename: numberedName(`${title}_${label}`, "FILES", index, parts.length), files: part }));
  }
  return plans;
}
