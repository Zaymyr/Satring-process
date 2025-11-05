import { NextResponse } from 'next/server';
import { z } from 'zod';

import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { ensureSampleDataSeeded } from '@/lib/onboarding/sample-seed';
import { createServerClient } from '@/lib/supabase/server';
import { stepSchema } from '@/lib/validation/process';
import { roleActionSummaryListSchema, type RoleActionItem } from '@/lib/validation/role-action';

import { NO_STORE_HEADERS } from '../../departments/helpers';

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

  return [];
};

const normalizedProcessSchema = z.object({
  id: z.string().uuid('Identifiant de process invalide.'),
  title: z.string().min(1, 'Le titre du process est requis.'),
  steps: z.array(stepSchema)
});

const normalizedRoleSchema = z.object({
  id: z.string().uuid('Identifiant de rôle invalide.'),
  name: z.string().min(1, 'Le nom du rôle est requis.'),
  departmentId: z.string().uuid('Identifiant de département invalide.'),
  departmentName: z.string().min(1, 'Le nom du département est requis.')
});

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    await ensureSampleDataSeeded(supabase);
  } catch (seedError) {
    console.error('Erreur lors de la préparation des données de démonstration (role actions)', seedError);
  }

  const [{ data: rawRoles, error: rolesError }, { data: rawProcesses, error: processesError }] = await Promise.all([
    supabase
      .from('roles')
      .select('id, name, department_id, department:departments(id, name)')
      .eq('owner_id', user.id),
    supabase
      .from('process_snapshots')
      .select('id, title, steps')
      .eq('owner_id', user.id)
  ]);

  if (rolesError) {
    console.error('Erreur lors de la récupération des rôles pour la synthèse des actions', rolesError);
    return NextResponse.json(
      { error: 'Impossible de récupérer les rôles.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (processesError) {
    console.error('Erreur lors de la récupération des process pour la synthèse des actions', processesError);
    return NextResponse.json(
      { error: 'Impossible de récupérer les process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedRolesResult = z
    .array(
      z.object({
        id: z.unknown(),
        name: z.unknown(),
        department_id: z.unknown(),
        department: z
          .object({ id: z.unknown(), name: z.unknown() })
          .optional()
          .nullable()
      })
    )
    .safeParse(rawRoles ?? []);

  if (!normalizedRolesResult.success) {
    console.error('Rôles invalides pour la synthèse des actions', normalizedRolesResult.error);
    return NextResponse.json(
      { error: 'Les données des rôles sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedRoles = normalizedRolesResult.data.map((role) => ({
    id: typeof role.id === 'string' ? role.id : String(role.id ?? ''),
    name:
      typeof role.name === 'string' && role.name.trim().length > 0
        ? role.name.trim()
        : 'Rôle',
    departmentId:
      typeof role.department_id === 'string'
        ? role.department_id
        : String(role.department_id ?? ''),
    departmentName:
      role.department && typeof role.department.name === 'string' && role.department.name.trim().length > 0
        ? role.department.name.trim()
        : 'Département'
  }));

  const parsedRoles = z.array(normalizedRoleSchema).safeParse(normalizedRoles);

  if (!parsedRoles.success) {
    console.error('Rôles normalisés invalides pour la synthèse des actions', parsedRoles.error);
    return NextResponse.json(
      { error: 'Les données des rôles normalisés sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedProcessesResult = z
    .array(
      z.object({
        id: z.unknown(),
        title: z.unknown(),
        steps: z.unknown()
      })
    )
    .safeParse(rawProcesses ?? []);

  if (!normalizedProcessesResult.success) {
    console.error('Process invalides pour la synthèse des actions', normalizedProcessesResult.error);
    return NextResponse.json(
      { error: 'Les données des process sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedProcesses = normalizedProcessesResult.data.map((process) => ({
    id: typeof process.id === 'string' ? process.id : String(process.id ?? ''),
    title:
      typeof process.title === 'string' && process.title.trim().length > 0
        ? process.title.trim()
        : DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(process.steps)
  }));

  const parsedProcesses = z.array(normalizedProcessSchema).safeParse(normalizedProcesses);

  if (!parsedProcesses.success) {
    console.error('Process normalisés invalides pour la synthèse des actions', parsedProcesses.error);
    return NextResponse.json(
      { error: 'Les données des process normalisés sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const summaries = parsedRoles.data.map((role) => ({
    roleId: role.id,
    roleName: role.name,
    departmentId: role.departmentId,
    departmentName: role.departmentName,
    actions: [] as RoleActionItem[]
  }));

  const summaryMap = new Map<string, (typeof summaries)[number]>();
  for (const summary of summaries) {
    summaryMap.set(summary.roleId, summary);
  }

  for (const process of parsedProcesses.data) {
    for (const step of process.steps) {
      if ((step.type !== 'action' && step.type !== 'decision') || !step.roleId) {
        continue;
      }

      const summary = summaryMap.get(step.roleId);
      if (!summary) {
        continue;
      }

      summary.actions.push({
        processId: process.id,
        processTitle: process.title,
        stepId: step.id,
        stepLabel: step.label,
        responsibility: step.type === 'decision' ? 'A' : 'R'
      });
    }
  }

  for (const summary of summaryMap.values()) {
    summary.actions.sort((left, right) => {
      const titleComparison = left.processTitle.localeCompare(right.processTitle, 'fr', {
        sensitivity: 'base'
      });

      if (titleComparison !== 0) {
        return titleComparison;
      }

      return left.stepLabel.localeCompare(right.stepLabel, 'fr', { sensitivity: 'base' });
    });
  }

  const orderedSummaries = Array.from(summaryMap.values()).sort((left, right) =>
    left.roleName.localeCompare(right.roleName, 'fr', { sensitivity: 'base' })
  );

  const parsedSummaries = roleActionSummaryListSchema.safeParse(orderedSummaries);

  if (!parsedSummaries.success) {
    console.error('Synthèse des actions invalides', parsedSummaries.error);
    return NextResponse.json(
      { error: 'Les données de synthèse des actions sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedSummaries.data, { headers: NO_STORE_HEADERS });
}
