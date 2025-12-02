import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { getInviteDemoProcessById } from '@/lib/process/demo';
import { processPayloadSchema, processResponseSchema, type ProcessPayload } from '@/lib/validation/process';
import { DEFAULT_DEPARTMENT_COLOR } from '@/lib/validation/department';
import { DEFAULT_ROLE_COLOR } from '@/lib/validation/role';
import {
  fetchUserOrganizations,
  getAccessibleOrganizationIds,
  getManageableOrganizationIds
} from '@/lib/organization/memberships';
import { mapDepartmentWriteError, mapRoleWriteError } from '@/app/api/departments/helpers';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

const processIdSchema = z.string().uuid();

const normalizeName = (value: string) => value.trim().toLowerCase();

type DepartmentWithRoles = {
  id: string;
  name: string;
  roles: { id: string; name: string }[] | null;
};

type SupabaseError = {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
};

const isRlsDeniedError = (error: { message?: string; details?: string | null; hint?: string | null }) => {
  const normalizedSegments = [error.message, error.details, error.hint]
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase().replace(/[-_]+/g, ' ') : ''))
    .filter((segment) => segment.length > 0);

  return normalizedSegments.some((segment) =>
    segment.includes('row level security') || segment.includes('permission denied for table')
  );
};

const mapSaveProcessError = (error: SupabaseError) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return {
      status: 401,
      body: { error: 'Authentification requise.' }
    } as const;
  }

  if (code === '22P02') {
    return {
      status: 400,
      body: { error: 'Le format des étapes est invalide.' }
    } as const;
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
      body: { error: 'Identifiant de process requis pour la sauvegarde.' }
    } as const;
  }

  if (code === '42501') {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de sauvegarder ce process." }
    } as const;
  }

  if (code === 'P0002') {
    return {
      status: 404,
      body: { error: 'Process introuvable.' }
    } as const;
  }

  if (isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de sauvegarder ce process." }
    } as const;
  }

  return {
    status: 500,
    body: { error: 'Impossible de sauvegarder le process.' }
  } as const;
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

