begin;

alter table public.deliveries add column if not exists preview_storage_path text;
alter table public.deliveries add column if not exists preview_mime_type text;
alter table public.deliveries add column if not exists preview_size bigint check (preview_size is null or preview_size >= 0);

create or replace function public.requeue_stale_processing_jobs(p_stale_seconds integer, p_max_attempts integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  with stale as (
    select j.id, j.delivery_id, j.attempts from public.processing_jobs j
    where j.status = 'processing' and j.locked_at < now() - make_interval(secs => p_stale_seconds)
    for update skip locked
  ), updated as (
    update public.processing_jobs j set
      status = case when stale.attempts >= p_max_attempts then 'failed' else 'queued' end,
      locked_at = null, error_message = 'Worker lease expired; job returned to the queue.', updated_at = now()
    from stale where j.id = stale.id returning stale.delivery_id, j.status
  )
  update public.deliveries d set status = 'FAILED', updated_at = now()
  from updated u where d.id = u.delivery_id and u.status = 'failed' and d.status = 'PROCESSING';
  get diagnostics changed = row_count;
  return changed;
end $$;
revoke all on function public.requeue_stale_processing_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.requeue_stale_processing_jobs(integer, integer) to service_role;

drop function if exists public.complete_processing_job(uuid,text,text,bigint);
create function public.complete_processing_job(p_job_id uuid, p_zip_path text, p_zip_filename text, p_zip_size bigint, p_preview_path text, p_preview_size bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_delivery uuid; target_expiration timestamptz; target_status text; target_revoked timestamptz;
begin
  select j.delivery_id into target_delivery from public.processing_jobs j where j.id = p_job_id and j.status = 'processing' for update;
  if target_delivery is null then return false; end if;
  if p_zip_path is null or p_zip_filename is null or p_zip_size is null or p_zip_path not like (target_delivery::text || '/%')
     or lower(p_zip_filename) not like '%.zip' or position('/' in p_zip_filename) > 0 or position(chr(92) in p_zip_filename) > 0 or p_zip_size <= 0 then
    update public.processing_jobs set status = 'failed', error_message = 'Worker output metadata failed validation.', locked_at = null, updated_at = now() where id = p_job_id;
    update public.deliveries set status = 'FAILED', updated_at = now() where id = target_delivery and status <> 'REVOKED';
    return false;
  end if;
  if p_preview_path is not null and (p_preview_path not like target_delivery::text || '/%' or p_preview_size is null or p_preview_size <= 0) then
    update public.processing_jobs set status = 'failed', error_message = 'Preview output metadata failed validation.', locked_at = null, updated_at = now() where id = p_job_id;
    update public.deliveries set status = 'FAILED', updated_at = now() where id = target_delivery and status <> 'REVOKED';
    return false;
  end if;
  select d.expires_at, d.status, d.revoked_at into target_expiration, target_status, target_revoked from public.deliveries d where d.id = target_delivery for update;
  if target_revoked is not null or target_status = 'REVOKED' then
    update public.processing_jobs set status = 'failed', error_message = 'Delivery was revoked during packaging.', locked_at = null, updated_at = now() where id = p_job_id;
    return false;
  end if;
  if target_expiration is not null and target_expiration <= now() then
    update public.deliveries set status = 'EXPIRED', updated_at = now() where id = target_delivery;
    update public.processing_jobs set status = 'failed', error_message = 'Delivery expired during packaging.', locked_at = null, updated_at = now() where id = p_job_id;
    return false;
  end if;
  update public.deliveries set status = 'READY', zip_storage_path = p_zip_path, zip_filename = p_zip_filename, zip_size = p_zip_size,
    preview_storage_path = p_preview_path, preview_mime_type = case when p_preview_path is null then null else 'audio/mpeg' end,
    preview_size = p_preview_size, updated_at = now() where id = target_delivery;
  update public.processing_jobs set status = 'completed', error_message = null, locked_at = null, updated_at = now() where id = p_job_id;
  return true;
end $$;
revoke all on function public.complete_processing_job(uuid,text,text,bigint,text,bigint) from public, anon, authenticated;
grant execute on function public.complete_processing_job(uuid,text,text,bigint,text,bigint) to service_role;

commit;
