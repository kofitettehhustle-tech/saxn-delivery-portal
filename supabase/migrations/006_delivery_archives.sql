begin;

create table if not exists public.delivery_archives (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0),
  created_at timestamptz not null default now(),
  constraint delivery_archives_filename_check check (
    lower(filename) like '%.zip'
    and position('/' in filename) = 0
    and position(chr(92) in filename) = 0
  )
);
create index if not exists delivery_archives_delivery_idx on public.delivery_archives(delivery_id);
alter table public.delivery_archives enable row level security;
drop policy if exists "admins manage delivery archives" on public.delivery_archives;
create policy "admins manage delivery archives" on public.delivery_archives for all to authenticated
  using (public.is_saxn_admin()) with check (public.is_saxn_admin());

create or replace function public.complete_processing_job_with_archives(
  p_job_id uuid,
  p_archives jsonb,
  p_preview_path text,
  p_preview_size bigint
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  target_delivery uuid;
  target_expiration timestamptz;
  target_status text;
  target_revoked timestamptz;
  first_archive record;
  total_archive_size bigint;
begin
  select j.delivery_id into target_delivery
  from public.processing_jobs j
  where j.id = p_job_id and j.status = 'processing'
  for update;
  if target_delivery is null then return false; end if;

  if p_archives is null or jsonb_typeof(p_archives) is distinct from 'array' then
    update public.processing_jobs set status = 'failed', error_message = 'Worker archive metadata failed validation.', locked_at = null, updated_at = now() where id = p_job_id;
    update public.deliveries set status = 'FAILED', updated_at = now() where id = target_delivery and status <> 'REVOKED';
    return false;
  end if;
  if jsonb_array_length(p_archives) = 0 or exists (
    select 1 from jsonb_array_elements(p_archives) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
  ) then
    update public.processing_jobs set status = 'failed', error_message = 'Worker archive metadata failed validation.', locked_at = null, updated_at = now() where id = p_job_id;
    update public.deliveries set status = 'FAILED', updated_at = now() where id = target_delivery and status <> 'REVOKED';
    return false;
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_archives) as a(storage_path text, filename text, file_size bigint)
    where a.storage_path is null or a.filename is null or a.file_size is null or a.file_size <= 0
      or a.storage_path not like target_delivery::text || '/%'
      or lower(a.filename) not like '%.zip'
      or position('/' in a.filename) > 0 or position(chr(92) in a.filename) > 0
  ) or (select count(*) from jsonb_to_recordset(p_archives) as a(storage_path text, filename text, file_size bigint))
       <> (select count(distinct a.storage_path) from jsonb_to_recordset(p_archives) as a(storage_path text, filename text, file_size bigint)) then
    update public.processing_jobs set status = 'failed', error_message = 'Worker archive metadata failed validation.', locked_at = null, updated_at = now() where id = p_job_id;
    update public.deliveries set status = 'FAILED', updated_at = now() where id = target_delivery and status <> 'REVOKED';
    return false;
  end if;

  if p_preview_path is not null and (p_preview_path not like target_delivery::text || '/%' or p_preview_size is null or p_preview_size <= 0) then
    update public.processing_jobs set status = 'failed', error_message = 'Preview output metadata failed validation.', locked_at = null, updated_at = now() where id = p_job_id;
    update public.deliveries set status = 'FAILED', updated_at = now() where id = target_delivery and status <> 'REVOKED';
    return false;
  end if;

  select d.expires_at, d.status, d.revoked_at
  into target_expiration, target_status, target_revoked
  from public.deliveries d where d.id = target_delivery for update;
  if target_revoked is not null or target_status = 'REVOKED' then
    update public.processing_jobs set status = 'failed', error_message = 'Delivery was revoked during packaging.', locked_at = null, updated_at = now() where id = p_job_id;
    return false;
  end if;
  if target_expiration is not null and target_expiration <= now() then
    update public.deliveries set status = 'EXPIRED', updated_at = now() where id = target_delivery;
    update public.processing_jobs set status = 'failed', error_message = 'Delivery expired during packaging.', locked_at = null, updated_at = now() where id = p_job_id;
    return false;
  end if;

  select a.storage_path, a.filename into first_archive
  from jsonb_to_recordset(p_archives) with ordinality as a(storage_path text, filename text, file_size bigint, ordinal bigint)
  order by a.ordinal limit 1;
  select sum(a.file_size) into total_archive_size
  from jsonb_to_recordset(p_archives) as a(storage_path text, filename text, file_size bigint);

  delete from public.delivery_archives where delivery_id = target_delivery;
  insert into public.delivery_archives(delivery_id, filename, storage_path, file_size)
  select target_delivery, a.filename, a.storage_path, a.file_size
  from jsonb_to_recordset(p_archives) as a(storage_path text, filename text, file_size bigint);

  update public.deliveries set status = 'READY', zip_storage_path = first_archive.storage_path,
    zip_filename = first_archive.filename, zip_size = total_archive_size,
    preview_storage_path = p_preview_path,
    preview_mime_type = case when p_preview_path is null then null else 'audio/mpeg' end,
    preview_size = p_preview_size, updated_at = now()
  where id = target_delivery;
  update public.processing_jobs set status = 'completed', error_message = null, locked_at = null, updated_at = now() where id = p_job_id;
  return true;
end $$;
revoke all on function public.complete_processing_job_with_archives(uuid,jsonb,text,bigint) from public, anon, authenticated;
grant execute on function public.complete_processing_job_with_archives(uuid,jsonb,text,bigint) to service_role;

commit;
