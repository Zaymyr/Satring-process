import { z } from 'zod';

import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { createServerClient } from '@/lib/supabase/server';
import { stepSchema, type ProcessStep } from '@/lib/validation/process';

export type RoleProfile = {
  role: {
    id: string;
    name: string;
    departmentId: string | null;
    organizationId: string;
  };
  processesInvolvedIn: Array<{
    processId: string;
    processName: string;
    steps: Array<{
      nodeId: string;
      type: 'action' | 'decision';
      label: string;
      departmentId: string | null;
      previousRoleIds: string[];
      nextRoleIds: string[];
    }>;
  }>;
  interactions: {
    directRoles: string[];
    directDepartments: string[];
  };
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
      console.error("Impossible de parser les étapes du process pour le profil de rôle", error);
    }
  }

  return [];
};

const roleRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  organization_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional()
});

const roleListSchema = z.array(
  z.object({
    id: z.unknown(),
    name: z.unknown(),
    department_id: z.unknown()
  })
);

const departmentListSchema = z.array(
  z.object({
    id: z.unknown(),
    name: z.unknown()
  })
);

const processListSchema = z.array(
  z.object({
    id: z.unknown(),
    title: z.unknown(),
    steps: z.unknown()
  })
);

const normalizeRole = (record: unknown) => {
  const parsed = roleRecordSchema.safeParse(record);

  if (!parsed.success) {
    return null;
  }

  return {
    id: parsed.data.id,
    name: parsed.data.name.trim() || 'Rôle',
    organizationId: parsed.data.organization_id,
    departmentId: typeof parsed.data.department_id === 'string' ? parsed.data.department_id : null
  } satisfies RoleProfile['role'];
};

const unique = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));

const isActionOrDecision = (
  step: ProcessStep
): step is ProcessStep & { type: Exclude<ProcessStep['type'], 'start' | 'finish'> } =>
  step.type === 'action' || step.type === 'decision';

