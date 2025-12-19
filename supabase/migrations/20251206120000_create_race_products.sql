create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint products_name_length check (char_length(name) between 1 and 180)
);

create unique index if not exists products_name_lower_idx on public.products (lower(name));
create index if not exists products_created_at_idx on public.products(created_at);
create index if not exists products_updated_at_idx on public.products(updated_at);

alter table if exists public.products
  alter column created_by set default auth.uid();

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger products_updated_at
before update on public.products
for each row
execute function public.set_products_updated_at();

alter table if exists public.products enable row level security;

create policy products_select on public.products
for select
using (auth.uid() is not null);

create policy products_insert on public.products
for insert
with check (auth.uid() is not null);

create table if not exists public.user_product_selections (
    user_id uuid not null references auth.users(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete cascade,
    position integer not null check (position >= 0 and position < 3),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint user_product_selections_pkey primary key (user_id, product_id),
    constraint user_product_selections_position_unique unique (user_id, position)
);

create index if not exists user_product_selections_product_idx on public.user_product_selections(product_id);
create index if not exists user_product_selections_updated_at_idx on public.user_product_selections(updated_at);

create or replace function public.set_user_product_selections_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger user_product_selections_updated_at
before update on public.user_product_selections
for each row
execute function public.set_user_product_selections_updated_at();

alter table if exists public.user_product_selections enable row level security;

create policy user_product_selections_select on public.user_product_selections
for select
using (auth.uid() = user_id);

create policy user_product_selections_insert on public.user_product_selections
for insert
with check (auth.uid() = user_id);

create policy user_product_selections_delete on public.user_product_selections
for delete
using (auth.uid() = user_id);
