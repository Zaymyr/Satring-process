create or replace function public.get_organization_members(target_org_id uuid)
returns table (
    user_id uuid,
    email text,
    username text,
    role text,
    joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_organization_member(target_org_id) then
        raise exception 'Accès refusé à cette organisation' using errcode = '42501';
    end if;

    return query
    select
        om.user_id,
        au.email::text,
        up.username::text,
        om.role::text,
        om.created_at as joined_at
    from public.organization_members om
    join auth.users au on au.id = om.user_id
    left join public.user_profiles up on up.user_id = om.user_id
    where om.organization_id = target_org_id
    order by om.created_at asc;
end;
$$;
