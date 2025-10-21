set search_path = public;

create extension if not exists "pgcrypto";

alter table if exists public.workspace_snapshots
    add column if not exists owner_id uuid;

update public.workspace_snapshots
set owner_id = coalesce(owner_id, gen_random_uuid());

alter table if exists public.workspace_snapshots
    alter column owner_id set not null;

alter table if exists public.workspace_snapshots
    alter column updated_at set default timezone('utc'::text, now());

do $$
begin
    if not exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and indexname = 'workspace_snapshots_owner_id_key'
    ) then
        create unique index workspace_snapshots_owner_id_key on public.workspace_snapshots (owner_id);
    end if;
end
$$;

do $$
begin
    if exists (
        select 1 from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = 'workspace_snapshots'
          and constraint_name = 'workspace_snapshots_owner_id_fkey'
    ) then
        alter table public.workspace_snapshots drop constraint workspace_snapshots_owner_id_fkey;
    end if;
end
$$;

alter table if exists public.workspace_snapshots
    add constraint workspace_snapshots_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade;

alter table public.workspace_snapshots enable row level security;

drop policy if exists workspace_snapshots_read on public.workspace_snapshots;
drop policy if exists workspace_snapshots_insert on public.workspace_snapshots;
drop policy if exists workspace_snapshots_update on public.workspace_snapshots;
drop policy if exists workspace_snapshots_delete on public.workspace_snapshots;
drop policy if exists workspace_snapshots_select on public.workspace_snapshots;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_select'
    ) then
        create policy workspace_snapshots_select on public.workspace_snapshots
            for select
            to authenticated
            using (owner_id = auth.uid());
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_insert'
    ) then
        create policy workspace_snapshots_insert on public.workspace_snapshots
            for insert
            to authenticated
            with check (owner_id = auth.uid());
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_update'
    ) then
        create policy workspace_snapshots_update on public.workspace_snapshots
            for update
            to authenticated
            using (owner_id = auth.uid())
            with check (owner_id = auth.uid());
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_snapshots'
          and policyname = 'workspace_snapshots_delete'
    ) then
        create policy workspace_snapshots_delete on public.workspace_snapshots
            for delete
            to authenticated
            using (owner_id = auth.uid());
    end if;
end
$$;

drop function if exists public.update_workspace_snapshot(jsonb);

create or replace function public.update_workspace_snapshot(payload jsonb)
    returns public.workspace_snapshots
    language plpgsql
    security definer
    set search_path = public
as
$$
declare
    v_owner uuid := auth.uid();
    v_id text := coalesce(payload ->> 'id', v_owner::text);
    v_department integer := coalesce((payload ->> 'department_count')::integer, 0);
    v_role integer := coalesce((payload ->> 'role_count')::integer, 0);
    v_detail integer := coalesce((payload ->> 'detail_count')::integer, 0);
    v_diagram integer := coalesce((payload ->> 'diagram_process_count')::integer, 0);
    v_last_org timestamptz := nullif(payload ->> 'last_organigram_update', '')::timestamptz;
    v_last_diagram timestamptz := nullif(payload ->> 'last_diagram_update', '')::timestamptz;
    v_result public.workspace_snapshots;
begin
    if v_owner is null then
        raise exception 'auth.uid() is required';
    end if;

    insert into public.workspace_snapshots as ws (
        id,
        owner_id,
        department_count,
        role_count,
        detail_count,
        diagram_process_count,
        last_organigram_update,
        last_diagram_update,
        updated_at
    )
    values (
        v_id,
        v_owner,
        v_department,
        v_role,
        v_detail,
        v_diagram,
        v_last_org,
        v_last_diagram,
        timezone('utc'::text, now())
    )
    on conflict (owner_id) do update
    set
        department_count = excluded.department_count,
        role_count = excluded.role_count,
        detail_count = excluded.detail_count,
        diagram_process_count = excluded.diagram_process_count,
        last_organigram_update = excluded.last_organigram_update,
        last_diagram_update = excluded.last_diagram_update,
        updated_at = timezone('utc'::text, now())
    returning ws.* into v_result;

    return v_result;
end;
$$;

grant execute on function public.update_workspace_snapshot(jsonb) to authenticated;
