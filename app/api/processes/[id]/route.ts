import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { departments as departmentTable, processSnapshots, roles as roleTable } from '@/drizzle/schema';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { processResponseSchema, processSummarySchema, type ProcessSummary } from '@/lib/validation/process';
import { processContextUpdateSchema, type ProcessContextUpdate } from '@/lib/validation/process-context';
import { fetchUserOrganizations, getManageableOrganizationIds } from '@/lib/organization/memberships';
import { mapDepartmentWriteError, mapRoleWriteError } from '@/app/api/departments/helpers';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

const paramsSchema = z.object({ id: z.string().uuid() });

const renameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Le titre doit contenir au moins un caractère.')
    .max(120, 'Le titre ne peut pas dépasser 120 caractères.')
});

type SupabaseError = {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
};

const isRlsDeniedError = (error: SupabaseError) => {
  const normalizedSegments = [error.message, error.details, error.hint]
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase().replace(/[-_]+/g, ' ') : ''))
    .filter((segment) => segment.length > 0);

  return normalizedSegments.some((segment) =>
    segment.includes('row level security') || segment.includes('permission denied for table')
  );
};

const mapDeleteProcessError = (error: SupabaseError) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return { status: 401, body: { error: 'Authentification requise.' } } as const;
  }

  if (code === '42501') {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de supprimer ce process." }
    } as const;
  }

  if (code === 'P0002') {
    return { status: 404, body: { error: 'Process introuvable.' } } as const;
  }

  if (isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de supprimer ce process." }
    } as const;
  }

  return { status: 500, body: { error: 'Impossible de supprimer le process.' } } as const;
};

const mapSaveProcessError = (error: SupabaseError) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return { status: 401, body: { error: 'Authentification requise.' } } as const;
  }

  if (code === '22P02') {
    return { status: 400, body: { error: 'Le format des étapes est invalide.' } } as const;
  }

  if (code === '22023') {
    return {
      status: 422,
      body: { error: 'Ajoutez au moins deux étapes pour sauvegarder votre process.' }
    } as const;
  }

  if (code === '23502') {
    return {
      status: 400,
      body: { error: 'Identifiant de process requis pour la mise à jour.' }
    } as const;
  }

  if (code === '42501') {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de modifier ce process." }
    } as const;
  }

  if (code === 'P0002') {
    return { status: 404, body: { error: 'Process introuvable.' } } as const;
  }

  if (isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de modifier ce process." }
    } as const;
  }

  return { status: 500, body: { error: 'Impossible de mettre à jour le process.' } } as const;
};

const normalizeUpdatedAt = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string);

  if (Number.isNaN(date.getTime())) {
    console.error('Horodatage de process invalide', value);
    return null;
  }

  return date.toISOString();
};

const normalizeSteps = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('Échec du parsing des étapes de process', error);
    }
  }

  return value;
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const ensureEntityIds = (payload: ProcessContextUpdate): ProcessContextUpdate => {
  const departmentsWithIds = payload.departments.map((department) => {
    const departmentId = department.id ?? randomUUID();

    return {
      ...department,
      id: departmentId,
      roles: (department.roles ?? []).map((role) => ({
        ...role,
        id: role.id ?? randomUUID()
      }))
    };
  });

  return { ...payload, departments: departmentsWithIds };
};

const resolveStepsWithDrafts = (payload: ProcessContextUpdate) => {
  const departmentByName = new Map<string, string>();
  const rolesByDepartment = new Map<string, Map<string, string>>();

  payload.departments.forEach((department) => {
    departmentByName.set(normalizeName(department.name), department.id ?? '');

    const roleMap = new Map<string, string>();
    (department.roles ?? []).forEach((role) => {
      const roleId = role.id ?? '';
      if (roleId) {
        roleMap.set(normalizeName(role.name), roleId);
      }
    });

    rolesByDepartment.set(department.id ?? '', roleMap);
  });

  return payload.steps.map((step) => {
    let departmentId = step.departmentId;
    if (!departmentId && step.draftDepartmentName) {
      const normalizedDraft = normalizeName(step.draftDepartmentName);
      const resolvedDepartment = departmentByName.get(normalizedDraft);
      departmentId = resolvedDepartment ?? null;
    }

    let roleId = step.roleId;
    if (!roleId && step.draftRoleName && departmentId) {
      const normalizedRole = normalizeName(step.draftRoleName);
      const resolvedRole = rolesByDepartment.get(departmentId)?.get(normalizedRole);
      roleId = resolvedRole ?? null;
    }

    return {
      ...step,
      departmentId,
      roleId,
      draftDepartmentName: null,
      draftRoleName: null
    };
  });
};

