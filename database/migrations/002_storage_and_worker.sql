begin;

create table if not exists public.storage_settings (
  id uuid primary key default gen_random_uuid(),
  retention_days integer not null default 365 check (retention_days in (0,30,90,180,365,730)),
  max_file_bytes bigint not null default 2147483648 check (max_file_bytes >= 1048576),
  max_delivery_bytes bigint not null default 10737418240 check (max_delivery_bytes >= max_file_bytes),
  approved_extra_extensions text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.storage_settings enable row level security;
drop policy if exists "admins manage storage settings" on public.storage_settings;
create policy "admins manage storage settings" on public.storage_settings for all to authenticated using (public.is_saxn_admin()) with check (public.is_saxn_admin());
insert into public.storage_settings default values on conflict do nothing;

create or replace function public.complete_processing_job(p_job_id uuid, p_zip_path text, p_zip_filename text, p_zip_size bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_delivery uuid;
begin
  select j.delivery_id into target_delivery from public.processing_jobs j where j.id = p_job_id and j.status = 'processing' for update;
  if target_delivery is null then return false; end if;
  if exists (select 1 from public.deliveries d where d.id = target_delivery and (d.status = 'REVOKED' or d.revoked_at is not null)) then
    update public.processing_jobs set status = 'failed', error_message = 'Delivery was revoked during packaging.', locked_at = null, updated_at = now() where id = p_job_id;
    return false;
  end if;
  update public.deliveries set status = 'READY', zip_storage_path = p_zip_path, zip_filename = p_zip_filename, zip_size = p_zip_size, updated_at = now() where id = target_delivery;
  update public.processing_jobs set status = 'completed', error_message = null, locked_at = null, updated_at = now() where id = p_job_id;
  return true;
end $$;
revoke all on function public.complete_processing_job(uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.complete_processing_job(uuid,text,text,bigint) to service_role;

create or replace function public.fail_processing_job(p_job_id uuid, p_error text, p_max_attempts integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_delivery uuid; target_attempts integer; next_status text;
begin
  select j.delivery_id, j.attempts into target_delivery, target_attempts from public.processing_jobs j where j.id = p_job_id and j.status = 'processing' for update;
  if target_delivery is null then return false; end if;
  next_status := case when target_attempts >= p_max_attempts then 'failed' else 'queued' end;
  update public.processing_jobs set status = next_status, error_message = left(p_error,800), locked_at = null, updated_at = now() where id = p_job_id;
  if next_status = 'failed' then update public.deliveries set status = 'FAILED', updated_at = now() where id = target_delivery and status <> 'REVOKED'; end if;
  return true;
end $$;
revoke all on function public.fail_processing_job(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.fail_processing_job(uuid,text,integer) to service_role;

commit;
