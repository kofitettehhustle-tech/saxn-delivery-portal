export type DeliveryStatus = "DRAFT" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "EXPIRED" | "REVOKED";
export type FileCategory = "01_FINAL_MASTERS" | "02_INSTRUMENTALS" | "03_STEMS" | "04_EXTRAS";
export type ServiceType = "Mixing" | "Mastering" | "Mixing & Mastering" | "Beat Production" | "Custom Production" | "Instrumental" | "Other";
export type ClientRecord = { id: string; name: string; email: string | null; created_at: string };
export type DeliveryRecord = {
  id: string; client_id: string; track_title: string; service_type: ServiceType; message: string | null; status: DeliveryStatus;
  zip_filename: string | null; zip_size: number | null; preview_enabled: boolean; preview_file_id: string | null;
  preview_storage_path: string | null; preview_mime_type: string | null; preview_size: number | null;
  expires_at: string | null; revoked_at: string | null; created_at: string; updated_at: string; reference_number: string;
  client?: { id: string; name: string; email?: string | null } | null; files?: { id: string; filename: string; original_filename: string; category: FileCategory; file_size: number; mime_type: string }[];
};
export type BrandSettings = { id?: string; brand_name: string; logo_path: string | null; location: string; tagline: string | null; contact_email: string | null; social_links: Record<string, string>; updated_at?: string };
