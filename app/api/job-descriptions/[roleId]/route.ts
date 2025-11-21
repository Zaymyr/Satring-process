import { NextResponse } from 'next/server';
import { z } from 'zod';

import { performChatCompletion } from '@/lib/ai/openai';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { createServerClient } from '@/lib/supabase/server';
import { fetchUserOrganizations, getAccessibleOrganizationIds } from '@/lib/organization/memberships';
import { stepSchema } from '@/lib/validation/process';
import { jobDescriptionResponseSchema, jobDescriptionSchema } from '@/lib/validation/job-description';

import { NO_STORE_HEADERS, roleIdParamSchema } from '../../departments/helpers';

const normalizeTimestamp = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
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
      console.error('Impossible de parser les étapes du process', error);
    }
  }

  return [];
};

const normalizedProcessSchema = z.object({
  id: z.string().uuid('Identifiant de process invalide.'),
  title: z.string().min(1, 'Le titre du process est requis.'),
  steps: z.array(stepSchema)
});

const roleContextSchema = z.object({
  id: z.string().uuid('Identifiant de rôle invalide.'),
  name: z.string().min(1, 'Le nom du rôle est requis.'),
  organizationId: z.string().uuid("Identifiant d'organisation invalide."),
  departmentName: z.string().min(1, 'Le nom du département est requis.')
});

type RoleContext = z.infer<typeof roleContextSchema>;

type ActionGroup = { processTitle: string; steps: string[] };

const normalizeJobDescriptionRecord = (record: {
  role_id: unknown;
  organization_id: unknown;
  content: unknown;
  updated_at?: unknown;
  created_at?: unknown;
}) => ({
  roleId: typeof record.role_id === 'string' ? record.role_id : String(record.role_id ?? ''),
  organizationId:
    typeof record.organization_id === 'string'
      ? record.organization_id
      : String(record.organization_id ?? ''),
  content: typeof record.content === 'string' ? record.content.trim() : '',
  updatedAt: normalizeTimestamp(record.updated_at ?? record.created_at ?? new Date())
});

const mapDescriptionData = (record: unknown) => {
  const parsed = jobDescriptionSchema.safeParse(record);
  if (!parsed.success) {
    console.error('Fiche de poste invalide', parsed.error);
    return null;
  }
  return parsed.data;
};

const buildRoleContext = async (
  supabase: ReturnType<typeof createServerClient>,
  roleId: string,
  accessibleOrganizationIds: string[]
): Promise<{ role: RoleContext; description: ReturnType<typeof mapDescriptionData> } | null> => {
  const { data: roleRecord, error: roleError } = await supabase
    .from('roles')
    .select('id, name, organization_id, department:departments(name)')
    .eq('id', roleId)
    .maybeSingle();

  if (roleError) {
    console.error('Erreur lors de la récupération du rôle pour la fiche de poste', roleError);
    return null;
  }

  if (!roleRecord || !accessibleOrganizationIds.includes(String(roleRecord.organization_id ?? ''))) {
    return null;
  }

  const departmentName = Array.isArray(roleRecord.department)
    ? roleRecord.department[0]?.name
    : roleRecord.department?.name;

  const roleContextResult = roleContextSchema.safeParse({
    id: typeof roleRecord.id === 'string' ? roleRecord.id : String(roleRecord.id ?? ''),
    name:
      typeof roleRecord.name === 'string' && roleRecord.name.trim().length > 0
        ? roleRecord.name.trim()
        : 'Rôle',
    organizationId:
      typeof roleRecord.organization_id === 'string'
        ? roleRecord.organization_id
        : String(roleRecord.organization_id ?? ''),
    departmentName:
      typeof departmentName === 'string'
        ? departmentName.trim() || 'Département'
        : 'Département'
  });

  if (!roleContextResult.success) {
    console.error('Rôle invalide pour la génération de fiche de poste', roleContextResult.error);
    return null;
  }

  const { data: existingDescription, error: descriptionError } = await supabase
    .from('job_descriptions')
    .select('role_id, organization_id, content, updated_at, created_at')
    .eq('role_id', roleId)
    .maybeSingle();

  if (descriptionError && descriptionError.code !== 'PGRST116') {
    console.error('Erreur lors de la récupération de la fiche de poste', descriptionError);
    return null;
  }

  return {
    role: roleContextResult.data,
    description: existingDescription ? mapDescriptionData(normalizeJobDescriptionRecord(existingDescription)) : null
  };
};

const fetchRoleActions = async (
  supabase: ReturnType<typeof createServerClient>,
  organizationId: string,
  roleId: string
): Promise<ActionGroup[]> => {
  const { data: rawProcesses, error: processesError } = await supabase
    .from('process_snapshots')
    .select('id, title, steps')
    .eq('organization_id', organizationId);

  if (processesError) {
    throw processesError;
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
    throw new Error('Process invalides pour la génération de fiche de poste.');
  }

  const normalized = normalizedProcessesResult.data.map((process) => ({
    id: typeof process.id === 'string' ? process.id : String(process.id ?? ''),
    title:
      typeof process.title === 'string' && process.title.trim().length > 0
        ? process.title.trim()
        : DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(process.steps)
  }));

  const parsedProcesses = z.array(normalizedProcessSchema).safeParse(normalized);

  if (!parsedProcesses.success) {
    throw new Error('Process normalisés invalides pour la génération de fiche de poste.');
  }

  const groups: ActionGroup[] = [];

  for (const process of parsedProcesses.data) {
    const stepsForRole = process.steps
      .filter((step) => (step.type === 'action' || step.type === 'decision') && step.roleId === roleId)
      .map((step) => step.label);

    if (stepsForRole.length === 0) {
      continue;
    }

    groups.push({
      processTitle: process.title,
      steps: Array.from(new Set(stepsForRole))
    });
  }

  return groups;
};

