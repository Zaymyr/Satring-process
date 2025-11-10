-- Create organizations table
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

-- Create organization members table
create table if not exists public.organization_members (
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'member')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint organization_members_pkey primary key (organization_id, user_id)
);

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

-- Ensure a creator automatically becomes owner of the organization
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

-- Enable RLS and policies for organizations
alter table if exists public.organizations enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = id
          and om.user_id = auth.uid()
    )
);

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
for insert
with check (auth.uid() = created_by);

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
for update
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
    )
)
with check (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
    )
);

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
for delete
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = id
          and om.user_id = auth.uid()
          and om.role = 'owner'
    )
);

-- Enable RLS and policies for organization members
alter table if exists public.organization_members enable row level security;

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
for select
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_members.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
    )
);

drop policy if exists organization_members_insert on public.organization_members;
create policy organization_members_insert on public.organization_members
for insert
with check (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_members.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
    )
);

drop policy if exists organization_members_update on public.organization_members;
create policy organization_members_update on public.organization_members
for update
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_members.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
    )
)
with check (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_members.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
    )
);

drop policy if exists organization_members_delete on public.organization_members;
create policy organization_members_delete on public.organization_members
for delete
using (
    exists (
        select 1
        from public.organization_members om
        where om.organization_id = organization_members.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
    )
);

-- Seed organizations for existing owners
with distinct_owners as (
    select owner_id
    from public.process_snapshots
    union
    select owner_id
    from public.departments
    union
    select owner_id
    from public.roles
    union
    select owner_id
    from public.user_onboarding_states
)
insert into public.organizations (id, name, created_by)
select owner_id, 'Espace personnel', owner_id
from distinct_owners
where owner_id is not null
on conflict (id) do nothing;

with distinct_owners as (
    select owner_id
    from public.process_snapshots
    union
    select owner_id
    from public.departments
    union
    select owner_id
    from public.roles
    union
    select owner_id
    from public.user_onboarding_states
)
insert into public.organization_members (organization_id, user_id, role)
select owner_id, owner_id, 'owner'
from distinct_owners
where owner_id is not null
on conflict (organization_id, user_id) do nothing;

-- Add organization_id columns to domain tables
alter table if exists public.process_snapshots
    add column if not exists organization_id uuid;

update public.process_snapshots
set organization_id = coalesce(organization_id, owner_id)
where organization_id is null;

alter table if exists public.process_snapshots
    alter column organization_id set not null;

alter table if exists public.process_snapshots
    drop constraint if exists process_snapshots_organization_id_fkey;

alter table if exists public.process_snapshots
    add constraint process_snapshots_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;

create index if not exists process_snapshots_organization_id_idx on public.process_snapshots(organization_id);

alter table if exists public.departments
    add column if not exists organization_id uuid;

update public.departments
set organization_id = coalesce(organization_id, owner_id)
where organization_id is null;

alter table if exists public.departments
    alter column organization_id set not null;

alter table if exists public.departments
    drop constraint if exists departments_organization_id_fkey;

alter table if exists public.departments
    add constraint departments_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;

create index if not exists departments_organization_id_idx on public.departments(organization_id);

alter table if exists public.roles
    add column if not exists organization_id uuid;

update public.roles
set organization_id = coalesce(organization_id, owner_id)
where organization_id is null;

alter table if exists public.roles
    alter column organization_id set not null;

alter table if exists public.roles
    drop constraint if exists roles_organization_id_fkey;

alter table if exists public.roles
    add constraint roles_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;

create index if not exists roles_organization_id_idx on public.roles(organization_id);

drop index if exists roles_owner_department_name_idx;
create unique index if not exists roles_org_department_name_idx
    on public.roles (organization_id, department_id, lower(name));

-- Adjust user onboarding states to track organization
alter table if exists public.user_onboarding_states
    add column if not exists organization_id uuid;

update public.user_onboarding_states
set organization_id = coalesce(organization_id, owner_id)
where organization_id is null;

alter table if exists public.user_onboarding_states
    alter column organization_id set not null;

alter table if exists public.user_onboarding_states
    drop constraint if exists user_onboarding_states_organization_id_fkey;

alter table if exists public.user_onboarding_states
    add constraint user_onboarding_states_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;

-- Replace primary key with organization_id
alter table if exists public.user_onboarding_states
    drop constraint if exists user_onboarding_states_pkey;

alter table if exists public.user_onboarding_states
    add constraint user_onboarding_states_pkey primary key (organization_id);

create index if not exists user_onboarding_states_owner_id_idx on public.user_onboarding_states(owner_id);

-- Update RLS policies to leverage organization membership
drop policy if exists process_snapshots_select on public.process_snapshots;
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

drop policy if exists process_snapshots_insert on public.process_snapshots;
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

drop policy if exists process_snapshots_update on public.process_snapshots;
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

drop policy if exists process_snapshots_delete on public.process_snapshots;
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

drop policy if exists departments_select on public.departments;
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

drop policy if exists departments_insert on public.departments;
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

drop policy if exists departments_update on public.departments;
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

drop policy if exists departments_delete on public.departments;
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

drop policy if exists roles_select on public.roles;
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

drop policy if exists roles_insert on public.roles;
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

drop policy if exists roles_update on public.roles;
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

drop policy if exists roles_delete on public.roles;
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

drop policy if exists user_onboarding_states_select on public.user_onboarding_states;
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

drop policy if exists user_onboarding_states_insert on public.user_onboarding_states;
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

drop policy if exists user_onboarding_states_update on public.user_onboarding_states;
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

-- Utility function returning organizations for the current user
create or replace function public.get_user_organizations()
returns table(id uuid, name text, role text)
language sql
security definer
set search_path = public
stable
as $$
    select o.id, o.name, om.role
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = auth.uid()
    order by
        case om.role when 'owner' then 0 when 'admin' then 1 else 2 end,
        o.created_at;
$$;

grant execute on function public.get_user_organizations() to authenticated;

-- Helper to resolve default organization for current user
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

-- Update process management functions to support organizations
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
                jsonb_build_object('id', 'prioritize-actions', 'label', 'Prioriser les actions', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'implement-improvements', 'noTargetId', 'collect-feedback'),
                jsonb_build_object('id', 'implement-improvements', 'label', 'Mettre en œuvre les améliorations', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_project_lead_role_id::text, 'yesTargetId', 'measure-impact', 'noTargetId', null),
                jsonb_build_object('id', 'measure-impact', 'label', 'Mesurer l''impact', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_analyst_role_id::text, 'yesTargetId', 'communicate-results', 'noTargetId', 'prioritize-actions'),
                jsonb_build_object('id', 'communicate-results', 'label', 'Partager les résultats', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Boucle d''amélioration complétée', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
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
