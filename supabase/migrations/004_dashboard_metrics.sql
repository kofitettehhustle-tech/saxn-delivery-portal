begin;

create or replace function public.get_saxn_dashboard_metrics()
returns table(total bigint, ready bigint, downloaded bigint, awaiting bigint, expired bigint, revoked bigint, storage_bytes bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.deliveries),
    (select count(*) from public.deliveries d where d.status = 'READY'),
    (select count(distinct e.delivery_id) from public.download_events e join public.deliveries d on d.id = e.delivery_id where e.event_type = 'download_requested'),
    (select count(*) from public.deliveries d where d.status = 'READY' and not exists (select 1 from public.download_events e where e.delivery_id = d.id and e.event_type = 'download_requested')),
    (select count(*) from public.deliveries d where d.status = 'EXPIRED' or (d.status <> 'REVOKED' and d.expires_at is not null and d.expires_at <= now())),
    (select count(*) from public.deliveries d where d.status = 'REVOKED' or d.revoked_at is not null),
    (select coalesce(sum(f.file_size), 0) from public.delivery_files f)
      + (select coalesce(sum(coalesce(d.zip_size, 0) + coalesce(d.preview_size, 0)), 0) from public.deliveries d);
$$;
revoke all on function public.get_saxn_dashboard_metrics() from public, anon, authenticated;
grant execute on function public.get_saxn_dashboard_metrics() to service_role;

commit;
