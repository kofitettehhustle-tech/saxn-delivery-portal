alter table public.delivery_files
  drop constraint if exists delivery_files_category_check;

alter table public.delivery_files
  add constraint delivery_files_category_check
  check (category in (
    '01_FINAL_MASTERS',
    '02_INSTRUMENTALS',
    '03_STEMS',
    '04_EXTRAS',
    '01_FINISHED_TRACKS',
    '03_PERFORMANCE_TRACKS',
    '04_VOCAL_TRACKS',
    '05_OTHER'
  ));
