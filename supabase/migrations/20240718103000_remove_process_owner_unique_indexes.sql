-- Ensure no unique constraints or indexes remain on process_snapshots.owner_id
alter table if exists public.process_snapshots
  drop constraint if exists process_snapshots_owner_id_key;

-- Drop any lingering unique indexes targeting owner_id
do $$
declare
  idx record;
begin
  for idx in
    select schemaname, indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'process_snapshots'
      and indexdef ilike 'CREATE UNIQUE INDEX%'
      and indexdef ilike '%(owner_id%'
  loop
    execute format('drop index if exists %I.%I', idx.schemaname, idx.indexname);
  end loop;
end;
$$;

-- Recreate the expected non-unique indexes when missing
create index if not exists process_snapshots_owner_id_idx on public.process_snapshots(owner_id);
create index if not exists process_snapshots_updated_at_idx on public.process_snapshots(updated_at);
