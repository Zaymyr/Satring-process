set search_path = public;

alter table if exists public.user_profiles
  add column if not exists onboarding_overlay_state jsonb;
