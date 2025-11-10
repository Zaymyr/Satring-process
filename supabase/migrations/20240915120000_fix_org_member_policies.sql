set search_path = public;

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

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select
using (
    public.is_organization_member(id)
);

-- Limit updates and deletes to organization admins/owners
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
for update
using (
    public.is_organization_member(id, array['owner', 'admin']::text[])
)
with check (
    public.is_organization_member(id, array['owner', 'admin']::text[])
);

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
for delete
using (
    public.is_organization_member(id, array['owner', 'admin']::text[])
);

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
for select
using (
    organization_members.user_id = auth.uid()
    or public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);

drop policy if exists organization_members_insert on public.organization_members;
create policy organization_members_insert on public.organization_members
for insert
with check (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);

drop policy if exists organization_members_update on public.organization_members;
create policy organization_members_update on public.organization_members
for update
using (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
)
with check (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);

drop policy if exists organization_members_delete on public.organization_members;
create policy organization_members_delete on public.organization_members
for delete
using (
    public.is_organization_member(organization_members.organization_id, array['owner', 'admin']::text[])
);
