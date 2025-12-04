import { NextResponse } from 'next/server';
import { z } from 'zod';

import { performChatCompletion } from '@/lib/ai/openai';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { fetchUserOrganizations, getManageableOrganizationIds } from '@/lib/organization/memberships';
import { getServerUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { processPayloadSchema, processResponseSchema, stepTypeValues, type ProcessPayload } from '@/lib/validation/process';

type DepartmentWithRoles = {
  id: string;
  name: string;
  roles: { id: string; name: string }[] | null;
  status?: 'persisted' | 'draft';
  rolesStatus?: ('persisted' | 'draft')[];
};

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Content-Security-Policy': "default-src 'none'"
} as const;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitCache = new Map<string, { count: number; expires: number }>();

const formatDepartmentsContext = (departments: DepartmentWithRoles[]): string => {
  if (departments.length === 0) {
    return 'Aucun département ni rôle enregistré pour cette organisation.';
  }

  return departments
    .map((department) => {
      const roleSummary = department.roles?.length
        ? department.roles
            .map((role, index) => {
              const status = department.rolesStatus?.[index] === 'draft' ? ' (brouillon)' : '';
              return `  - ${role.name}${status} (id: ${role.id})`;
            })
            .join('\n')
        : '  - Aucun rôle enregistré.';

      const statusLabel = department.status === 'draft' ? ' (brouillon)' : '';

      return [`- ${department.name}${statusLabel} (id: ${department.id})`, roleSummary].join('\n');
    })
    .join('\n');
};

const requestSchema = z.object({
  processId: z.string().uuid("Identifiant de process invalide."),
  prompt: z
    .string()
    .trim()
    .min(1, 'Le prompt doit contenir au moins un caractère.')
    .max(4000, 'Le prompt ne peut pas dépasser 4000 caractères.'),
  context: z
    .string()
    .trim()
    .max(6000, 'Le contexte ne peut pas dépasser 6000 caractères.')
    .optional()
    .transform((value) => value ?? ''),
  departments: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
        status: z.enum(['persisted', 'draft']),
        roles: z.array(
          z.object({
            id: z.string().trim().min(1),
            name: z.string().trim().min(1),
            status: z.enum(['persisted', 'draft'])
          })
        )
      })
    )
    .optional()
    .transform((value) => value ?? [])
});

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
      console.error('Échec du parsing des étapes de process (IA)', error);
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
    console.error('Horodatage de process invalide (IA)', value);
    return null;
  }

  return date.toISOString();
};

const enforceRateLimit = (request: Request) => {
  const ipHeader = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for');
  const ip = ipHeader?.split(',')[0]?.trim() || 'anonymous';
  const now = Date.now();
  const existing = rateLimitCache.get(ip);

  if (existing && existing.expires > now) {
    if (existing.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez plus tard.' },
        { status: 429, headers: RESPONSE_HEADERS }
      );
    }

    existing.count += 1;
    rateLimitCache.set(ip, existing);
    return null;
  }

  rateLimitCache.set(ip, { count: 1, expires: now + RATE_LIMIT_WINDOW_MS });
  return null;
};

