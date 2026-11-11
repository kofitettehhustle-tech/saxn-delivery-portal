alter table public.delivery_files
  drop constraint if exists delivery_files_category_check;

update public.delivery_files
set category = case category
  when '01_FINAL_MASTERS' then '01_FINISHED_TRACKS'
  when '02_INSTRUMENTALS' then '02_INSTRUMENTALS'
  else '05_OTHER'
end
where category in ('01_FINAL_MASTERS', '02_INSTRUMENTALS', '03_STEMS', '04_EXTRAS');

alter table public.delivery_files
  add constraint delivery_files_category_check
  check (category in (
    '01_FINISHED_TRACKS',
    '02_INSTRUMENTALS',
    '03_PERFORMANCE_TRACKS',
    '04_VOCAL_TRACKS',
    '05_OTHER'
  ));
