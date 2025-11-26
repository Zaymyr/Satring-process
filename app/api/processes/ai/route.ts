import { NextResponse } from 'next/server';
import { z } from 'zod';

import { performChatCompletion } from '@/lib/ai/openai';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { fetchUserOrganizations, getManageableOrganizationIds } from '@/lib/organization/memberships';
import { getServerUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { processPayloadSchema, processResponseSchema, stepTypeValues, type ProcessPayload } from '@/lib/validation/process';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Content-Security-Policy': "default-src 'none'"
} as const;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitCache = new Map<string, { count: number; expires: number }>();

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
    .transform((value) => value ?? '')
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
          departmentId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
          roleId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
          yesTargetId: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
          noTargetId: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] }
        },
        required: ['id', 'label', 'type', 'departmentId', 'roleId', 'yesTargetId', 'noTargetId']
      }
    }
  },
  required: ['title', 'steps'],
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
          content:
            "Tu es un expert en cartographie de processus (bilingue français/anglais). A partir du processus fourni, propose une version améliorée en respectant strictement le schéma JSON indiqué. La sortie doit uniquement contenir le JSON final, sans commentaire."
        },
        {
          role: 'user',
          content: [
            'Processus actuel :',
            grounding,
            'Contexte supplémentaire :',
            parsedBody.data.context || 'Aucun contexte fourni.',
            'Demande utilisateur :',
            parsedBody.data.prompt,
            "Utilise l\'identifiant existant et retourne un objet JSON conforme au schéma."
          ].join('\n\n')
        }
      ],
      temperature: 0.35,
      maxTokens: 900,
      responseFormat: { type: 'json_schema', json_schema: { name: 'process_payload', schema: aiResponseSchema } }
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

  const parsedPayload = processPayloadSchema.safeParse({
    id: parsedProcess.data.id,
    title: (aiPayload as Record<string, unknown>)?.title ?? parsedProcess.data.title,
    steps: normalizeSteps((aiPayload as Record<string, unknown>)?.steps)
  });

  if (!parsedPayload.success) {
    console.error('Payload IA invalide', parsedPayload.error);
    return NextResponse.json(
      { error: 'Le format de la réponse générée est invalide.', details: parsedPayload.error.flatten() },
      { status: 502, headers: RESPONSE_HEADERS }
    );
  }

  return NextResponse.json(parsedPayload.data satisfies ProcessPayload, { headers: RESPONSE_HEADERS });
}
