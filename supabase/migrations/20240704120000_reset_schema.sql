set search_path = public;

drop function if exists public.update_workspace_snapshot(jsonb);

drop policy if exists workspace_snapshots_select on public.workspace_snapshots;
drop policy if exists workspace_snapshots_insert on public.workspace_snapshots;
drop policy if exists workspace_snapshots_update on public.workspace_snapshots;
drop policy if exists workspace_snapshots_delete on public.workspace_snapshots;

drop table if exists public.workspace_snapshots cascade;
drop table if exists public.departements cascade;
