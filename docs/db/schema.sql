set search_path = public;

create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists organizations_created_at_idx on public.organizations(created_at);
create index if not exists organizations_updated_at_idx on public.organizations(updated_at);

create or replace function public.set_organizations_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger organizations_updated_at
before update on public.organizations
for each row
execute function public.set_organizations_updated_at();

create table if not exists public.organization_members (
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'member')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint organization_members_pkey primary key (organization_id, user_id)
);

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

create policy organization_invitations_select on public.organization_invitations
for select
using (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
);

create policy organization_invitations_insert on public.organization_invitations
for insert
with check (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
);

create policy organization_invitations_update on public.organization_invitations
for update
using (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
)
with check (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
);

create policy organization_invitations_delete on public.organization_invitations
for delete
using (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
);

create table if not exists public.user_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

alter table if exists public.user_profiles enable row level security;

create policy user_profiles_select on public.user_profiles
for select
using (auth.uid() = user_id);

create policy user_profiles_insert on public.user_profiles
for insert
with check (auth.uid() = user_id);

create policy user_profiles_update on public.user_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_members_role_idx on public.organization_members(role);
create index if not exists organization_members_updated_at_idx on public.organization_members(updated_at);

create or replace function public.set_organization_members_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger organization_members_updated_at
before update on public.organization_members
for each row
execute function public.set_organization_members_updated_at();

