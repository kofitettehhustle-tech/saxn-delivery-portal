-- SAXN Music Delivery Portal. Run against the selected Supabase project only after reviewing the target.
begin;
create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.brand_settings (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null default 'SAXN',
  logo_path text,
  location text not null default 'Ghana',
  tagline text,
  contact_email text,
  social_links jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_name_search_idx on public.clients using gin (to_tsvector('simple', name));
create index if not exists clients_email_idx on public.clients (lower(email)) where email is not null;

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  track_title text not null,
  service_type text not null check (service_type in ('Mixing','Mastering','Mixing & Mastering','Beat Production','Custom Production','Instrumental','Other')),
  message text,
  status text not null default 'DRAFT' check (status in ('DRAFT','UPLOADING','PROCESSING','READY','FAILED','EXPIRED','REVOKED')),
  zip_storage_path text,
  zip_filename text,
  zip_size bigint check (zip_size is null or zip_size >= 0),
  preview_enabled boolean not null default false,
  preview_file_id uuid,
  expires_at timestamptz,
  revoked_at timestamptz,
  password_hash text,
  reference_number text not null unique default ('SX-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,10))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deliveries_created_idx on public.deliveries(created_at desc);
create index if not exists deliveries_status_idx on public.deliveries(status);
create index if not exists deliveries_client_idx on public.deliveries(client_id);
create index if not exists deliveries_expiration_idx on public.deliveries(expires_at) where expires_at is not null;
create index if not exists deliveries_track_search_idx on public.deliveries using gin (to_tsvector('simple', track_title));

create table if not exists public.delivery_files (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  filename text not null,
  original_filename text not null,
  category text not null check (category in ('01_FINAL_MASTERS','02_INSTRUMENTALS','03_STEMS','04_EXTRAS')),
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0),
  mime_type text not null,
  created_at timestamptz not null default now()
);
create index if not exists delivery_files_delivery_idx on public.delivery_files(delivery_id);
alter table public.deliveries drop constraint if exists deliveries_preview_file_id_fkey;
alter table public.deliveries add constraint deliveries_preview_file_id_fkey foreign key (preview_file_id) references public.delivery_files(id) on delete set null;

create table if not exists public.delivery_tokens (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists delivery_tokens_delivery_idx on public.delivery_tokens(delivery_id);
create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  event_type text not null check (event_type in ('page_view','password_failed','download_requested','preview_requested')),
  created_at timestamptz not null default now()
);
create index if not exists download_events_delivery_idx on public.download_events(delivery_id, created_at desc);
create index if not exists download_events_type_idx on public.download_events(event_type, created_at desc);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  error_message text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists processing_jobs_queue_idx on public.processing_jobs(status, created_at) where status = 'queued';
create unique index if not exists processing_jobs_one_active_delivery_idx on public.processing_jobs(delivery_id) where status in ('queued','processing');

create table if not exists public.rate_limit_buckets (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.is_saxn_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_profiles p where p.id = auth.uid() and p.is_active = true)
$$;
revoke all on function public.is_saxn_admin() from public;
grant execute on function public.is_saxn_admin() to authenticated, service_role;

create or replace function public.consume_public_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare new_count integer;
begin
  insert into public.rate_limit_buckets(key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, now(), 1, now())
  on conflict (key_hash) do update set
    request_count = case when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1 else public.rate_limit_buckets.request_count + 1 end,
    window_started_at = case when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now() then now() else public.rate_limit_buckets.window_started_at end,
    updated_at = now()
  returning request_count into new_count;
  return new_count <= p_limit;
end $$;
revoke all on function public.consume_public_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, integer, integer) to service_role;

create or replace function public.claim_processing_job()
returns table(job_id uuid, delivery_id uuid, attempts integer)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with next_job as (
    select j.id from public.processing_jobs j where j.status = 'queued' order by j.created_at for update skip locked limit 1
  )
  update public.processing_jobs j set status = 'processing', attempts = j.attempts + 1, locked_at = now(), updated_at = now(), error_message = null
  from next_job n where j.id = n.id returning j.id, j.delivery_id, j.attempts;
end $$;
revoke all on function public.claim_processing_job() from public, anon, authenticated;
grant execute on function public.claim_processing_job() to service_role;

create or replace function public.requeue_stale_processing_jobs(p_stale_seconds integer, p_max_attempts integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.processing_jobs set status = case when attempts >= p_max_attempts then 'failed' else 'queued' end,
    locked_at = null, error_message = 'Worker lease expired; job returned to the queue.', updated_at = now()
  where status = 'processing' and locked_at < now() - make_interval(secs => p_stale_seconds);
  get diagnostics changed = row_count;
  return changed;
end $$;
revoke all on function public.requeue_stale_processing_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.requeue_stale_processing_jobs(integer, integer) to service_role;

alter table public.admin_profiles enable row level security;
alter table public.brand_settings enable row level security;
alter table public.clients enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_files enable row level security;
alter table public.delivery_tokens enable row level security;
alter table public.download_events enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy "admin profile self read" on public.admin_profiles for select to authenticated using (id = auth.uid() and is_active = true);
create policy "admins manage branding" on public.brand_settings for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());
create policy "admins manage clients" on public.clients for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());
create policy "admins manage deliveries" on public.deliveries for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());
create policy "admins manage delivery files" on public.delivery_files for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());
create policy "admins manage delivery tokens" on public.delivery_tokens for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());
create policy "admins manage download events" on public.download_events for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());
create policy "admins manage processing jobs" on public.processing_jobs for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('delivery-originals','delivery-originals',false,2147483648,array['audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/mp3','audio/flac','audio/x-flac','audio/aiff','audio/x-aiff','application/pdf','application/octet-stream']),
  ('delivery-archives','delivery-archives',false,10737418240,array['application/zip','application/x-zip-compressed']),
  ('delivery-previews','delivery-previews',false,536870912,array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav']),
  ('brand-assets','brand-assets',false,10485760,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = false;
create policy "admins upload SAXN assets" on storage.objects for insert to authenticated with check (bucket_id in ('delivery-originals','delivery-archives','delivery-previews','brand-assets') and public.is_saxn_admin());
create policy "admins read SAXN assets" on storage.objects for select to authenticated using (bucket_id in ('delivery-originals','delivery-archives','delivery-previews','brand-assets') and public.is_saxn_admin());
create policy "admins update SAXN assets" on storage.objects for update to authenticated using (bucket_id in ('delivery-originals','delivery-archives','delivery-previews','brand-assets') and public.is_saxn_admin()) with check (bucket_id in ('delivery-originals','delivery-archives','delivery-previews','brand-assets') and public.is_saxn_admin());
create policy "admins delete SAXN assets" on storage.objects for delete to authenticated using (bucket_id in ('delivery-originals','delivery-archives','delivery-previews','brand-assets') and public.is_saxn_admin());

commit;
