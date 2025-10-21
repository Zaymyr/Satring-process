import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { workspaceSnapshots } from '@/drizzle/schema';
import { updateWorkspaceSnapshotSchema, workspaceSnapshotSchema } from '@/lib/schemas/workspace-snapshot';

type WorkspaceSnapshotRow = typeof workspaceSnapshots.$inferSelect;

const mapRow = (row: WorkspaceSnapshotRow) =>
  workspaceSnapshotSchema.parse({
    id: row.id,
    departmentCount: row.departmentCount,
    roleCount: row.roleCount,
    detailCount: row.detailCount,
    diagramProcessCount: row.diagramProcessCount,
    lastOrganigramUpdate: row.lastOrganigramUpdate?.toISOString() ?? null,
    lastDiagramUpdate: row.lastDiagramUpdate?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString()
  });

export async function GET() {
  const supabase = createServerClient(cookies());
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const existing = await db.query.workspaceSnapshots.findFirst({
    where: eq(workspaceSnapshots.ownerId, session.user.id)
  });

  if (!existing) {
    const empty = workspaceSnapshotSchema.parse({
      id: session.user.id,
      departmentCount: 0,
      roleCount: 0,
      detailCount: 0,
      diagramProcessCount: 0,
      lastOrganigramUpdate: null,
      lastDiagramUpdate: null,
      updatedAt: new Date().toISOString()
    });
    return NextResponse.json(empty);
  }

  return NextResponse.json(mapRow(existing));
}

export async function PUT(request: Request) {
  const supabase = createServerClient(cookies());
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateWorkspaceSnapshotSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const { data, error } = await supabase.rpc('update_workspace_snapshot', {
    payload: {
      id: session.user.id,
      department_count: payload.departmentCount,
      role_count: payload.roleCount,
      detail_count: payload.detailCount,
      diagram_process_count: payload.diagramProcessCount,
      last_organigram_update: payload.lastOrganigramUpdate,
      last_diagram_update: payload.lastDiagramUpdate
    }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Mise à jour indisponible" }, { status: 500 });
  }

  return NextResponse.json(
    workspaceSnapshotSchema.parse({
      id: data.id,
      departmentCount: data.department_count,
      roleCount: data.role_count,
      detailCount: data.detail_count,
      diagramProcessCount: data.diagram_process_count,
      lastOrganigramUpdate: data.last_organigram_update,
      lastDiagramUpdate: data.last_diagram_update,
      updatedAt: data.updated_at
    })
  );
}
