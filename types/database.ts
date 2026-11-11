export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type Id = string;
type Timestamp = string;

type AdminProfile = { id: Id; email: string; display_name: string | null; is_active: boolean; created_at: Timestamp };
type BrandSettings = { id: Id; brand_name: string; logo_path: string | null; location: string; tagline: string | null; contact_email: string | null; social_links: Json; updated_at: Timestamp };
type Client = { id: Id; name: string; email: string | null; created_at: Timestamp; updated_at: Timestamp };
type Delivery = {
  id: Id; client_id: Id; track_title: string; service_type: string; message: string | null; status: string;
  zip_storage_path: string | null; zip_filename: string | null; zip_size: number | null; preview_enabled: boolean;
  preview_file_id: Id | null; preview_storage_path: string | null; preview_mime_type: string | null; preview_size: number | null;
  expires_at: Timestamp | null; revoked_at: Timestamp | null; password_hash: string | null; reference_number: string;
  created_at: Timestamp; updated_at: Timestamp;
};
type DeliveryFile = { id: Id; delivery_id: Id; filename: string; original_filename: string; category: string; storage_path: string; file_size: number; mime_type: string; created_at: Timestamp };
type DeliveryToken = { id: Id; delivery_id: Id; token_hash: string; password_hash: string | null; expires_at: Timestamp | null; revoked_at: Timestamp | null; created_at: Timestamp };
type DownloadEvent = { id: Id; delivery_id: Id; event_type: string; created_at: Timestamp };
type ProcessingJob = { id: Id; delivery_id: Id; status: string; attempts: number; error_message: string | null; locked_at: Timestamp | null; created_at: Timestamp; updated_at: Timestamp };
type RateLimitBucket = { key_hash: string; window_started_at: Timestamp; request_count: number; updated_at: Timestamp };
type StorageSettings = { id: Id; retention_days: number; max_file_bytes: number; max_delivery_bytes: number; approved_extra_extensions: string[]; updated_at: Timestamp };

export type Database = {
  public: {
    Tables: {
      admin_profiles: Table<AdminProfile>;
      brand_settings: Table<BrandSettings>;
      clients: Table<Client>;
      deliveries: Table<Delivery>;
      delivery_files: Table<DeliveryFile>;
      delivery_tokens: Table<DeliveryToken>;
      download_events: Table<DownloadEvent>;
      processing_jobs: Table<ProcessingJob>;
      rate_limit_buckets: Table<RateLimitBucket>;
      storage_settings: Table<StorageSettings>;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_saxn_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      consume_public_rate_limit: { Args: { p_key_hash: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      claim_processing_job: { Args: Record<PropertyKey, never>; Returns: { job_id: Id; delivery_id: Id; attempts: number }[] };
      requeue_stale_processing_jobs: { Args: { p_stale_seconds: number; p_max_attempts: number }; Returns: number };
      complete_processing_job: { Args: { p_job_id: Id; p_zip_path: string; p_zip_filename: string; p_zip_size: number; p_preview_path: string | null; p_preview_size: number | null }; Returns: boolean };
      fail_processing_job: { Args: { p_job_id: Id; p_error: string; p_max_attempts: number }; Returns: boolean };
      get_saxn_dashboard_metrics: { Args: Record<PropertyKey, never>; Returns: { total: number; ready: number; downloaded: number; awaiting: number; expired: number; revoked: number; storage_bytes: number }[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