create table if not exists public.subscription_plans (
    id uuid primary key default gen_random_uuid(),
    slug text not null,
    name text not null,
    description text,
    max_owners integer not null check (max_owners >= 0),
    max_admins integer not null check (max_admins >= 0),
    max_members integer not null check (max_members >= 0),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists subscription_plans_slug_key on public.subscription_plans(slug);
create index if not exists subscription_plans_created_at_idx on public.subscription_plans(created_at);
create index if not exists subscription_plans_updated_at_idx on public.subscription_plans(updated_at);

create or replace function public.set_subscription_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger subscription_plans_updated_at
before update on public.subscription_plans
for each row
execute function public.set_subscription_plans_updated_at();

alter table if exists public.subscription_plans enable row level security;

create policy subscription_plans_select on public.subscription_plans
for select
using (true);

create table if not exists public.organization_plan_subscriptions (
    organization_id uuid primary key references public.organizations(id) on delete cascade,
    plan_id uuid not null references public.subscription_plans(id) on delete restrict,
    subscribed_at timestamptz not null default timezone('utc', now()),
    renews_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists organization_plan_subscriptions_plan_idx
    on public.organization_plan_subscriptions(plan_id);
create index if not exists organization_plan_subscriptions_renews_at_idx
    on public.organization_plan_subscriptions(renews_at);
create index if not exists organization_plan_subscriptions_updated_at_idx
    on public.organization_plan_subscriptions(updated_at);

create or replace function public.set_organization_plan_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger organization_plan_subscriptions_updated_at
before update on public.organization_plan_subscriptions
for each row
execute function public.set_organization_plan_subscriptions_updated_at();

alter table if exists public.organization_plan_subscriptions enable row level security;

create policy organization_plan_subscriptions_select on public.organization_plan_subscriptions
for select
using (
    public.is_organization_member(organization_id)
);

create policy organization_plan_subscriptions_insert on public.organization_plan_subscriptions
for insert
with check (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
);

create policy organization_plan_subscriptions_update on public.organization_plan_subscriptions
for update
using (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
)
with check (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
);

create policy organization_plan_subscriptions_delete on public.organization_plan_subscriptions
for delete
using (
    public.is_organization_member(organization_id, array['owner', 'admin']::text[])
);

create or replace function public.is_organization_member(target_org_id uuid, allowed_roles text[] default null)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.organization_members om
        where om.organization_id = target_org_id
          and om.user_id = auth.uid()
          and (
              allowed_roles is null
              or om.role = any(allowed_roles)
          )
    );
$$;

alter function public.is_organization_member(uuid, text[]) owner to postgres;

create or replace function public.ensure_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.created_by is not null then
        insert into public.organization_members (organization_id, user_id, role)
        values (new.id, new.created_by, 'owner')
        on conflict (organization_id, user_id) do update set role = excluded.role;
    end if;
    return new;
end;
$$;

create trigger organizations_owner
after insert on public.organizations
for each row
execute function public.ensure_organization_owner();

create or replace function public.create_default_org_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_org_id uuid;
    org_name text;
begin
    select id into existing_org_id
    from public.organizations
    where created_by = new.id
    limit 1;

    if existing_org_id is not null then
        return new;
    end if;

    org_name := coalesce(
        nullif(trim(new.raw_user_meta_data->>'organization_name'), ''),
        case
            when new.email is not null and position('@' in new.email) > 0 then
                'Organisation de ' || split_part(new.email, '@', 1)
            when new.email is not null then
                'Organisation de ' || new.email
            else
                'Nouvelle organisation'
        end
    );

    insert into public.organizations (name, created_by)
    values (org_name, new.id)
    on conflict do nothing;

    return new;
end;
$$;

create trigger create_default_org_on_signup
after insert on auth.users
for each row
execute function public.create_default_org_on_signup();

alter table if exists public.organizations enable row level security;

create policy organizations_select on public.organizations
for select
using (
    public.is_organization_member(id)
);

create policy organizations_insert on public.organizations
for insert
with check (auth.uid() = created_by);

create policy organizations_update on public.organizations
for update
using (
    public.is_organization_member(id, array['owner', 'admin']::text[])
)
with check (
    public.is_organization_member(id, array['owner', 'admin']::text[])
);

create policy organizations_delete on public.organizations
for delete
using (
    public.is_organization_member(id, array['owner', 'admin']::text[])
);

alter table if exists public.organization_members enable row level security;

create policy organization_members_select on public.organization_members
for select
using (
    organization_members.user_id = auth.uid()
    or public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);

create policy organization_members_insert on public.organization_members
for insert
with check (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);

create policy organization_members_update on public.organization_members
for update
using (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
)
with check (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);

create policy organization_members_delete on public.organization_members
for delete
using (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);

create table if not exists public.process_snapshots (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    title text not null default 'Étapes du processus',
    steps jsonb not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists process_snapshots_owner_id_idx on public.process_snapshots(owner_id);
create index if not exists process_snapshots_organization_id_idx on public.process_snapshots(organization_id);
create index if not exists process_snapshots_updated_at_idx on public.process_snapshots(updated_at);

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    name text not null,
    color text not null default '#C7D2FE',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint departments_color_check check (color ~ '^#[0-9A-F]{6}$')
);

create index if not exists departments_owner_id_idx on public.departments(owner_id);
create index if not exists departments_organization_id_idx on public.departments(organization_id);
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
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create policy process_snapshots_insert on public.process_snapshots
for insert
with check (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create policy process_snapshots_update on public.process_snapshots
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

create policy process_snapshots_delete on public.process_snapshots
for delete
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

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
    v_requested_org uuid := nullif(trim(payload ->> 'organization_id'), '')::uuid;
    v_organization uuid := coalesce(v_requested_org, public.get_default_organization_id());
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

    if v_organization is null then
        raise exception 'Organisation introuvable' using errcode = '23503';
    end if;

    if not exists (
        select 1
        from public.organization_members om
        where om.organization_id = v_organization
          and om.user_id = v_owner
    ) then
        raise exception 'Accès refusé à cette organisation' using errcode = '42501';
    end if;

    insert into public.process_snapshots (owner_id, organization_id, steps, title)
    values (v_owner, v_organization, v_steps, v_title)
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
    v_organization uuid;
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

    select ps.organization_id
    into v_organization
    from public.process_snapshots ps
    where ps.id = v_id
    for update;

    if not found then
        raise exception 'Process introuvable' using errcode = 'P0002';
    end if;

    if not exists (
        select 1
        from public.organization_members om
        where om.organization_id = v_organization
          and om.user_id = v_owner
    ) then
        raise exception 'Accès refusé à cette organisation' using errcode = '42501';
    end if;

    update public.process_snapshots as ps
    set
        steps = v_steps,
        title = v_title,
        owner_id = v_owner,
        updated_at = timezone('utc', now())
    where ps.id = v_id
    returning ps.* into v_result;

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
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create policy departments_insert on public.departments
for insert
with check (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create policy departments_update on public.departments
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

create policy departments_delete on public.departments
for delete
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    department_id uuid not null references public.departments(id) on delete cascade,
    name text not null,
    color text not null default '#C7D2FE',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint roles_color_check check (color ~ '^#[0-9A-F]{6}$')
);

create index if not exists roles_owner_id_idx on public.roles(owner_id);
create index if not exists roles_organization_id_idx on public.roles(organization_id);
create index if not exists roles_department_id_idx on public.roles(department_id);
create index if not exists roles_updated_at_idx on public.roles(updated_at);

create unique index if not exists roles_org_department_name_idx
  on public.roles (organization_id, department_id, lower(name));

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

create trigger roles_updated_at
before update on public.roles
for each row
execute function public.set_roles_updated_at();

alter table if exists public.roles enable row level security;

create policy roles_select on public.roles
for select
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create policy roles_insert on public.roles
for insert
with check (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
    and exists (
        select 1
        from public.departments d
        where d.id = department_id
          and d.organization_id = organization_id
    )
);

create policy roles_update on public.roles
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
    and exists (
        select 1
        from public.departments d
        where d.id = department_id
          and d.organization_id = organization_id
    )
);

create policy roles_delete on public.roles
for delete
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create table if not exists public.job_descriptions (
    id uuid primary key default gen_random_uuid(),
    role_id uuid not null references public.roles(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    title text not null default 'Fiche de poste',
    general_description text not null default '',
    responsibilities text[] not null default '{}',
    objectives text[] not null default '{}',
    collaboration text[] not null default '{}',
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

create trigger job_descriptions_updated_at
before update on public.job_descriptions
for each row
execute function public.set_job_descriptions_updated_at();

alter table if exists public.job_descriptions enable row level security;

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

create table if not exists public.user_onboarding_states (
    organization_id uuid primary key references public.organizations(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    sample_seeded_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_user_onboarding_states_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger user_onboarding_states_updated_at
before update on public.user_onboarding_states
for each row
execute function public.set_user_onboarding_states_updated_at();

alter table if exists public.user_onboarding_states enable row level security;

create policy user_onboarding_states_select on public.user_onboarding_states
for select
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create policy user_onboarding_states_insert on public.user_onboarding_states
for insert
with check (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_id
          and om.user_id = auth.uid()
    )
);

create policy user_onboarding_states_update on public.user_onboarding_states
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

create or replace function public.seed_sample_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner uuid := auth.uid();
    v_now timestamptz := timezone('utc', now());
    v_organization uuid := public.get_default_organization_id();
    v_state public.user_onboarding_states;
    v_support_department_id uuid;
    v_operations_department_id uuid;
    v_finance_department_id uuid;
    v_support_manager_role_id uuid := gen_random_uuid();
    v_support_agent_role_id uuid := gen_random_uuid();
    v_support_analyst_role_id uuid := gen_random_uuid();
    v_operations_manager_role_id uuid := gen_random_uuid();
    v_operations_coordinator_role_id uuid := gen_random_uuid();
    v_operations_technician_role_id uuid := gen_random_uuid();
    v_operations_project_lead_role_id uuid := gen_random_uuid();
    v_finance_director_role_id uuid := gen_random_uuid();
    v_finance_accountant_role_id uuid := gen_random_uuid();
    v_finance_controller_role_id uuid := gen_random_uuid();
begin
    if v_owner is null then
        raise exception 'Authentification requise' using errcode = '28000';
    end if;

    if v_organization is null then
        return jsonb_build_object('seeded', false, 'reason', 'no_organization');
    end if;

    insert into public.user_onboarding_states (organization_id, owner_id)
    values (v_organization, v_owner)
    on conflict (organization_id) do update
        set owner_id = excluded.owner_id,
            updated_at = v_now;

    select *
    into v_state
    from public.user_onboarding_states
    where organization_id = v_organization
    for update;

    if v_state.sample_seeded_at is not null then
        return jsonb_build_object('seeded', false, 'reason', 'already_seeded');
    end if;

    if exists (select 1 from public.process_snapshots where organization_id = v_organization)
        or exists (select 1 from public.departments where organization_id = v_organization) then
        update public.user_onboarding_states
        set sample_seeded_at = v_now,
            updated_at = v_now
        where organization_id = v_organization;

        return jsonb_build_object('seeded', false, 'reason', 'existing_data');
    end if;

    v_support_department_id := gen_random_uuid();
    v_operations_department_id := gen_random_uuid();
    v_finance_department_id := gen_random_uuid();

    insert into public.departments (id, owner_id, organization_id, name, color, created_at, updated_at)
    values
        (v_support_department_id, v_owner, v_organization, 'Service client', '#60A5FA', v_now, v_now),
        (v_operations_department_id, v_owner, v_organization, 'Opérations', '#34D399', v_now, v_now),
        (v_finance_department_id, v_owner, v_organization, 'Finance', '#FACC15', v_now, v_now);

    insert into public.roles (id, owner_id, organization_id, department_id, name, color, created_at, updated_at)
    values
        (v_support_manager_role_id, v_owner, v_organization, v_support_department_id, 'Responsable support', '#2563EB', v_now, v_now),
        (v_support_agent_role_id, v_owner, v_organization, v_support_department_id, 'Agent service client', '#38BDF8', v_now, v_now),
        (v_support_analyst_role_id, v_owner, v_organization, v_support_department_id, 'Analyste qualité', '#0EA5E9', v_now, v_now),
        (v_operations_manager_role_id, v_owner, v_organization, v_operations_department_id, 'Responsable opérations', '#16A34A', v_now, v_now),
        (v_operations_coordinator_role_id, v_owner, v_organization, v_operations_department_id, 'Coordinateur terrain', '#22C55E', v_now, v_now),
        (v_operations_technician_role_id, v_owner, v_organization, v_operations_department_id, 'Technicien support', '#059669', v_now, v_now),
        (v_operations_project_lead_role_id, v_owner, v_organization, v_operations_department_id, 'Chef de projet', '#10B981', v_now, v_now),
        (v_finance_director_role_id, v_owner, v_organization, v_finance_department_id, 'Directeur financier', '#F97316', v_now, v_now),
        (v_finance_accountant_role_id, v_owner, v_organization, v_finance_department_id, 'Comptable fournisseurs', '#F59E0B', v_now, v_now),
        (v_finance_controller_role_id, v_owner, v_organization, v_finance_department_id, 'Contrôleur de gestion', '#D97706', v_now, v_now);

    insert into public.process_snapshots (owner_id, organization_id, title, steps, created_at, updated_at)
    values
        (
            v_owner,
            v_organization,
            'Traitement d''un incident client',
            jsonb_build_array(
                jsonb_build_object('id', 'start', 'label', 'Signalement reçu', 'type', 'start', 'departmentId', null, 'roleId', null, 'yesTargetId', 'collect-incident', 'noTargetId', null),
                jsonb_build_object('id', 'collect-incident', 'label', 'Collecter les détails de l''incident', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_agent_role_id::text, 'yesTargetId', 'qualify-severity', 'noTargetId', null),
                jsonb_build_object('id', 'qualify-severity', 'label', 'Qualifier la gravité', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_analyst_role_id::text, 'yesTargetId', 'dispatch-team', 'noTargetId', 'communicate-solution'),
                jsonb_build_object('id', 'dispatch-team', 'label', 'Dépêcher l''équipe d''intervention', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_coordinator_role_id::text, 'yesTargetId', 'fix-issue', 'noTargetId', null),
                jsonb_build_object('id', 'fix-issue', 'label', 'Résoudre l''incident', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_technician_role_id::text, 'yesTargetId', 'quality-check', 'noTargetId', null),
                jsonb_build_object('id', 'quality-check', 'label', 'Vérifier la résolution', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_analyst_role_id::text, 'yesTargetId', 'communicate-solution', 'noTargetId', 'dispatch-team'),
                jsonb_build_object('id', 'communicate-solution', 'label', 'Informer le client de la solution', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Incident clôturé', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
            ),
            v_now,
            v_now
        ),
        (
            v_owner,
            v_organization,
            'Validation d''une facture fournisseur',
            jsonb_build_array(
                jsonb_build_object('id', 'start', 'label', 'Réception de la facture', 'type', 'start', 'departmentId', null, 'roleId', null, 'yesTargetId', 'receive-invoice', 'noTargetId', null),
                jsonb_build_object('id', 'receive-invoice', 'label', 'Enregistrer la facture', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_accountant_role_id::text, 'yesTargetId', 'verify-details', 'noTargetId', null),
                jsonb_build_object('id', 'verify-details', 'label', 'Contrôler les informations', 'type', 'decision', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_controller_role_id::text, 'yesTargetId', 'approve-budget', 'noTargetId', 'request-info'),
                jsonb_build_object('id', 'request-info', 'label', 'Demander des compléments au fournisseur', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_agent_role_id::text, 'yesTargetId', 'verify-details', 'noTargetId', null),
                jsonb_build_object('id', 'approve-budget', 'label', 'Valider le budget', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_director_role_id::text, 'yesTargetId', 'schedule-payment', 'noTargetId', null),
                jsonb_build_object('id', 'schedule-payment', 'label', 'Programmer le paiement', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_accountant_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Paiement confirmé', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
            ),
            v_now,
            v_now
        ),
        (
            v_owner,
            v_organization,
            'Amélioration continue du service client',
            jsonb_build_array(
                jsonb_build_object('id', 'start', 'label', 'Collecte des retours clients', 'type', 'start', 'departmentId', null, 'roleId', null, 'yesTargetId', 'collect-feedback', 'noTargetId', null),
                jsonb_build_object('id', 'collect-feedback', 'label', 'Centraliser les retours', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_agent_role_id::text, 'yesTargetId', 'analyze-trends', 'noTargetId', null),
                jsonb_build_object('id', 'analyze-trends', 'label', 'Analyser les tendances', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_analyst_role_id::text, 'yesTargetId', 'prioritize-actions', 'noTargetId', null),
                jsonb_build_object('id', 'prioritize-actions', 'label', 'Prioriser les actions', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'design-solution', 'noTargetId', 'finish'),
                jsonb_build_object('id', 'design-solution', 'label', 'Concevoir une amélioration', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_project_lead_role_id::text, 'yesTargetId', 'budget-review', 'noTargetId', null),
                jsonb_build_object('id', 'budget-review', 'label', 'Réviser le budget', 'type', 'decision', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_controller_role_id::text, 'yesTargetId', 'validate-investment', 'noTargetId', 'revise-scope'),
                jsonb_build_object('id', 'revise-scope', 'label', 'Réajuster le périmètre', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_manager_role_id::text, 'yesTargetId', 'budget-review', 'noTargetId', null),
                jsonb_build_object('id', 'validate-investment', 'label', 'Valider l''investissement', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_director_role_id::text, 'yesTargetId', 'deploy-improvements', 'noTargetId', null),
                jsonb_build_object('id', 'deploy-improvements', 'label', 'Déployer les améliorations', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_coordinator_role_id::text, 'yesTargetId', 'communicate-updates', 'noTargetId', null),
                jsonb_build_object('id', 'communicate-updates', 'label', 'Informer les clients', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Cycle d''amélioration clôturé', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
            ),
            v_now,
            v_now
        );

    update public.user_onboarding_states
    set sample_seeded_at = v_now,
        updated_at = v_now
    where organization_id = v_organization;

    return jsonb_build_object('seeded', true);
end;
$$;

grant execute on function public.seed_sample_data() to authenticated;

create or replace function public.get_user_organizations()
returns table(
    id uuid,
    name text,
    role text,
    plan_slug text,
    plan_name text,
    max_owners integer,
    max_admins integer,
    max_members integer
)
language sql
security definer
set search_path = public
stable
as $$
    select
        o.id,
        o.name,
        om.role,
        sp.slug as plan_slug,
        sp.name as plan_name,
        sp.max_owners,
        sp.max_admins,
        sp.max_members
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    left join public.organization_plan_subscriptions ops on ops.organization_id = o.id
    left join public.subscription_plans sp on sp.id = ops.plan_id
    where om.user_id = auth.uid()
    order by
        case om.role when 'owner' then 0 when 'admin' then 1 else 2 end,
        o.created_at;
$$;

grant execute on function public.get_user_organizations() to authenticated;

create or replace function public.get_default_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select id
    from public.get_user_organizations()
    limit 1;
$$;

grant execute on function public.get_default_organization_id() to authenticated;
