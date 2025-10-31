set search_path = public;

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    department_id uuid not null references public.departments(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists roles_owner_id_idx on public.roles(owner_id);
create index if not exists roles_department_id_idx on public.roles(department_id);
create index if not exists roles_updated_at_idx on public.roles(updated_at);

create unique index if not exists roles_owner_department_name_idx
  on public.roles (owner_id, department_id, lower(name));

alter table if exists public.roles
  alter column owner_id set default auth.uid();

create or replace function public.set_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists roles_updated_at on public.roles;
create trigger roles_updated_at
before update on public.roles
for each row
execute function public.set_roles_updated_at();

alter table if exists public.roles enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'roles'
          and policyname = 'roles_select'
    ) then
        create policy roles_select on public.roles
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
          and tablename = 'roles'
          and policyname = 'roles_insert'
    ) then
        create policy roles_insert on public.roles
            for insert
            with check (
                auth.uid() = owner_id
                and exists (
                    select 1
                    from public.departments d
                    where d.id = department_id
                      and d.owner_id = auth.uid()
                )
            );
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'roles'
          and policyname = 'roles_update'
    ) then
        create policy roles_update on public.roles
            for update
            using (auth.uid() = owner_id)
            with check (
                auth.uid() = owner_id
                and exists (
                    select 1
                    from public.departments d
                    where d.id = department_id
                      and d.owner_id = auth.uid()
                )
            );
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'roles'
          and policyname = 'roles_delete'
    ) then
        create policy roles_delete on public.roles
            for delete
            using (auth.uid() = owner_id);
    end if;
end
$$;
