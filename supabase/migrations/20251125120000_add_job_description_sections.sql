-- Add structured columns for job descriptions
alter table if exists public.job_descriptions
    add column if not exists title text not null default 'Fiche de poste',
    add column if not exists general_description text not null default '',
    add column if not exists responsibilities text[] not null default '{}',
    add column if not exists objectives text[] not null default '{}',
    add column if not exists collaboration text[] not null default '{}';

-- Backfill existing rows to ensure required fields are populated
update public.job_descriptions
set
    title = coalesce(nullif(title, ''), 'Fiche de poste'),
    general_description = case when coalesce(general_description, '') = '' then content else general_description end,
    responsibilities = coalesce(responsibilities, '{}'::text[]),
    objectives = coalesce(objectives, '{}'::text[]),
    collaboration = coalesce(collaboration, '{}'::text[]);
