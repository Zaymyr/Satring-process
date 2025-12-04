-- Ensure default organizations created on signup automatically receive the starter plan.
-- Idempotent: recreates the trigger function with defensive checks and upsert logic.

create or replace function public.create_default_org_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_org_id uuid;
    org_name text;
    starter_plan_id uuid;
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
    returning id into existing_org_id;

    select id into starter_plan_id
    from public.subscription_plans
    where slug = 'starter'
    limit 1;

    if starter_plan_id is not null then
        insert into public.organization_plan_subscriptions (organization_id, plan_id)
        values (existing_org_id, starter_plan_id)
        on conflict (organization_id) do update set plan_id = excluded.plan_id;
    end if;

    return new;
end;
$$;
