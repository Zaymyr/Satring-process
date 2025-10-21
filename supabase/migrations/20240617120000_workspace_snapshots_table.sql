set search_path = public;

create table if not exists public.workspace_snapshots (
    id text primary key,
    department_count integer default 0 not null,
    role_count integer default 0 not null,
    detail_count integer default 0 not null,
    diagram_process_count integer default 0 not null,
    last_organigram_update timestamptz,
    last_diagram_update timestamptz,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table if exists public.workspace_snapshots
    add column if not exists department_count integer;

alter table if exists public.workspace_snapshots
    add column if not exists role_count integer;

alter table if exists public.workspace_snapshots
    add column if not exists detail_count integer;

alter table if exists public.workspace_snapshots
    add column if not exists diagram_process_count integer;

alter table if exists public.workspace_snapshots
    add column if not exists last_organigram_update timestamptz;

alter table if exists public.workspace_snapshots
    add column if not exists last_diagram_update timestamptz;

alter table if exists public.workspace_snapshots
    add column if not exists updated_at timestamptz;

alter table if exists public.workspace_snapshots
    alter column department_count set default 0;

alter table if exists public.workspace_snapshots
    alter column role_count set default 0;

alter table if exists public.workspace_snapshots
    alter column detail_count set default 0;

alter table if exists public.workspace_snapshots
    alter column diagram_process_count set default 0;

alter table if exists public.workspace_snapshots
    alter column updated_at set default timezone('utc'::text, now());

update public.workspace_snapshots
set department_count = coalesce(department_count, 0);

update public.workspace_snapshots
set role_count = coalesce(role_count, 0);

update public.workspace_snapshots
set detail_count = coalesce(detail_count, 0);

update public.workspace_snapshots
set diagram_process_count = coalesce(diagram_process_count, 0);

update public.workspace_snapshots
set updated_at = coalesce(updated_at, timezone('utc'::text, now()));

alter table if exists public.workspace_snapshots
    alter column department_count set not null;

alter table if exists public.workspace_snapshots
    alter column role_count set not null;

alter table if exists public.workspace_snapshots
    alter column detail_count set not null;

alter table if exists public.workspace_snapshots
    alter column diagram_process_count set not null;

alter table if exists public.workspace_snapshots
    alter column updated_at set not null;

alter table public.workspace_snapshots enable row level security;

drop policy if exists workspace_snapshots_read on public.workspace_snapshots;
drop policy if exists workspace_snapshots_insert on public.workspace_snapshots;
drop policy if exists workspace_snapshots_update on public.workspace_snapshots;
drop policy if exists workspace_snapshots_delete on public.workspace_snapshots;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_read'
    ) then
        create policy workspace_snapshots_read on public.workspace_snapshots
            for select
            to anon, authenticated
            using (true);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_insert'
    ) then
        create policy workspace_snapshots_insert on public.workspace_snapshots
            for insert
            to anon, authenticated
            with check (true);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_update'
    ) then
        create policy workspace_snapshots_update on public.workspace_snapshots
            for update
            to anon, authenticated
            using (true)
            with check (true);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_delete'
    ) then
        create policy workspace_snapshots_delete on public.workspace_snapshots
            for delete
            to anon, authenticated
            using (true);
    end if;
end
$$;
