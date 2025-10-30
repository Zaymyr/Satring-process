set search_path = public;

create table if not exists public.process_snapshots (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Étapes du processus',
    steps jsonb not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists process_snapshots_owner_id_idx on public.process_snapshots(owner_id);
create index if not exists process_snapshots_updated_at_idx on public.process_snapshots(updated_at);

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists departments_owner_id_idx on public.departments(owner_id);
create index if not exists departments_updated_at_idx on public.departments(updated_at);

create or replace function public.set_process_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger process_snapshots_updated_at
before update on public.process_snapshots
for each row
execute function public.set_process_snapshots_updated_at();

alter table if exists public.process_snapshots enable row level security;

create policy process_snapshots_select on public.process_snapshots
for select
using (auth.uid() = owner_id);

create policy process_snapshots_insert on public.process_snapshots
for insert
with check (auth.uid() = owner_id);

create policy process_snapshots_update on public.process_snapshots
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy process_snapshots_delete on public.process_snapshots
for delete
using (auth.uid() = owner_id);

create or replace function public.create_process_snapshot(payload jsonb)
returns public.process_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner uuid := auth.uid();
    v_steps jsonb := coalesce(payload -> 'steps', '[]'::jsonb);
    v_title text := coalesce(nullif(trim(payload ->> 'title'), ''), 'Étapes du processus');
    v_result public.process_snapshots;
begin
    if v_owner is null then
        raise exception 'Authentification requise' using errcode = '28000';
    end if;

    if jsonb_typeof(v_steps) <> 'array' then
        raise exception 'Le format des étapes est invalide' using errcode = '22P02';
    end if;

    if jsonb_array_length(v_steps) < 2 then
        raise exception 'Au moins deux étapes sont nécessaires' using errcode = '22023';
    end if;

    insert into public.process_snapshots (owner_id, steps, title)
    values (v_owner, v_steps, v_title)
    returning * into v_result;

    return v_result;
end;
$$;

grant execute on function public.create_process_snapshot(jsonb) to authenticated;

create or replace function public.save_process_snapshot(payload jsonb)
returns public.process_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner uuid := auth.uid();
    v_steps jsonb := coalesce(payload -> 'steps', '[]'::jsonb);
    v_title text := coalesce(nullif(trim(payload ->> 'title'), ''), 'Étapes du processus');
    v_id uuid := nullif(trim(payload ->> 'id'), '')::uuid;
    v_result public.process_snapshots;
begin
    if v_owner is null then
        raise exception 'Authentification requise' using errcode = '28000';
    end if;

    if jsonb_typeof(v_steps) <> 'array' then
        raise exception 'Le format des étapes est invalide' using errcode = '22P02';
    end if;

    if jsonb_array_length(v_steps) < 2 then
        raise exception 'Au moins deux étapes sont nécessaires' using errcode = '22023';
    end if;

    if v_id is null then
        raise exception 'Identifiant de process requis' using errcode = '23502';
    end if;

    update public.process_snapshots as ps
    set
        steps = v_steps,
        title = v_title,
        updated_at = timezone('utc', now())
    where ps.id = v_id
      and ps.owner_id = v_owner
    returning ps.* into v_result;

    if not found then
        raise exception 'Process introuvable' using errcode = 'P0002';
    end if;

    return v_result;
end;
$$;

grant execute on function public.save_process_snapshot(jsonb) to authenticated;

create or replace function public.set_departments_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger departments_updated_at
before update on public.departments
for each row
execute function public.set_departments_updated_at();

alter table if exists public.departments enable row level security;

create policy departments_select on public.departments
for select
using (auth.uid() = owner_id);

create policy departments_insert on public.departments
for insert
with check (auth.uid() = owner_id);

create policy departments_update on public.departments
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy departments_delete on public.departments
for delete
using (auth.uid() = owner_id);
