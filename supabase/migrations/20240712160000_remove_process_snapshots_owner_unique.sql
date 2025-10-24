alter table if exists public.process_snapshots
  drop constraint if exists process_snapshots_owner_id_key;

drop index if exists public.process_snapshots_owner_id_key;
drop index if exists public.process_snapshots_owner_id_key1;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'process_snapshots_owner_id_idx'
  ) then
    create index process_snapshots_owner_id_idx on public.process_snapshots(owner_id);
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'process_snapshots_updated_at_idx'
  ) then
    create index process_snapshots_updated_at_idx on public.process_snapshots(updated_at);
  end if;
end;
$$;
