set search_path = public;

create table if not exists public.process_snapshots (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Étapes du processus',
    steps jsonb not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint process_snapshots_owner_id_key unique (owner_id)
);
