create table if not exists public.workspace_snapshots (
  id text primary key,
  department_count integer default 0,
  role_count integer default 0,
  detail_count integer default 0,
  diagram_process_count integer default 0,
  last_organigram_update timestamptz,
  last_diagram_update timestamptz,
  updated_at timestamptz default timezone('utc', now())
);

comment on table public.workspace_snapshots is 'Aggregated workspace metrics shared between the Mermaid Process Visualizer pages.';
comment on column public.workspace_snapshots.id is 'Stable identifier for the workspace snapshot entry.';
comment on column public.workspace_snapshots.department_count is 'Number of departments configured in the workspace.';
comment on column public.workspace_snapshots.role_count is 'Number of roles configured in the workspace.';
comment on column public.workspace_snapshots.detail_count is 'Number of enriched detail sheets captured on the departments page.';
comment on column public.workspace_snapshots.diagram_process_count is 'Number of process steps configured in the diagram workspace.';
comment on column public.workspace_snapshots.last_organigram_update is 'Timestamp of the last change performed on the departments page.';
comment on column public.workspace_snapshots.last_diagram_update is 'Timestamp of the last change performed on the diagram workspace.';
comment on column public.workspace_snapshots.updated_at is 'Automatic timestamp of the last synchronisation.';
