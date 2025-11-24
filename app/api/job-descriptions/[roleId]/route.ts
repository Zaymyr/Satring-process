import { NextResponse } from 'next/server';
import { z } from 'zod';

import { performChatCompletion } from '@/lib/ai/openai';
import { ensureJobDescriptionSections, stringifySections } from '@/lib/job-descriptions/format';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { fetchUserOrganizations, getAccessibleOrganizationIds } from '@/lib/organization/memberships';
import { stepSchema } from '@/lib/validation/process';
import {
  jobDescriptionResponseSchema,
  jobDescriptionSchema,
  jobDescriptionSectionsSchema,
  type JobDescription
} from '@/lib/validation/job-description';

import { NO_STORE_HEADERS, roleIdParamSchema } from '@/app/api/departments/helpers';

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

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|•|-\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
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
  title?: unknown;
  general_description?: unknown;
  responsibilities?: unknown;
  objectives?: unknown;
  collaboration?: unknown;
  updated_at?: unknown;
  created_at?: unknown;
}) => ({
  roleId: typeof record.role_id === 'string' ? record.role_id : String(record.role_id ?? ''),
  organizationId:
    typeof record.organization_id === 'string'
      ? record.organization_id
      : String(record.organization_id ?? ''),
  content: typeof record.content === 'string' ? record.content.trim() : '',
  sections: {
    title: typeof record.title === 'string' ? record.title.trim() : '',
    generalDescription:
      typeof record.general_description === 'string' ? record.general_description.trim() : '',
    responsibilities: normalizeStringArray(record.responsibilities),
    objectives: normalizeStringArray(record.objectives),
    collaboration: normalizeStringArray(record.collaboration)
  },
  updatedAt: normalizeTimestamp(record.updated_at ?? record.created_at ?? new Date())
});

const mapDescriptionData = (record: unknown, fallbackTitle?: string): JobDescription | null => {
  const rawSchema = z.object({
    roleId: z.string(),
    organizationId: z.string(),
    content: z.string(),
    updatedAt: z.string(),
    sections: z
      .object({
        title: z.string().optional(),
        generalDescription: z.string().optional(),
        responsibilities: z.array(z.string()).optional(),
        objectives: z.array(z.string()).optional(),
        collaboration: z.array(z.string()).optional()
      })
      .optional()
  });

  const parsed = rawSchema.safeParse(record);
  if (!parsed.success) {
    console.error('Fiche de poste invalide', parsed.error);
    return null;
  }

  const sections = ensureJobDescriptionSections({
    content: parsed.data.content,
    sections: parsed.data.sections,
    fallbackTitle
  });

  const content = parsed.data.content.trim().length > 0 ? parsed.data.content : stringifySections(sections);

  const validated = jobDescriptionSchema.safeParse({ ...parsed.data, content, sections });
  if (!validated.success) {
    console.error('Fiche de poste invalide après normalisation', validated.error);
    return null;
  }

  return validated.data;
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

  const departmentName = (() => {
    const rawDepartment = roleRecord.department as
      | { name?: unknown }
      | { name?: unknown }[]
      | null
      | undefined;

    if (Array.isArray(rawDepartment)) {
      const firstDepartment = rawDepartment[0];
      return typeof firstDepartment?.name === 'string' ? firstDepartment.name : undefined;
    }

    if (rawDepartment && typeof rawDepartment === 'object' && 'name' in rawDepartment) {
      const singleDepartment = rawDepartment as { name?: unknown };
      return typeof singleDepartment.name === 'string' ? singleDepartment.name : undefined;
    }

    return undefined;
  })();

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
    .select(
      'role_id, organization_id, content, updated_at, created_at, title, general_description, responsibilities, objectives, collaboration'
    )
    .eq('role_id', roleId)
    .maybeSingle();

  if (descriptionError && descriptionError.code !== 'PGRST116') {
    console.error('Erreur lors de la récupération de la fiche de poste', descriptionError);
    return null;
  }

  return {
    role: roleContextResult.data,
    description: existingDescription
      ? mapDescriptionData(normalizeJobDescriptionRecord(existingDescription), roleContextResult.data.name)
      : null
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
  existingDescription: JobDescription | null;
}) => {
  const responsibilities =
    params.actions.length === 0
      ? 'Aucune action documentée — propose des responsabilités standards adaptées au périmètre indiqué.'
      : params.actions
          .map((action) => `- ${action.processTitle}: ${action.steps.join(', ')}`)
          .join('\n');

  const baseContent = `Rôle: ${params.role.name}\nDépartement: ${params.role.departmentName}`;

  const details = `${baseContent}\n\nResponsabilités connues:\n${responsibilities}`;

  const existing = params.existingDescription
    ? stringifySections(params.existingDescription.sections)
    : 'Aucune fiche existante. Crée une version initiale.';

  return [
    {
      role: 'system' as const,
      content:
        "Tu es un expert RH. Rédige une fiche de poste concise en français. Réponds uniquement avec un JSON valide, sans texte supplémentaire ni markdown, avec les clés suivantes: title, generalDescription (2 phrases max), responsibilities (liste d'items), objectives (liste d'items), collaboration (liste d'items)."
    },
    {
      role: 'user' as const,
      content: `${details}\n\nFiche actuelle (à améliorer si fournie):\n${existing}`
    }
  ];
};

const generationSchema = jobDescriptionSectionsSchema.extend({
  content: z.string().optional()
});

const parseGeneratedSections = (raw: string) => {
  const trimmed = raw.trim();
  const jsonCandidate = (() => {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1];
    }
    return trimmed;
  })();

  try {
    const parsedJson = JSON.parse(jsonCandidate);
    const validated = generationSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error('Réponse IA invalide pour la fiche de poste', validated.error);
      return null;
    }

    const sections = ensureJobDescriptionSections({
      content: validated.data.content ?? stringifySections(validated.data),
      sections: validated.data
    });

    return { sections, content: stringifySections(sections) };
  } catch (error) {
    console.error('Impossible de parser la réponse IA pour la fiche de poste', error);
    return null;
  }
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
  const { user, error: authError } = await getServerUser(supabase);

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
  const { user, error: authError } = await getServerUser(supabase);

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
    existingDescription: context.description ?? null
  });

  let generated: { content: string; sections: ReturnType<typeof ensureJobDescriptionSections> } | null = null;

  try {
    const raw = await performChatCompletion({ messages, temperature: 0.7, maxTokens: 650 });
    const parsed = parseGeneratedSections(raw);
    if (parsed) {
      generated = parsed;
    }
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

  if (!generated) {
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
        title: generated.sections.title,
        general_description: generated.sections.generalDescription,
        responsibilities: generated.sections.responsibilities,
        objectives: generated.sections.objectives,
        collaboration: generated.sections.collaboration,
        content: generated.content
      },
      { onConflict: 'role_id' }
    )
    .select(
      'role_id, organization_id, content, updated_at, created_at, title, general_description, responsibilities, objectives, collaboration'
    )
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