export async function buildRoleProfile(orgId: string, roleId: string): Promise<RoleProfile> {
  const supabase = createServerClient();

  const { data: roleRecord, error: roleError } = await supabase
    .from('roles')
    .select('id, name, organization_id, department_id')
    .eq('id', roleId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (roleError) {
    throw new Error("Impossible de récupérer le rôle demandé.");
  }

  const normalizedRole = normalizeRole(roleRecord);

  if (!normalizedRole) {
    throw new Error('Rôle introuvable.');
  }

  const [{ data: rawRoles, error: rolesError }, { data: rawDepartments, error: departmentsError }] = await Promise.all([
    supabase.from('roles').select('id, name, department_id').eq('organization_id', orgId),
    supabase.from('departments').select('id, name').eq('organization_id', orgId)
  ]);

  if (rolesError) {
    throw new Error('Impossible de récupérer les rôles de l’organisation.');
  }

  if (departmentsError) {
    throw new Error('Impossible de récupérer les départements de l’organisation.');
  }

  const parsedRoles = roleListSchema.safeParse(rawRoles ?? []);
  const parsedDepartments = departmentListSchema.safeParse(rawDepartments ?? []);

  if (!parsedRoles.success) {
    throw new Error('Rôles invalides pour la construction du profil.');
  }

  if (!parsedDepartments.success) {
    throw new Error('Départements invalides pour la construction du profil.');
  }

  const roleIdSet = new Set(
    parsedRoles.data.map((role) => (typeof role.id === 'string' ? role.id : String(role.id ?? '')))
  );
  const departmentIdSet = new Set(
    parsedDepartments.data.map((department) =>
      typeof department.id === 'string' ? department.id : String(department.id ?? '')
    )
  );

  const { data: rawProcesses, error: processesError } = await supabase
    .from('process_snapshots')
    .select('id, title, steps')
    .eq('organization_id', orgId);

  if (processesError) {
    throw new Error('Impossible de récupérer les processus de l’organisation.');
  }

  const parsedProcesses = processListSchema.safeParse(rawProcesses ?? []);

  if (!parsedProcesses.success) {
    throw new Error('Processus invalides pour la construction du profil.');
  }

  const processesInvolvedIn: RoleProfile['processesInvolvedIn'] = [];
  const directRoles = new Set<string>();
  const directDepartments = new Set<string>();

  for (const process of parsedProcesses.data) {
    const processId = typeof process.id === 'string' ? process.id : String(process.id ?? '');
    const processName =
      typeof process.title === 'string' && process.title.trim().length > 0 ? process.title.trim() : DEFAULT_PROCESS_TITLE;

    const normalizedSteps = normalizeSteps(process.steps);
    const stepsResult = z.array(stepSchema).safeParse(normalizedSteps);

    if (!stepsResult.success) {
      continue;
    }

    const actionableSteps = stepsResult.data.filter(isActionOrDecision).filter((step) => step.roleId === roleId);

    if (actionableSteps.length === 0) {
      continue;
    }

    const stepsById = new Map(stepsResult.data.map((step) => [step.id, step] as const));
    const relevantSteps: RoleProfile['processesInvolvedIn'][number]['steps'] = [];

    for (const step of actionableSteps) {
      const previousNodes = stepsResult.data.filter(
        (candidate) => candidate.yesTargetId === step.id || candidate.noTargetId === step.id
      );

      const nextNodes = unique([step.yesTargetId, step.noTargetId])
        .map((targetId) => stepsById.get(targetId))
        .filter((node): node is (typeof stepsResult.data)[number] => Boolean(node));

      const previousRoleIds = unique(previousNodes.map((node) => node.roleId));
      const nextRoleIds = unique(nextNodes.map((node) => node.roleId));

      const neighborDepartments = unique([
        step.departmentId,
        ...previousNodes.map((node) => node.departmentId),
        ...nextNodes.map((node) => node.departmentId)
      ]);

      previousRoleIds
        .filter((neighborRoleId) => neighborRoleId !== roleId && roleIdSet.has(neighborRoleId))
        .forEach((neighborRoleId) => {
          directRoles.add(neighborRoleId);
        });
      nextRoleIds
        .filter((neighborRoleId) => neighborRoleId !== roleId && roleIdSet.has(neighborRoleId))
        .forEach((neighborRoleId) => {
          directRoles.add(neighborRoleId);
        });
      neighborDepartments
        .filter((departmentId) => departmentIdSet.has(departmentId))
        .forEach((departmentId) => {
          directDepartments.add(departmentId);
        });

      relevantSteps.push({
        nodeId: step.id,
        type: step.type,
        label: step.label,
        departmentId: step.departmentId,
        previousRoleIds,
        nextRoleIds
      });
    }

    if (relevantSteps.length > 0) {
      processesInvolvedIn.push({ processId, processName, steps: relevantSteps });
    }
  }

  if (processesInvolvedIn.length === 0) {
    throw new Error('Aucun processus ne référence ce rôle.');
  }

  return {
    role: normalizedRole,
    processesInvolvedIn,
    interactions: {
      directRoles: Array.from(directRoles),
      directDepartments: Array.from(directDepartments)
    }
  } satisfies RoleProfile;
}

export async function fetchRoleAndDepartmentLookups(orgId: string): Promise<{
  roles: Record<string, string>;
  roleDepartments: Record<string, string | null>;
  departments: Record<string, string>;
}> {
  const supabase = createServerClient();

  const [{ data: rawRoles, error: rolesError }, { data: rawDepartments, error: departmentsError }] = await Promise.all([
    supabase.from('roles').select('id, name, department_id').eq('organization_id', orgId),
    supabase.from('departments').select('id, name').eq('organization_id', orgId)
  ]);

  if (rolesError) {
    throw new Error('Impossible de récupérer les rôles pour le prompt.');
  }

  if (departmentsError) {
    throw new Error('Impossible de récupérer les départements pour le prompt.');
  }

  const parsedRoles = roleListSchema.safeParse(rawRoles ?? []);
  const parsedDepartments = departmentListSchema.safeParse(rawDepartments ?? []);

  if (!parsedRoles.success) {
    throw new Error('Rôles invalides pour les correspondances.');
  }

  if (!parsedDepartments.success) {
    throw new Error('Départements invalides pour les correspondances.');
  }

  const roles = parsedRoles.data.reduce<Record<string, string>>((lookup, role) => {
    const id = typeof role.id === 'string' ? role.id : String(role.id ?? '');
    const name = typeof role.name === 'string' && role.name.trim().length > 0 ? role.name.trim() : 'Rôle';
    lookup[id] = name;
    return lookup;
  }, {});

  const roleDepartments = parsedRoles.data.reduce<Record<string, string | null>>((lookup, role) => {
    const id = typeof role.id === 'string' ? role.id : String(role.id ?? '');
    const departmentId = typeof role.department_id === 'string' ? role.department_id : null;
    lookup[id] = departmentId;
    return lookup;
  }, {});

  const departments = parsedDepartments.data.reduce<Record<string, string>>((lookup, department) => {
    const id = typeof department.id === 'string' ? department.id : String(department.id ?? '');
    const name =
      typeof department.name === 'string' && department.name.trim().length > 0 ? department.name.trim() : 'Département';
    lookup[id] = name;
    return lookup;
  }, {});

  return { roles, roleDepartments, departments };
}