const aiResponseSchema = {
  type: 'object',
  properties: {
    process: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string', minLength: 1, maxLength: 120 },
        steps: {
          type: 'array',
          minItems: 2,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', minLength: 1 },
              label: { type: 'string' },
              type: { type: 'string', enum: stepTypeValues },
              departmentId: {
                anyOf: [
                  { type: 'string', format: 'uuid' },
                  { type: 'null' }
                ]
              },
              draftDepartmentName: {
                anyOf: [
                  { type: 'string', minLength: 1 },
                  { type: 'null' }
                ]
              },
              roleId: {
                anyOf: [
                  { type: 'string', format: 'uuid' },
                  { type: 'null' }
                ]
              },
              draftRoleName: {
                anyOf: [
                  { type: 'string', minLength: 1 },
                  { type: 'null' }
                ]
              },
              yesTargetId: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
              noTargetId: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] }
            },
            required: [
              'id',
              'label',
              'type',
              'departmentId',
              'draftDepartmentName',
              'roleId',
              'draftRoleName',
              'yesTargetId',
              'noTargetId'
            ]
          }
        }
      },
      required: ['title', 'steps'],
      additionalProperties: false
    },
    reply: { type: 'string', minLength: 1, maxLength: 1200 }
  },
  required: ['process', 'reply'],
  additionalProperties: false
};

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request);
  if (rateLimited) {
    return rateLimited;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error('Corps de requête JSON invalide pour /processes/ai', error);
    return NextResponse.json(
      { error: 'Requête invalide.' },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Le format de la requête est invalide.', details: parsedBody.error.flatten() },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentification requise.' },
      { status: 401, headers: RESPONSE_HEADERS }
    );
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error("Erreur lors de la récupération des organisations pour l'IA de process", membershipError);
    return NextResponse.json(
      { error: 'Impossible de vérifier vos autorisations.' },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }

  const manageableOrganizationIds = getManageableOrganizationIds(memberships);

  if (manageableOrganizationIds.length === 0) {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de modifier ce process." },
      { status: 403, headers: RESPONSE_HEADERS }
    );
  }

  const { data: processRecord, error: processError } = await supabase
    .from('process_snapshots')
    .select('id, title, steps, updated_at, organization_id')
    .eq('id', parsedBody.data.processId)
    .in('organization_id', manageableOrganizationIds)
    .maybeSingle();

  if (processError) {
    console.error('Erreur lors de la récupération du process pour IA', processError);
    return NextResponse.json(
      { error: 'Impossible de récupérer le process.' },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }

  if (!processRecord) {
    return NextResponse.json(
      { error: 'Process introuvable.' },
      { status: 404, headers: RESPONSE_HEADERS }
    );
  }

  const parsedProcess = processResponseSchema.safeParse({
    id: processRecord.id,
    title:
      typeof processRecord.title === 'string' && processRecord.title.trim().length > 0
        ? processRecord.title
        : DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(processRecord.steps),
    updatedAt: normalizeUpdatedAt(processRecord.updated_at)
  });

  if (!parsedProcess.success) {
    console.error('Process existant invalide pour IA', parsedProcess.error);
    return NextResponse.json(
      { error: 'Le process actuel est invalide.' },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }

  let departmentsWithRoles: DepartmentWithRoles[];

  if (parsedBody.data.departments.length > 0) {
    departmentsWithRoles = parsedBody.data.departments.map((department) => ({
      id: department.id,
      name: department.name,
      roles: department.roles.map((role) => ({ id: role.id, name: role.name })),
      status: department.status,
      rolesStatus: department.roles.map((role) => role.status)
    }));
  } else {
    const { data: departmentRows, error: departmentsError } = await supabase
      .from('departments')
      .select('id, name, roles:roles(id, name)')
      .eq('organization_id', processRecord.organization_id)
      .order('name', { ascending: true })
      .order('name', { referencedTable: 'roles', ascending: true });

    if (departmentsError) {
      console.error('Erreur lors de la récupération des départements pour IA', departmentsError);
      return NextResponse.json(
        { error: 'Impossible de récupérer les départements et rôles.' },
        { status: 500, headers: RESPONSE_HEADERS }
      );
    }

    departmentsWithRoles = (departmentRows ?? []).map((department) => ({
      ...department,
      status: 'persisted',
      rolesStatus: department.roles?.map(() => 'persisted')
    })) as DepartmentWithRoles[];
  }

  const departmentsContext = formatDepartmentsContext(departmentsWithRoles);

  const grounding = JSON.stringify(
    {
      id: parsedProcess.data.id,
      title: parsedProcess.data.title,
      steps: parsedProcess.data.steps
    },
    null,
    2
  );

  let completion: string;

  try {
    completion = await performChatCompletion({
  messages: [
    {
      role: 'system',
      content: [
        'Tu es un expert en cartographie de processus et en organisation (bilingue français/anglais).',
        'Ton objectif principal est de comprendre le processus métier, de clarifier la logique des étapes et de proposer une répartition cohérente des responsabilités (départements et rôles).',
        '',
        'Règles importantes :',
        '- Tu dois toujours renvoyer un objet JSON valide qui respecte strictement le schéma fourni (process + reply).',
        '- Pour les identifiants de départements et de rôles :',
        '  • Si tu fais référence à un département ou un rôle existant, tu dois réutiliser EXACTEMENT son UUID tel qu’il apparaît dans le référentiel.',
        '  • Si tu souhaites proposer un NOUVEAU département, laisse departmentId à null et renseigne draftDepartmentName avec le nom du département (sans inventer d’UUID).',
        '  • Si tu souhaites proposer un NOUVEAU rôle sur un département existant, renseigne departmentId avec un UUID existant, mets roleId à null et renseigne draftRoleName.',
        '  • Si tu souhaites proposer un NOUVEAU rôle sur un NOUVEAU département, laisse departmentId/roleId à null et renseigne draftDepartmentName et draftRoleName.',
        '  • N’invente jamais d’UUID ni d’identifiant temporaire : toute création passe par les champs draft*.',
        '',
        'Priorité métier :',
        '- Cherche à éviter les étapes sans responsable : pour chaque étape, essaye soit de trouver le meilleur département/rôle existant, soit de proposer un nouveau département/rôle cohérent via les champs draft*.',
        '- Regroupe les actions par logique métier (préparation, validation, exécution, contrôle, communication, etc.) et tiens compte de qui est le plus légitime pour réaliser chaque étape.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        'Référentiel des départements et rôles existants (réutilise uniquement ces UUID pour departmentId/roleId) :',
        departmentsContext,
        '',
        'Processus actuel (id, titre, steps) :',
        grounding,
        '',
        'Contexte métier supplémentaire :',
        parsedBody.data.context || 'Aucun contexte métier additionnel fourni.',
        '',
        'Demande utilisateur :',
        parsedBody.data.prompt,
        '',
        'Tâche à effectuer :',
        '- Analyse le processus du point de vue métier : objectif, enchaînement logique, acteurs impliqués.',
        '- Améliore la clarté du processus (labels, ordre, éventuels splits/decisions) sans le compliquer inutilement.',
        '- Pour chaque étape, choisis le département et le rôle le plus pertinent dans le référentiel ou propose-en un nouveau via draftDepartmentName/draftRoleName si nécessaire.',
        '',
        'Contraintes de sortie :',
        '- La réponse doit être un objet JSON unique avec exactement deux propriétés :',
        '  • "process" : le processus complet mis à jour, conforme au schéma (id existant, title, steps avec departmentId/roleId/draft*).',
        '  • "reply" : un court message pour l’utilisateur (max 3 phrases) qui :',
        '    · résume les principaux changements (ex : nouveaux départements/rôles, étapes restructurées),',
        '    · pose éventuellement UNE question de clarification si des informations importantes manquent.',
        '- Ne retourne aucun texte en dehors de cet objet JSON.'
      ].join('\n')
    }
  ],
  model: 'gpt-4.1-mini',
  temperature: 0.4,      // <— un peu plus haut pour encourager les propositions
  maxTokens: 2000,
  responseFormat: {
    type: 'json_schema',
    json_schema: { name: 'process_payload', schema: aiResponseSchema }
  }
});

  } catch (generationError) {
    console.error('Erreur OpenAI lors de la génération du process', generationError);
    const message =
      generationError instanceof Error
        ? generationError.message
        : 'Impossible de générer le process pour le moment.';

    return NextResponse.json({ error: message }, { status: 502, headers: RESPONSE_HEADERS });
  }

  let aiPayload: unknown;

  try {
    aiPayload = JSON.parse(completion);
  } catch (parseError) {
    console.error('Réponse IA illisible pour process', parseError);
    return NextResponse.json(
      { error: 'La réponse générée est invalide.' },
      { status: 502, headers: RESPONSE_HEADERS }
    );
  }

  if (!aiPayload || typeof aiPayload !== 'object') {
    console.error('Réponse IA invalide : payload non structuré');
    return NextResponse.json(
      { error: 'Le format de la réponse générée est invalide.' },
      { status: 502, headers: RESPONSE_HEADERS }
    );
  }

  const aiPayloadRecord = aiPayload as Record<string, unknown>;

  const aiProcess = aiPayloadRecord.process as Record<string, unknown> | undefined;
  const reply = typeof aiPayloadRecord.reply === 'string' ? aiPayloadRecord.reply.trim() : '';

  const parsedPayload = processPayloadSchema.safeParse({
    id: parsedProcess.data.id,
    title: aiProcess?.title ?? parsedProcess.data.title,
    steps: normalizeSteps(aiProcess?.steps)
  });

  if (!parsedPayload.success || reply.length === 0) {
    console.error('Payload IA invalide', parsedPayload.success ? 'Message manquant' : parsedPayload.error);
    return NextResponse.json(
      { error: 'Le format de la réponse générée est invalide.' },
      { status: 502, headers: RESPONSE_HEADERS }
    );
  }

  const existingDepartmentById = new Map<string, DepartmentWithRoles>(
    departmentsWithRoles.map((department) => [department.id, department])
  );
  const existingRoleById = new Map<string, { id: string; departmentId: string }>();

  departmentsWithRoles.forEach((department) => {
    department.roles?.forEach((role) => {
      existingRoleById.set(role.id, { id: role.id, departmentId: department.id });
    });
  });

  const invalidDepartmentIds = new Set<string>();
  const invalidRoleIds = new Set<string>();
  const mismatchedRoleIds = new Set<string>();

  // 🔹 SANITIZE : on nettoie les incohérences IA avant de valider
  const reconciledSteps = parsedPayload.data.steps.map((step) => {
    let { departmentId, roleId } = step;

    const existingDept = departmentId ? existingDepartmentById.get(departmentId) : undefined;
    const existingRole = roleId ? existingRoleById.get(roleId) : undefined;

    if (departmentId && !existingDept) {
      invalidDepartmentIds.add(departmentId);
      departmentId = null;
      roleId = null;
    }

    if (roleId && !existingRole) {
      invalidRoleIds.add(roleId);
      roleId = null;
    }

    if (departmentId && roleId && existingRole && existingRole.departmentId !== departmentId) {
      mismatchedRoleIds.add(roleId);
      roleId = null;
    }

    return {
      ...step,
      departmentId,
      roleId
    };
  });

  // 🔹 On remplace les steps par la version nettoyée
  parsedPayload.data.steps = reconciledSteps;

  if (invalidDepartmentIds.size > 0) {
    return NextResponse.json(
      { error: 'Le process généré référence un département inconnu.' },
      { status: 422, headers: RESPONSE_HEADERS }
    );
  }

  if (invalidRoleIds.size > 0) {
    return NextResponse.json(
      { error: 'Le process généré référence un rôle inconnu.' },
      { status: 422, headers: RESPONSE_HEADERS }
    );
  }

  if (mismatchedRoleIds.size > 0) {
    return NextResponse.json(
      { error: 'Le rôle référencé ne correspond pas au département indiqué.' },
      { status: 422, headers: RESPONSE_HEADERS }
    );
  }

  // 🔹 Ensuite on garde la boucle de validation comme garde-fou (au cas où)
  for (const step of parsedPayload.data.steps) {
    const departmentId = step.departmentId;
    const roleId = step.roleId;

    if (!departmentId && roleId) {
      return NextResponse.json(
        { error: 'Un rôle est référencé sans département dans le process généré.' },
        { status: 422, headers: RESPONSE_HEADERS }
      );
    }

    if (departmentId) {
      if (!existingDepartmentById.has(departmentId)) {
        return NextResponse.json(
          { error: 'Le process généré référence un département inconnu.' },
          { status: 422, headers: RESPONSE_HEADERS }
        );
      }
    }

    if (!roleId) {
      continue;
    }

    const existingRole = existingRoleById.get(roleId);

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Le process généré référence un rôle inconnu.' },
        { status: 422, headers: RESPONSE_HEADERS }
      );
    }

    if (!departmentId || existingRole.departmentId !== departmentId) {
      return NextResponse.json(
        { error: 'Le rôle référencé ne correspond pas au département indiqué.' },
        { status: 422, headers: RESPONSE_HEADERS }
      );
    }
  }

  return NextResponse.json(
    { process: parsedPayload.data satisfies ProcessPayload, reply },
    { headers: RESPONSE_HEADERS }
  );
}
