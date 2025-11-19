-- 1) Supprimer d'abord la fonction qui dépend de get_user_organizations
drop function if exists public.get_default_organization_id();

-- 2) Supprimer l'ancienne version de get_user_organizations (sans changer le nom ni les paramètres)
drop function if exists public.get_user_organizations();

-- 3) Recréer get_user_organizations avec la nouvelle signature étendue
create function public.get_user_organizations()
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

-- 4) Recréer la fonction utilitaire qui l'utilise
create function public.get_default_organization_id()
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