export async function PUT(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Requête invalide. Corps JSON requis.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const parsedBody = processContextUpdateSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Payload du process invalide.', details: parsedBody.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (parsedBody.data.process.id !== params.data.id) {
    return NextResponse.json(
      { error: 'Le payload ne correspond pas au process demandé.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedPayload = ensureEntityIds(parsedBody.data);

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour la mise à jour du process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de déterminer les autorisations pour ce process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const manageableOrganizationIds = getManageableOrganizationIds(memberships);

  if (manageableOrganizationIds.length === 0) {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de modifier ce process." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const processRecord = await db.query.processSnapshots.findFirst({
    where: and(eq(processSnapshots.id, params.data.id), inArray(processSnapshots.organizationId, manageableOrganizationIds))
  });

  if (!processRecord) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const organizationId = processRecord.organizationId;

  const providedDepartmentIds = normalizedPayload.departments
    .map((department) => department.id)
    .filter((value): value is string => Boolean(value));

  if (providedDepartmentIds.length > 0) {
    const existingDepartments = await db.query.departments.findMany({
      where: and(inArray(departmentTable.id, providedDepartmentIds), eq(departmentTable.organizationId, organizationId)),
      columns: { id: true }
    });

    if (existingDepartments.length !== providedDepartmentIds.length) {
      return NextResponse.json(
        { error: 'Certains départements ne sont pas accessibles pour ce process.' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
  }

  const providedRoleIds = normalizedPayload.departments
    .flatMap((department) => department.roles?.map((role) => role.id) ?? [])
    .filter((value): value is string => Boolean(value));

  if (providedRoleIds.length > 0) {
    const existingRoles = await db.query.roles.findMany({
      where: and(inArray(roleTable.id, providedRoleIds), eq(roleTable.organizationId, organizationId)),
      columns: { id: true }
    });

    if (existingRoles.length !== providedRoleIds.length) {
      return NextResponse.json(
        { error: 'Certains rôles ne sont pas accessibles pour ce process.' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
  }

  const departmentRows = normalizedPayload.departments.map((department) => ({
    id: department.id,
    name: department.name,
    color: department.color,
    organization_id: organizationId,
    owner_id: user.id
  }));

  if (departmentRows.length > 0) {
    const { error: departmentError } = await supabase
      .from('departments')
      .upsert(departmentRows, { onConflict: 'id' });

    if (departmentError) {
      console.error('Erreur lors de la mise à jour des départements du process', departmentError);
      const mapped = mapDepartmentWriteError(departmentError);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
    }
  }

  const roleRows = normalizedPayload.departments.flatMap((department) =>
    (department.roles ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      department_id: department.id,
      organization_id: organizationId,
      owner_id: user.id
    }))
  );

  if (roleRows.length > 0) {
    const { error: roleError } = await supabase.from('roles').upsert(roleRows, { onConflict: 'id' });

    if (roleError) {
      console.error('Erreur lors de la mise à jour des rôles du process', roleError);
      const mapped = mapRoleWriteError(roleError);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
    }
  }

  const resolvedSteps = resolveStepsWithDrafts(normalizedPayload);

  const { data: savedProcess, error: saveError } = await supabase.rpc('save_process_snapshot', {
    payload: {
      id: normalizedPayload.process.id,
      title: normalizedPayload.process.title.trim(),
      steps: resolvedSteps
    }
  });

  if (saveError) {
    console.error('Erreur lors de la sauvegarde du process', saveError);
    const mapped = mapSaveProcessError(saveError);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!savedProcess) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la mise à jour du process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from('process_snapshots')
    .select('id, title, steps, updated_at, organization_id')
    .eq('id', params.data.id)
    .in('organization_id', manageableOrganizationIds)
    .maybeSingle();

  if (refreshError) {
    console.error('Erreur lors du rafraîchissement du process', refreshError);
    return NextResponse.json(
      { error: 'Impossible de récupérer le process mis à jour.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!refreshed) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const parsedResponse = processResponseSchema.safeParse({
    id: refreshed.id,
    title:
      typeof refreshed.title === 'string' && refreshed.title.trim().length > 0
        ? refreshed.title
        : DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(refreshed.steps),
    updatedAt: normalizeUpdatedAt(refreshed.updated_at)
  });

  if (!parsedResponse.success) {
    console.error('Process mis à jour avec un format inattendu', parsedResponse.error);
    return NextResponse.json(
      { error: 'La mise à jour a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedResponse.data, { headers: NO_STORE_HEADERS });
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsedBody = renameSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Le titre fourni est invalide.', details: parsedBody.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const title = parsedBody.data.title.trim();

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour renommer le process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de renommer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const manageableOrganizationIds = getManageableOrganizationIds(memberships);

  if (manageableOrganizationIds.length === 0) {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de modifier ce process." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data, error } = await supabase
    .from('process_snapshots')
    .update({ title })
    .eq('id', params.data.id)
    .in('organization_id', manageableOrganizationIds)
    .select('id, title, updated_at, organization_id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors du renommage du process', error);
    return NextResponse.json(
      { error: 'Impossible de renommer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const parsed = processSummarySchema.safeParse({
    id: data.id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : DEFAULT_PROCESS_TITLE,
    updatedAt: normalizeUpdatedAt(data.updated_at)
  });

  if (!parsed.success) {
    console.error('Process renommé avec un format inattendu', parsed.error);
    return NextResponse.json(
      { error: 'Le renommage a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data as ProcessSummary, { headers: NO_STORE_HEADERS });
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour supprimer le process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de supprimer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const manageableOrganizationIds = getManageableOrganizationIds(memberships);

  if (manageableOrganizationIds.length === 0) {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de supprimer ce process." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data, error } = await supabase
    .from('process_snapshots')
    .delete()
    .eq('id', params.data.id)
    .in('organization_id', manageableOrganizationIds)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la suppression du process', error);
    const mapped = mapDeleteProcessError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Process introuvable.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
