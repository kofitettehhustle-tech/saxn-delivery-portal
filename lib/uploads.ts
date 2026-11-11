import "server-only";
import { ApiError } from "./http";
import { bucketName } from "./storage";
import { createSupabaseServiceClient } from "./supabase/service";

export async function authorizeUploadSlots(deliveryId: string) {
  const db = createSupabaseServiceClient();
  const { data: delivery } = await db.from("deliveries").select("id,status").eq("id", deliveryId).maybeSingle();
  if (!delivery) throw new ApiError(404, "Delivery not found.", "DELIVERY_NOT_FOUND");
  if (delivery.status !== "UPLOADING") throw new ApiError(409, "This delivery is not accepting uploads.", "UPLOAD_NOT_ACCEPTED");
  const { data: files, error } = await db.from("delivery_files").select("id,storage_path,filename,mime_type,file_size").eq("delivery_id", deliveryId);
  if (error || !files?.length) throw new ApiError(404, "No files are registered for this delivery.", "FILES_NOT_FOUND");
  return files.map((file) => ({ fileId: file.id, filename: file.filename, storagePath: file.storage_path, mimeType: file.mime_type, fileSize: file.file_size, bucket: bucketName("originals") }));
}
