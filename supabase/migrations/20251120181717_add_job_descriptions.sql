create table if not exists public.job_descriptions (
    id uuid primary key default gen_random_uuid(),
    role_id uuid not null references public.roles(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    content text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists job_descriptions_role_id_idx on public.job_descriptions(role_id);
create index if not exists job_descriptions_org_idx on public.job_descriptions(organization_id);
create index if not exists job_descriptions_updated_at_idx on public.job_descriptions(updated_at);

create or replace function public.set_job_descriptions_updated_at()
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
    if not exists (select 1 from pg_trigger where tgname = 'job_descriptions_updated_at') then
        create trigger job_descriptions_updated_at
            before update on public.job_descriptions
            for each row
            execute function public.set_job_descriptions_updated_at();
    end if;
end;$$;

alter table if exists public.job_descriptions enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'job_descriptions'
          and policyname = 'job_descriptions_select'
    ) then
        create policy job_descriptions_select on public.job_descriptions
            for select
            using (
                exists (
                    select 1
                    from public.organization_members om
                    where om.organization_id = organization_id
                      and om.user_id = auth.uid()
                )
            );
    end if;
end;$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'job_descriptions'
          and policyname = 'job_descriptions_insert'
    ) then
        create policy job_descriptions_insert on public.job_descriptions
            for insert
            with check (
                exists (
                    select 1
                    from public.organization_members om
                    where om.organization_id = organization_id
                      and om.user_id = auth.uid()
                )
            );
    end if;
end;$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'job_descriptions'
          and policyname = 'job_descriptions_update'
    ) then
        create policy job_descriptions_update on public.job_descriptions
            for update
            using (
                exists (
                    select 1
                    from public.organization_members om
                    where om.organization_id = organization_id
                      and om.user_id = auth.uid()
                )
            )
            with check (
                exists (
                    select 1
                    from public.organization_members om
                    where om.organization_id = organization_id
                      and om.user_id = auth.uid()
                )
            );
    end if;
end;$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'job_descriptions'
          and policyname = 'job_descriptions_delete'
    ) then
        create policy job_descriptions_delete on public.job_descriptions
            for delete
            using (
                exists (
                    select 1
                    from public.organization_members om
                    where om.organization_id = organization_id
                      and om.user_id = auth.uid()
                )
            );
    end if;
end;$$;
