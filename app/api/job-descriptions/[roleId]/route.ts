import { NextResponse } from 'next/server';
import { z } from 'zod';

import { performChatCompletion } from '@/lib/ai/openai';
import { ensureJobDescriptionSections, stringifySections, type JobDescriptionSections } from '@/lib/job-descriptions/format';
import { buildRoleProfile, fetchRoleAndDepartmentLookups, type RoleProfile } from '@/lib/job-descriptions/role-profile';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { fetchUserOrganizations, getAccessibleOrganizationIds } from '@/lib/organization/memberships';
import {
  jobDescriptionResponseSchema,
  jobDescriptionSchema,
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

const roleContextSchema = z.object({
  id: z.string().uuid('Identifiant de rôle invalide.'),
  name: z.string().min(1, 'Le nom du rôle est requis.'),
  organizationId: z.string().uuid("Identifiant d'organisation invalide."),
  departmentName: z.string().min(1, 'Le nom du département est requis.')
});

type RoleContext = z.infer<typeof roleContextSchema>;

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

const buildPrompt = (params: {
  roleProfile: RoleProfile;
  lookups: { roles: Record<string, string>; departments: Record<string, string> };
  existingDescription: JobDescription | null;
}) => {
  const existing = params.existingDescription
    ? stringifySections(params.existingDescription.sections)
    : 'Aucune fiche existante.';

  const serializedProfile = JSON.stringify(params.roleProfile, null, 2);
  const serializedLookups = JSON.stringify(params.lookups, null, 2);

  const instructions = [
    'Tu es un expert RH. Génère une fiche de poste en français en respectant impérativement les règles suivantes :',
    '- Utilise UNIQUEMENT les informations fournies dans role_profile, roles et departments.',
    "- N'invente ni missions, ni compétences, ni contexte en dehors de ces données.",
    '- Quand une information est absente, écris exactement : "Non spécifié dans les données".',
    '- Réponds uniquement avec un JSON strictement valide (aucun texte ou markdown autour) avec les clés suivantes :',
    '  {',
    '    "title": "Intitulé du poste",',
    '    "generalDescription": "Mission principale",',
    '    "responsibilities": ["Responsabilités clés avec traçabilité"],',
    '    "objectives": ["Compétences ou objectifs issus des données"],',
    '    "collaboration": ["Interactions (autres rôles et départements)"],',
    '    "content": "Texte multiligne structuré avec les 6 sections"',
    '  }',
    '- Détaille chaque champ :',
    "  * title : Intitulé du poste (reprends le nom du rôle si présent, sinon 'Non spécifié dans les données').",
    '  * generalDescription : Mission principale dérivée uniquement des étapes où le rôle apparaît.',
    "  * responsibilities : pour chaque étape (type action/décision) du role_profile, rédige une phrase claire incluant le nom du process, le libellé de l'étape, son type, l'identifiant de l'étape, le département associé et les rôles précédents/suivants quand ils existent.",
    "  * objectives : liste des compétences ou objectifs explicitement présents dans les données. Si aucune compétence n'apparaît, fournis une seule entrée 'Non spécifié dans les données'.",
    "  * collaboration : interactions directes avec d'autres rôles ou départements, en utilisant les identifiants et noms fournis par roles et departments. S'il n'y en a pas, mets 'Non spécifié dans les données'.",
    '  * content : un texte unique structuré avec les sections numérotées :',
    '    1) Intitulé du poste',
    '    2) Mission principale',
    "    3) Responsabilités clés (liées aux étapes des processus, mentionne pour chaque responsabilité le nom du process et l'id de l'étape)",
    '    4) Interactions (autres rôles et départements)',
    '    5) Compétences requises',
    '    6) Traçabilité (liste récapitulative des responsabilités avec id des étapes et nom du process)',
    '- Chaque liste (responsibilities, objectives, collaboration) doit contenir au moins un élément.',
    '- Ne fournis aucune donnée absente ou estimée et utilise uniquement role_profile, roles et departments.',
    '- Ne renvoie rien d’autre que le JSON demandé.'
  ].join('\n');

  const userContent = [
    'role_profile:',
    serializedProfile,
    '\nroles_departments_lookup:',
    serializedLookups,
    '\nFiche actuelle (si présente, sinon indique les éléments manquants) :',
    existing
  ].join('\n');

  return [
    { role: 'system' as const, content: instructions },
    { role: 'user' as const, content: userContent }
  ];
};

const generationSchema = z.object({
  title: z.string().trim().min(1).optional(),
  generalDescription: z.string().optional(),
  responsibilities: z.array(z.string().trim().min(1)).default([]),
  objectives: z.array(z.string().trim().min(1)).default([]),
  collaboration: z.array(z.string().trim().min(1)).default([]),
  content: z.string().optional()
});

const generationJsonSchema = {
  name: 'job_description_generation',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      generalDescription: { type: 'string' },
      responsibilities: { type: 'array', items: { type: 'string' }, minItems: 1 },
      objectives: { type: 'array', items: { type: 'string' }, minItems: 1 },
      collaboration: { type: 'array', items: { type: 'string' }, minItems: 1 },
      content: { type: 'string' }
    },
    required: ['title', 'generalDescription', 'responsibilities', 'objectives', 'collaboration', 'content']
  },
  strict: true
};

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

    const fallbackSections: JobDescriptionSections = {
      title: validated.data.title?.trim() || 'Non spécifié dans les données',
      generalDescription:
        validated.data.generalDescription?.trim() || 'Non spécifié dans les données',
      responsibilities:
        validated.data.responsibilities.length > 0
          ? validated.data.responsibilities
          : ['Non spécifié dans les données'],
      objectives:
        validated.data.objectives.length > 0
          ? validated.data.objectives
          : ['Non spécifié dans les données'],
      collaboration:
        validated.data.collaboration.length > 0
          ? validated.data.collaboration
          : ['Non spécifié dans les données']
    };

    const contentSeed = validated.data.content ?? stringifySections(fallbackSections);

    const sections = ensureJobDescriptionSections({
      content: contentSeed,
      sections: validated.data
    });

    const content = validated.data.content ?? stringifySections(sections);

    return { sections, content };
  } catch (error) {
    console.error('Impossible de parser la réponse IA pour la fiche de poste', error, {
      raw: trimmed.slice(0, 500)
    });
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

  let roleProfile: RoleProfile | null = null;
  let lookups: { roles: Record<string, string>; departments: Record<string, string> } | null = null;

  try {
    roleProfile = await buildRoleProfile(context.role.organizationId, context.role.id);
  } catch (roleProfileError) {
    console.error('Erreur lors de la construction du profil de rôle', roleProfileError);
    const message =
      roleProfileError instanceof Error ? roleProfileError.message : 'Impossible de construire le profil de rôle.';

    return NextResponse.json(
      { error: message },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  try {
    lookups = await fetchRoleAndDepartmentLookups(context.role.organizationId);
  } catch (lookupError) {
    console.error('Erreur lors de la récupération des correspondances rôles/départements', lookupError);
    return NextResponse.json(
      { error: 'Impossible de préparer les données du rôle pour la génération.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!roleProfile || !lookups) {
    return NextResponse.json(
      { error: 'Impossible de préparer le profil du rôle.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const messages = buildPrompt({
    roleProfile,
    lookups,
    existingDescription: context.description
  });

  let generated: { content: string; sections: ReturnType<typeof ensureJobDescriptionSections> } | null = null;

  try {
    const raw = await performChatCompletion({
      messages,
      temperature: 0.7,
      maxTokens: 650,
      responseFormat: { type: 'json_schema', json_schema: generationJsonSchema }
    });
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