const buildPrompt = (params: {
  role: RoleContext;
  actions: ActionGroup[];
  existingDescription: string | null;
}) => {
  const responsibilities =
    params.actions.length === 0
      ? 'Aucune action documentée — propose des responsabilités standards adaptées au périmètre indiqué.'
      : params.actions
          .map((action) => `- ${action.processTitle}: ${action.steps.join(', ')}`)
          .join('\n');

  const baseContent = `Rôle: ${params.role.name}\nDépartement: ${params.role.departmentName}`;

  const details = `${baseContent}\n\nResponsabilités connues:\n${responsibilities}`;

  const updateInstruction = params.existingDescription
    ? `\n\nDescription actuelle à améliorer:\n${params.existingDescription}`
    : '\n\nAucune fiche existante. Crée une version initiale.';

  return [
    {
      role: 'system' as const,
      content:
        "Tu es un expert RH. Rédige une fiche de poste concise en français, structurée avec: mission générale (2 phrases max), responsabilités clés (liste à puces), indicateurs de succès, collaborations internes. Utilise un ton professionnel et précis, sans préambule ni conclusion, et limite la réponse à 220 mots."
    },
    {
      role: 'user' as const,
      content: `${details}${updateInstruction}\n\nStructure la réponse pour pouvoir être affichée telle quelle (texte brut).`
    }
  ];
};

export async function GET(
  _request: Request,
  { params }: { params: { roleId: string } }
) {
  const parsedParams = roleIdParamSchema.safeParse(params ?? {});

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Identifiant de rôle invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour la fiche de poste', membershipError);
    return NextResponse.json(
      { error: 'Impossible de récupérer la fiche de poste demandée.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ jobDescription: null }, { headers: NO_STORE_HEADERS });
  }

  const context = await buildRoleContext(supabase, parsedParams.data.roleId, accessibleOrganizationIds);

  if (!context) {
    return NextResponse.json(
      { error: 'Rôle introuvable ou inaccessible.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const responseBody = jobDescriptionResponseSchema.safeParse({ jobDescription: context.description });

  if (!responseBody.success) {
    console.error('Fiche de poste normalisée invalide', responseBody.error);
    return NextResponse.json(
      { error: 'Les données de fiche de poste sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(responseBody.data, { headers: NO_STORE_HEADERS });
}

export async function POST(
  _request: Request,
  { params }: { params: { roleId: string } }
) {
  const parsedParams = roleIdParamSchema.safeParse(params ?? {});

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Identifiant de rôle invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour la génération de fiche de poste', membershipError);
    return NextResponse.json(
      { error: "Impossible d'identifier l'organisation cible." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Aucune organisation accessible.' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const context = await buildRoleContext(supabase, parsedParams.data.roleId, accessibleOrganizationIds);

  if (!context) {
    return NextResponse.json(
      { error: 'Rôle introuvable ou inaccessible.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  let actions: ActionGroup[] = [];

  try {
    actions = await fetchRoleActions(supabase, context.role.organizationId, context.role.id);
  } catch (actionError) {
    console.error('Erreur lors de la récupération des actions du rôle', actionError);
    return NextResponse.json(
      { error: 'Impossible de récupérer les actions du rôle.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const messages = buildPrompt({
    role: context.role,
    actions,
    existingDescription: context.description?.content ?? null
  });

  let generatedContent: string | null = null;

  try {
    generatedContent = await performChatCompletion({ messages, temperature: 0.7, maxTokens: 650 });
  } catch (generationError) {
    console.error('Erreur OpenAI lors de la génération de la fiche de poste', generationError);
    const message =
      generationError instanceof Error
        ? generationError.message
        : 'Impossible de générer la fiche de poste pour le moment.';

    return NextResponse.json(
      { error: message },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }

  if (!generatedContent) {
    return NextResponse.json(
      { error: 'La génération a renvoyé un contenu vide.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const { data: savedDescription, error: saveError } = await supabase
    .from('job_descriptions')
    .upsert(
      {
        role_id: context.role.id,
        organization_id: context.role.organizationId,
        content: generatedContent
      },
      { onConflict: 'role_id' }
    )
    .select('role_id, organization_id, content, updated_at, created_at')
    .single();

  if (saveError || !savedDescription) {
    console.error('Erreur lors de la sauvegarde de la fiche de poste', saveError);
    return NextResponse.json(
      { error: 'Impossible de sauvegarder la fiche de poste générée.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const parsedDescription = mapDescriptionData(normalizeJobDescriptionRecord(savedDescription));

  if (!parsedDescription) {
    return NextResponse.json(
      { error: 'La fiche de poste enregistrée est invalide.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ jobDescription: parsedDescription }, { status: 201, headers: NO_STORE_HEADERS });
}
