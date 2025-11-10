set search_path = public;

create table if not exists public.user_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create trigger user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

alter table if exists public.user_profiles enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
for select
using (auth.uid() = user_id);

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert on public.user_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
