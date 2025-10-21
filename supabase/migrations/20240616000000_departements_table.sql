set search_path = public;

create table if not exists public.departements (
    id text primary key,
    name text,
    color text,
    metadata jsonb default '{}'::jsonb not null,
    roles jsonb default '[]'::jsonb not null,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table if exists public.departements
    add column if not exists name text;

alter table if exists public.departements
    add column if not exists color text;

alter table if exists public.departements
    add column if not exists metadata jsonb;

alter table if exists public.departements
    add column if not exists roles jsonb;

alter table if exists public.departements
    add column if not exists created_at timestamptz;

alter table if exists public.departements
    alter column metadata set default '{}'::jsonb;

alter table if exists public.departements
    alter column roles set default '[]'::jsonb;

alter table if exists public.departements
    alter column created_at set default timezone('utc'::text, now());

update public.departements
set metadata = '{}'::jsonb
where metadata is null;

update public.departements
set roles = '[]'::jsonb
where roles is null;

update public.departements
set created_at = timezone('utc'::text, now())
where created_at is null;

alter table if exists public.departements
    alter column metadata set not null;

alter table if exists public.departements
    alter column roles set not null;

alter table if exists public.departements
    alter column created_at set not null;

alter table public.departements enable row level security;

drop policy if exists departements_read on public.departements;
drop policy if exists departements_insert on public.departements;
drop policy if exists departements_update on public.departements;
drop policy if exists departements_delete on public.departements;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departements'
          and policyname = 'departements_read'
    ) then
        create policy departements_read on public.departements
            for select
            to anon, authenticated
            using (true);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departements'
          and policyname = 'departements_insert'
    ) then
        create policy departements_insert on public.departements
            for insert
            to anon, authenticated
            with check (true);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departements'
          and policyname = 'departements_update'
    ) then
        create policy departements_update on public.departements
            for update
            to anon, authenticated
            using (true)
            with check (true);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'departements'
          and policyname = 'departements_delete'
    ) then
        create policy departements_delete on public.departements
            for delete
            to anon, authenticated
            using (true);
    end if;
end
$$;

insert into public.departements (id, name, color, metadata, roles)
values
    (
        'direction-generale',
        'Direction générale',
        '#0ea5e9',
        jsonb_build_object(
            'lead', 'Camille Dupont',
            'description', 'Pilote la stratégie globale et coordonne les équipes.',
            'objectives', 'Définir la vision et suivre la performance',
            'notes', ''
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'role-1',
                'name', 'Directeur Général',
                'color', '#38bdf8',
                'metadata', jsonb_build_object(
                    'owner', 'Camille Dupont',
                    'responsibilities', 'Piloter la stratégie de l''entreprise et prendre les décisions clés',
                    'skills', 'Leadership, vision stratégique',
                    'notes', ''
                )
            ),
            jsonb_build_object(
                'id', 'role-2',
                'name', 'Office Manager',
                'color', '#f472b6',
                'metadata', jsonb_build_object(
                    'owner', 'Alex Martin',
                    'responsibilities', 'Coordonner les opérations administratives quotidiennes',
                    'skills', 'Organisation, communication',
                    'notes', ''
                )
            )
        )
    ),
    (
        'operations',
        'Opérations',
        '#22c55e',
        jsonb_build_object(
            'lead', 'Nora El Haddad',
            'description', 'Supervise la livraison des projets et le support interne.',
            'objectives', 'Améliorer l''efficacité et la qualité opérationnelle',
            'notes', ''
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'role-1',
                'name', 'Responsable Opérations',
                'color', '#34d399',
                'metadata', jsonb_build_object(
                    'owner', 'Nora El Haddad',
                    'responsibilities', 'Piloter les projets transverses et optimiser les processus',
                    'skills', 'Gestion de projet, analyse',
                    'notes', ''
                )
            ),
            jsonb_build_object(
                'id', 'role-2',
                'name', 'Coordinateur Support',
                'color', '#fb7185',
                'metadata', jsonb_build_object(
                    'owner', 'Louis Bernard',
                    'responsibilities', 'Assurer le support aux équipes internes et suivre les demandes',
                    'skills', 'Service client, résolution de problèmes',
                    'notes', ''
                )
            )
        )
    ),
    (
        'produit',
        'Produit',
        '#f97316',
        jsonb_build_object(
            'lead', 'Inès Caron',
            'description', 'Conçoit l''offre produit et pilote la feuille de route.',
            'objectives', 'Aligner l''équipe sur la vision produit et livrer de nouvelles fonctionnalités',
            'notes', ''
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'role-1',
                'name', 'Product Manager',
                'color', '#fde68a',
                'metadata', jsonb_build_object(
                    'owner', 'Inès Caron',
                    'responsibilities', 'Définir la feuille de route produit et prioriser les besoins utilisateurs',
                    'skills', 'Analyse, communication',
                    'notes', ''
                )
            ),
            jsonb_build_object(
                'id', 'role-2',
                'name', 'UX Designer',
                'color', '#c084fc',
                'metadata', jsonb_build_object(
                    'owner', 'Sarah Nguyen',
                    'responsibilities', 'Concevoir des expériences utilisateurs cohérentes et accessibles',
                    'skills', 'Design, recherche utilisateur',
                    'notes', ''
                )
            )
        )
    )
on conflict (id) do update set
    name = excluded.name,
    color = excluded.color,
    metadata = excluded.metadata,
    roles = excluded.roles;