export async function GET(request: Request) {
  const processId = processIdSchema.safeParse(new URL(request.url).searchParams.get('id'));

  if (!processId.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const demoProcess = getInviteDemoProcessById(processId.data);

  if (demoProcess) {
    return NextResponse.json(demoProcess, { headers: NO_STORE_HEADERS });
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
    console.error('Erreur lors de la récupération des organisations pour le process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de récupérer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('process_snapshots')
    .select('id, title, steps, updated_at, organization_id')
    .eq('id', processId.data)
    .in('organization_id', accessibleOrganizationIds)
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la récupération du process', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const parsed = processResponseSchema.safeParse({
    id: data.id,
    title: data.title ?? DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(data.steps),
    updatedAt: normalizeUpdatedAt(data.updated_at)
  });

  if (!parsed.success) {
    console.error('Données de process invalides', parsed.error);
    return NextResponse.json(
      { error: 'Les données du process sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let payload: unknown;

  const processId = processIdSchema.safeParse(new URL(request.url).searchParams.get('id'));

  if (!processId.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    payload = await request.json();
  } catch (error) {
    console.error('Corps de requête JSON invalide', error);
    return NextResponse.json(
      { error: 'Requête invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const payloadObject: Record<string, unknown> =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};

  const parsedPayload = processPayloadSchema.safeParse({ ...payloadObject, id: processId.data });
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: 'Le format des étapes est invalide.', details: parsedPayload.error.flatten() },
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
    console.error('Erreur lors de la récupération des organisations pour sauvegarder le process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de vérifier vos autorisations pour ce process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const body: ProcessPayload = parsedPayload.data;

  const manageableOrganizationIds = getManageableOrganizationIds(memberships);

  if (manageableOrganizationIds.length === 0) {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de modifier ce process." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data: processRecord, error: processLookupError } = await supabase
    .from('process_snapshots')
    .select('id, organization_id')
    .eq('id', body.id)
    .in('organization_id', manageableOrganizationIds)
    .maybeSingle();

  if (processLookupError) {
    console.error('Erreur lors de la vérification des autorisations pour le process', processLookupError);
    return NextResponse.json(
      { error: 'Impossible de vérifier vos autorisations sur ce process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!processRecord) {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de modifier ce process." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data: departmentRows, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name, roles:roles(id, name)')
    .eq('organization_id', processRecord.organization_id)
    .order('name', { ascending: true })
    .order('name', { referencedTable: 'roles', ascending: true });

  if (departmentsError) {
    console.error('Erreur lors de la récupération des départements pour sauvegarder le process', departmentsError);
    return NextResponse.json(
      { error: 'Impossible de récupérer les départements et rôles.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const departmentsWithRoles: DepartmentWithRoles[] = (departmentRows ?? []) as DepartmentWithRoles[];
  const existingDepartmentById = new Map<string, DepartmentWithRoles>(
    departmentsWithRoles.map((department) => [department.id, department])
  );
  const existingRoleById = new Map<string, { id: string; departmentId: string }>();
  const existingDepartmentByName = new Map<string, DepartmentWithRoles>(
    departmentsWithRoles.map((department) => [normalizeName(department.name), department])
  );
  const existingRoleNameByDepartment = new Map<string, Map<string, { id: string; name: string }>>();

  departmentsWithRoles.forEach((department) => {
    if (!existingRoleNameByDepartment.has(department.id)) {
      existingRoleNameByDepartment.set(department.id, new Map());
    }

    department.roles?.forEach((role) => {
      existingRoleById.set(role.id, { id: role.id, departmentId: department.id });
      existingRoleNameByDepartment
        .get(department.id)
        ?.set(normalizeName(role.name), { id: role.id, name: role.name });
    });
  });

  const pendingDepartments = new Map<string, string>();
  const pendingRoles = new Map<string, { departmentKey: string; name: string; normalizedName: string }>();
  const resolvedDraftDepartmentIds = new Map<string, string>();

  for (const step of body.steps) {
    const departmentId = step.departmentId;
    const roleId = step.roleId;
    const draftDepartmentName = step.draftDepartmentName;
    const draftRoleName = step.draftRoleName;

    if (!departmentId && roleId) {
      return NextResponse.json(
        { error: 'Un rôle est référencé sans département dans le process.' },
        { status: 422, headers: NO_STORE_HEADERS }
      );
    }

    let resolvedDepartmentId: string | null = null;
    let draftDepartmentKey: string | null = null;

    if (departmentId) {
      if (!existingDepartmentById.has(departmentId)) {
        return NextResponse.json(
          { error: 'Le process référence un département inconnu.' },
          { status: 422, headers: NO_STORE_HEADERS }
        );
      }

      resolvedDepartmentId = departmentId;
    }

    if (draftDepartmentName) {
      const normalized = normalizeName(draftDepartmentName);
      const existingDepartment = existingDepartmentByName.get(normalized);

      if (existingDepartment) {
        resolvedDepartmentId = existingDepartment.id;
        resolvedDraftDepartmentIds.set(normalized, existingDepartment.id);
      } else {
        draftDepartmentKey = normalized;
        if (!pendingDepartments.has(normalized)) {
          pendingDepartments.set(normalized, draftDepartmentName);
        }
      }
    }

    if (!roleId && !draftRoleName) {
      continue;
    }

    if (roleId) {
      const existingRole = existingRoleById.get(roleId);

      if (!existingRole) {
        return NextResponse.json(
          { error: 'Le process référence un rôle inconnu.' },
          { status: 422, headers: NO_STORE_HEADERS }
        );
      }

      const expectedDepartmentId = resolvedDepartmentId ?? existingRole.departmentId;

      if (!expectedDepartmentId || existingRole.departmentId !== expectedDepartmentId) {
        return NextResponse.json(
          { error: 'Le rôle référencé ne correspond pas au département indiqué.' },
          { status: 422, headers: NO_STORE_HEADERS }
        );
      }
    }

    if (!draftRoleName) {
      continue;
    }

    const normalizedRoleName = normalizeName(draftRoleName);
    const departmentKey = resolvedDepartmentId ?? draftDepartmentKey;

    if (!departmentKey) {
      return NextResponse.json(
        { error: 'Un rôle provisoire est défini sans département associé.' },
        { status: 422, headers: NO_STORE_HEADERS }
      );
    }

    if (resolvedDepartmentId) {
      const existingRole = existingRoleNameByDepartment.get(resolvedDepartmentId)?.get(normalizedRoleName);
      if (existingRole) {
        continue;
      }
    }

    const roleKey = `${departmentKey}::${normalizedRoleName}`;

    if (!pendingRoles.has(roleKey)) {
      pendingRoles.set(roleKey, {
        departmentKey,
        name: draftRoleName,
        normalizedName: normalizedRoleName
      });
    }
  }

  let newDepartmentIds = new Map<string, string>();

  if (pendingDepartments.size > 0) {
    const departmentsToCreate = Array.from(pendingDepartments.entries()).map(([, name]) => ({
      name,
      color: DEFAULT_DEPARTMENT_COLOR,
      organization_id: processRecord.organization_id
    }));

    const { data, error } = await supabase
      .from('departments')
      .insert(departmentsToCreate)
      .select('id, name');

    if (error) {
      console.error('Erreur lors de la création des départements lors de la sauvegarde du process', error);
      const mapped = mapDepartmentWriteError(error);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
    }

    if (!data || data.length !== pendingDepartments.size) {
      return NextResponse.json(
        { error: 'Création des nouveaux départements incomplète.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const createdPairs = Array.from(pendingDepartments.keys());

    newDepartmentIds = new Map(
      data.map((department, index) => {
        const draftKey = createdPairs[index];
        const persistedId = typeof department.id === 'string' ? department.id : String(department.id);
        existingDepartmentById.set(persistedId, { id: persistedId, name: department.name, roles: [] });
        existingDepartmentByName.set(normalizeName(department.name), { id: persistedId, name: department.name, roles: [] });
        resolvedDraftDepartmentIds.set(draftKey, persistedId);
        if (!existingRoleNameByDepartment.has(persistedId)) {
          existingRoleNameByDepartment.set(persistedId, new Map());
        }
        return [draftKey, persistedId];
      })
    );
  }

  let newRoleIds = new Map<string, string>();

  if (pendingRoles.size > 0) {
    const roleKeys: string[] = [];
    const rolesToCreate: {
      department_id: string;
      name: string;
      color: string;
      organization_id: string;
    }[] = [];

    for (const [roleKey, role] of pendingRoles.entries()) {
      const resolvedDepartmentId = existingDepartmentById.has(role.departmentKey)
        ? role.departmentKey
        : resolvedDraftDepartmentIds.get(role.departmentKey);

      if (!resolvedDepartmentId) {
        return NextResponse.json(
          { error: 'Le process référence un rôle lié à un département inexistant.' },
          { status: 422, headers: NO_STORE_HEADERS }
        );
      }

      const roleNames = existingRoleNameByDepartment.get(resolvedDepartmentId) ?? new Map();
      if (roleNames.has(role.normalizedName)) {
        continue;
      }

      roleKeys.push(`${resolvedDepartmentId}::${role.normalizedName}`);
      rolesToCreate.push({
        department_id: resolvedDepartmentId,
        name: role.name,
        color: DEFAULT_ROLE_COLOR,
        organization_id: processRecord.organization_id
      });
      existingRoleNameByDepartment.set(resolvedDepartmentId, roleNames);
    }

    if (rolesToCreate.length > 0) {
      const { data, error } = await supabase
        .from('roles')
        .insert(rolesToCreate)
        .select('id, department_id, name');

      if (error) {
        console.error('Erreur lors de la création des rôles lors de la sauvegarde du process', error);
        const mapped = mapRoleWriteError(error);
        return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
      }

      if (!data || data.length !== rolesToCreate.length) {
        return NextResponse.json(
          { error: 'Création des nouveaux rôles incomplète.' },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      newRoleIds = new Map(
        data.map((role, index) => {
          const persistedId = typeof role.id === 'string' ? role.id : String(role.id);
          const departmentId =
            typeof role.department_id === 'string' ? role.department_id : String(role.department_id ?? '');
          const normalizedName = normalizeName(role.name ?? '');
          existingRoleById.set(persistedId, { id: persistedId, departmentId });

          const roleNameMap = existingRoleNameByDepartment.get(departmentId) ?? new Map();
          roleNameMap.set(normalizedName, { id: persistedId, name: role.name ?? '' });
          existingRoleNameByDepartment.set(departmentId, roleNameMap);

          return [roleKeys[index], persistedId];
        })
      );
    }
  }

  const resolvedSteps = body.steps.map((step) => {
    const draftDepartmentKey = step.draftDepartmentName ? normalizeName(step.draftDepartmentName) : null;
    const resolvedDepartmentId =
      step.departmentId ??
      (draftDepartmentKey ? resolvedDraftDepartmentIds.get(draftDepartmentKey) : null) ??
      (draftDepartmentKey ? existingDepartmentByName.get(draftDepartmentKey)?.id ?? null : null);

    const normalizedDraftRole = step.draftRoleName ? normalizeName(step.draftRoleName) : null;
    const departmentIdForRole = resolvedDepartmentId;

    let resolvedRoleId = step.roleId;

    if (!resolvedRoleId && normalizedDraftRole && departmentIdForRole) {
      const existingRole = existingRoleNameByDepartment.get(departmentIdForRole)?.get(normalizedDraftRole);
      resolvedRoleId = existingRole?.id ?? newRoleIds.get(`${departmentIdForRole}::${normalizedDraftRole}`) ?? null;
    }

    return {
      ...step,
      departmentId: resolvedDepartmentId,
      roleId: resolvedRoleId,
      draftDepartmentName: null,
      draftRoleName: null
    };
  });

  const resolvedBody: ProcessPayload = { ...body, steps: resolvedSteps };

  const { data, error } = await supabase.rpc('save_process_snapshot', {
    payload: { id: resolvedBody.id, title: resolvedBody.title, steps: resolvedBody.steps }
  });

  if (error) {
    console.error('Erreur lors de la sauvegarde du process', error);
    const mapped = mapSaveProcessError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la sauvegarde du process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const record = Array.isArray(data) ? data[0] : data;

  if (!record) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la sauvegarde du process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const parsedResponse = processResponseSchema.safeParse({
    id: record.id,
    title: typeof record.title === 'string' && record.title.trim().length > 0 ? record.title : DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(record.steps),
    updatedAt: normalizeUpdatedAt(record.updated_at)
  });

  if (!parsedResponse.success) {
    console.error('Réponse de sauvegarde du process invalide', parsedResponse.error);
    return NextResponse.json(
      { error: 'La sauvegarde a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedResponse.data, { headers: NO_STORE_HEADERS });
}
