set search_path = public;

grant execute on function public.get_organization_members(uuid) to authenticated;
grant execute on function public.get_organization_members(uuid) to service_role;
