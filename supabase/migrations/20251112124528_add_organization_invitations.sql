set search_path = public;

create table if not exists public.organization_invitations (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    invited_user_id uuid not null references auth.users(id) on delete cascade,
    inviter_id uuid references auth.users(id) on delete set null,
    email text not null,
    role text not null check (role in ('owner', 'admin', 'member')),
    status text not null check (status in ('pending', 'accepted', 'revoked')) default 'pending',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    responded_at timestamptz,
    revoked_at timestamptz
);

create unique index if not exists organization_invitations_org_user_idx
    on public.organization_invitations(organization_id, invited_user_id);

create unique index if not exists organization_invitations_org_email_idx
    on public.organization_invitations(organization_id, email);

create index if not exists organization_invitations_status_idx
    on public.organization_invitations(status);

create index if not exists organization_invitations_created_at_idx
    on public.organization_invitations(created_at);

create or replace function public.set_organization_invitations_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger organization_invitations_updated_at
before update on public.organization_invitations
for each row
execute function public.set_organization_invitations_updated_at();

alter table if exists public.organization_invitations enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'organization_invitations'
          and policyname = 'organization_invitations_select'
    ) then
        create policy organization_invitations_select on public.organization_invitations
        for select
        using (
            public.is_organization_member(organization_id, array['owner', 'admin']::text[])
        );
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'organization_invitations'
          and policyname = 'organization_invitations_insert'
    ) then
        create policy organization_invitations_insert on public.organization_invitations
        for insert
        with check (
            public.is_organization_member(organization_id, array['owner', 'admin']::text[])
        );
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'organization_invitations'
          and policyname = 'organization_invitations_update'
    ) then
        create policy organization_invitations_update on public.organization_invitations
        for update
        using (
            public.is_organization_member(organization_id, array['owner', 'admin']::text[])
        )
        with check (
            public.is_organization_member(organization_id, array['owner', 'admin']::text[])
        );
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'organization_invitations'
          and policyname = 'organization_invitations_delete'
    ) then
        create policy organization_invitations_delete on public.organization_invitations
        for delete
        using (
            public.is_organization_member(organization_id, array['owner', 'admin']::text[])
        );
    end if;
end;
$$;
