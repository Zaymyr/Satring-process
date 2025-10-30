set search_path = public;

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists departments_owner_id_idx on public.departments(owner_id);
create index if not exists departments_updated_at_idx on public.departments(updated_at);

alter table if exists public.departments
  alter column owner_id set default auth.uid();

create or replace function public.set_departments_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists departments_updated_at on public.departments;
create trigger departments_updated_at
before update on public.departments
for each row
execute function public.set_departments_updated_at();

alter table if exists public.departments enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departments'
          and policyname = 'departments_select'
    ) then
        create policy departments_select on public.departments
            for select
            using (auth.uid() = owner_id);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departments'
          and policyname = 'departments_insert'
    ) then
        create policy departments_insert on public.departments
            for insert
            with check (auth.uid() = owner_id);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departments'
          and policyname = 'departments_update'
    ) then
        create policy departments_update on public.departments
            for update
            using (auth.uid() = owner_id)
            with check (auth.uid() = owner_id);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departments'
          and policyname = 'departments_delete'
    ) then
        create policy departments_delete on public.departments
            for delete
            using (auth.uid() = owner_id);
    end if;
end
$$;
