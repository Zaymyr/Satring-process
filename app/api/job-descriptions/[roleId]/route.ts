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

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));

const stripTechnicalIds = (value: string) => value.replace(/\s*\(ID[:\s]*[^)]+\)/gi, '').trim();

const buildStructuredDataForGeneration = (params: {
  roleProfile: RoleProfile;
  lookups: {
    roles: Record<string, string>;
    roleDepartments: Record<string, string | null>;
    departments: Record<string, string>;
  };
}) => {
  const resolveRoleNames = (roleIds: string[]) =>
    uniqueStrings(roleIds.map((id) => params.lookups.roles[id] ?? ''))
      .filter((name) => name.length > 0)
      .map((name) => `rôle ${name}`);

  const resolveDepartmentName = (departmentId: string | null) =>
    departmentId ? params.lookups.departments[departmentId] ?? 'Département non spécifié dans les données' : null;

  const roleInteractionCounts = new Map<string, number>();
  const departmentInteractionCounts = new Map<string, number>();

  const incrementCount = (map: Map<string, number>, key: string | null | undefined) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  const processesForModel = params.roleProfile.processesInvolvedIn.map((process) => {
    const steps = process.steps.map((step) => {
      const neighboringRoleIds = uniqueStrings([...step.previousRoleIds, ...step.nextRoleIds]).filter(
        (neighborId) => neighborId !== params.roleProfile.role.id
      );

      neighboringRoleIds.forEach((neighborId) => incrementCount(roleInteractionCounts, neighborId));

      const neighborDepartments = neighboringRoleIds
        .map((neighborId) => params.lookups.roleDepartments[neighborId] ?? null)
        .filter(
          (departmentId): departmentId is string =>
            typeof departmentId === 'string' && departmentId !== params.roleProfile.role.departmentId
        );

      neighborDepartments.forEach((departmentId) => incrementCount(departmentInteractionCounts, departmentId));

      if (step.departmentId && step.departmentId !== params.roleProfile.role.departmentId) {
        incrementCount(departmentInteractionCounts, step.departmentId);
      }

      return {
        id: step.nodeId,
        label: step.label,
        type: step.type,
        departmentName: resolveDepartmentName(step.departmentId),
        previousRoles: resolveRoleNames(step.previousRoleIds),
        nextRoles: resolveRoleNames(step.nextRoleIds)
      };
    });

    return {
      id: process.processId,
      name: process.processName,
      steps
    };
  });

  const responsibilitiesFromProfile = params.roleProfile.processesInvolvedIn.flatMap((process) =>
    process.steps.map((step) => {
      const interactions = uniqueStrings([...resolveRoleNames(step.previousRoleIds), ...resolveRoleNames(step.nextRoleIds)]);
      const interactionLabel = interactions.length > 0 ? `Collaboration : ${interactions.join(', ')}` : null;
      const processLabel = params.roleProfile.processesInvolvedIn.length > 1 ? `Processus : ${process.processName}` : null;

      return [
        `${step.type === 'action' ? 'Action' : 'Décision'} : ${step.label}`,
        interactionLabel,
        step.departmentId && step.departmentId !== params.roleProfile.role.departmentId
          ? `Département associé : ${resolveDepartmentName(step.departmentId)}`
          : null,
        processLabel
      ]
        .filter(Boolean)
        .join(' — ');
    })
  );

  const collaboratorRoles = Array.from(roleInteractionCounts.entries())
    .map(([id, count]) => ({ id, name: params.lookups.roles[id], count }))
    .filter((item) => typeof item.name === 'string' && item.name.length > 0)
    .sort((a, b) => b.count - a.count);

  const collaboratorDepartments = Array.from(departmentInteractionCounts.entries())
    .map(([id, count]) => ({ id, name: params.lookups.departments[id], count }))
    .filter((item) => typeof item.name === 'string' && item.name.length > 0)
    .sort((a, b) => b.count - a.count);

  const frequentCollaborators = uniqueStrings([
    ...collaboratorRoles.filter(({ count }) => count > 1).map((item) => item.name),
    ...collaboratorDepartments
      .filter(({ count }) => count > 1)
      .map((item) => item.name)
  ]).filter((name) => name.length > 0);

  const fallbackCollaborators = uniqueStrings([
    ...collaboratorRoles.map((item) => item.name),
    ...collaboratorDepartments.map((item) => item.name)
  ]).filter((name) => name.length > 0);

  const collaborationFromProfile =
    frequentCollaborators.length > 0
      ? frequentCollaborators.slice(0, 6)
      : fallbackCollaborators.length > 0
        ? fallbackCollaborators.slice(0, 6)
        : [];

  const responsibilities = (() => {
    if (responsibilitiesFromProfile.length > 0) {
      return responsibilitiesFromProfile;
    }
    return ['Non spécifié dans les données'];
  })();

  const objectives = (() => {
    return ['Non spécifié dans les données'];
  })();

  const collaboration = (() => {
    if (collaborationFromProfile.length > 0) {
      return uniqueStrings(collaborationFromProfile);
    }
    return ['Non spécifié dans les données'];
  })();

  const summary = (() => {
    if (responsibilitiesFromProfile.length > 0) {
      const processLabels = uniqueStrings(params.roleProfile.processesInvolvedIn.map((p) => p.processName));
      return `Rôle impliqué dans les processus : ${processLabels.join(', ')}.`;
    }

    return 'Non spécifié dans les données';
  })();

  const title = params.roleProfile.role.name || 'Non spécifié dans les données';

  return {
    role: params.roleProfile.role,
    processes: processesForModel,
    collaborators: {
      frequentRoles: collaboratorRoles,
      frequentDepartments: collaboratorDepartments
    },
    title,
    summary,
    responsibilities,
    objectives,
    collaboration
  };
  };

  const buildPrompt = (params: {
    roleProfile: RoleProfile;
    lookups: {
      roles: Record<string, string>;
      roleDepartments: Record<string, string | null>;
      departments: Record<string, string>;
    };
  }) => {
    const structuredData = buildStructuredDataForGeneration(params);
    const serializedData = JSON.stringify(structuredData, null, 2);

    const instructions = [
      'Tu es un expert RH. Génère en français une fiche de poste lisible et professionnelle à partir des données fournies.',
      'Contraintes impératives :',
      '- N’utilise que les informations de "donnees_role" (aucune invention).',
      '- Réécris intégralement la fiche à chaque demande en reformulant tout le contenu, sans réutiliser textuellement une version précédente.',
      '- Produit exactement 4 sections :',
      '  1) Titre du poste & Résumé',
      '  2) Responsabilités principales',
      '  3) Objectifs et indicateurs',
      '  4) Collaboration attendue',
      '- Ton : professionnel, simple, naturel, sans jargon technique ni tournures mécaniques.',
      '- Responsabilités : 3 à 5 puces maximum, phrases courtes et orientées action, sans répéter inutilement le même processus.',
      '  Regroupe ou reformule des étapes proches pour rendre le texte fluide, sans ajouter de tâches nouvelles.',
      "  Mentionne une collaboration uniquement si elle ressort clairement des données (ex : 'en lien avec l'Analyste qualité'), sans notions de graphe 'précédé/suivi'.",
      '- Collaboration attendue : liste courte (3-6) des rôles ou départements qui ressortent le plus des interactions.',
      "  Exclue le département du rôle si présent, supprime les doublons et évite les évidences ou redites.",
      '- Appuie-toi sur les fréquences présentes dans "collaborators" de donnees_role pour mettre en avant les liens forts.',
      '- Si une information manque, écris exactement : "Non spécifié dans les données".',
      '- Retire toute mention d’identifiants techniques ou parenthèses de type "ID:".',
      '- Réponds uniquement en JSON strictement valide (sans Markdown) avec les clés :',
      '  { "title", "generalDescription", "responsibilities", "objectives", "collaboration", "content" }',
      '- Champs JSON :',
      '  * title : intitulé du poste.',
      '  * generalDescription : résumé concis du rôle.',
      '  * responsibilities : puces actionnables basées uniquement sur les données.',
      '  * objectives : objectifs ou indicateurs déjà présents dans les données.',
      '  * collaboration : noms de rôles ou départements clés, sans phrases longues.',
      '  * content : texte complet structuré avec les 4 sections numérotées ci-dessus.',
      '- Chaque liste (responsibilities, objectives, collaboration) doit contenir au moins un élément.',
      '- Ne renvoie rien d’autre que le JSON demandé.'
    ].join('\n');

    const userContent = ['donnees_role:', serializedData].join('\n');

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

    const cleanText = (value: string | undefined) => stripTechnicalIds(value ?? '');

    const fallbackSections: JobDescriptionSections = {
      title: cleanText(validated.data.title) || 'Non spécifié dans les données',
      generalDescription: cleanText(validated.data.generalDescription) || 'Non spécifié dans les données',
      responsibilities:
        validated.data.responsibilities.length > 0
          ? validated.data.responsibilities.map(stripTechnicalIds)
          : ['Non spécifié dans les données'],
      objectives:
        validated.data.objectives.length > 0
          ? validated.data.objectives.map(stripTechnicalIds)
          : ['Non spécifié dans les données'],
      collaboration:
        validated.data.collaboration.length > 0
          ? validated.data.collaboration.map(stripTechnicalIds)
          : ['Non spécifié dans les données']
    };

    const contentSeed = stripTechnicalIds(validated.data.content ?? '') || stringifySections(fallbackSections);

    const sections = ensureJobDescriptionSections({
      content: contentSeed,
      sections: fallbackSections
    });

    const content = stripTechnicalIds(validated.data.content ?? '') || stringifySections(sections);

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
  let lookups:
    | {
        roles: Record<string, string>;
        roleDepartments: Record<string, string | null>;
        departments: Record<string, string>;
      }
    | null = null;

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
    lookups
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
