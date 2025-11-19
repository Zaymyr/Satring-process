set search_path = public;

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
