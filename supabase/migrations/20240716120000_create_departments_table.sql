set search_path = public;

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists departments_owner_id_idx on public.departments(owner_id);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'departments_owner_id_name_key'
    ) then
        alter table if exists public.departments
            add constraint departments_owner_id_name_key unique (owner_id, name);
    end if;
end;
$$;

create or replace function public.set_departments_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_trigger
        where tgname = 'departments_updated_at'
    ) then
        create trigger departments_updated_at
        before update on public.departments
        for each row
        execute function public.set_departments_updated_at();
    end if;
end;
$$;

alter table if exists public.departments enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where policyname = 'departments_select'
          and tablename = 'departments'
    ) then
        create policy departments_select on public.departments
            for select
            using (auth.uid() = owner_id);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where policyname = 'departments_insert'
          and tablename = 'departments'
    ) then
        create policy departments_insert on public.departments
            for insert
            with check (auth.uid() = owner_id);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where policyname = 'departments_update'
          and tablename = 'departments'
    ) then
        create policy departments_update on public.departments
            for update
            using (auth.uid() = owner_id)
            with check (auth.uid() = owner_id);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where policyname = 'departments_delete'
          and tablename = 'departments'
    ) then
        create policy departments_delete on public.departments
            for delete
            using (auth.uid() = owner_id);
    end if;
end;
$$;
