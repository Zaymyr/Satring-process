-- Prevent default personal organization creation when users are invited by an existing organization.
-- Idempotent: updates the function in place without altering the trigger.
create or replace function public.create_default_org_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_org_id uuid;
    org_name text;
    invited_org_id text;
    skip_default boolean;
begin
    invited_org_id := nullif(trim(new.raw_user_meta_data->>'invited_by_organization_id'), '');
    skip_default := coalesce(lower(new.raw_user_meta_data->>'skip_default_organization') = 'true', false);

    if skip_default or invited_org_id is not null then
        return new;
    end if;

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
