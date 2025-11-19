insert into public.subscription_plans (slug, name, description, max_owners, max_admins, max_members)
values
    ('starter', 'Starter', 'For small teams just getting started.', 1, 2, 10),
    ('scale', 'Scale', 'For growing organizations needing more seats.', 2, 5, 50)
on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    max_owners = excluded.max_owners,
    max_admins = excluded.max_admins,
    max_members = excluded.max_members,
    updated_at = timezone('utc', now());
