import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import { createDefaultProcessPayload, DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { ensureSampleDataSeeded } from '@/lib/onboarding/sample-seed';
import { processResponseSchema, processSummarySchema, type ProcessResponse } from '@/lib/validation/process';
import {
  fetchUserOrganizations,
  getAccessibleOrganizationIds,
  getManageableMemberships,
  selectDefaultOrganization
} from '@/lib/organization/memberships';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

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

const createProcessSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Le titre doit contenir au moins un caractère.')
      .max(120, 'Le titre ne peut pas dépasser 120 caractères.')
      .optional()
  })
  .default({});

const isRlsDeniedError = (error: { message?: string; details?: string | null; hint?: string | null }) => {
  const normalizedSegments = [error.message, error.details, error.hint]
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase().replace(/[-_]+/g, ' ') : ''))
    .filter((segment) => segment.length > 0);

  return normalizedSegments.some((segment) =>
    segment.includes('row level security') || segment.includes('permission denied for table')
  );
};

const mapCreateProcessError = (error: {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return { status: 401, body: { error: 'Authentification requise.' } } as const;
  }

  if (code === '22P02') {
    return { status: 400, body: { error: 'Le format des étapes est invalide.' } } as const;
  }

  if (code === '22023') {
    return { status: 422, body: { error: 'Ajoutez au moins deux étapes pour créer un process.' } } as const;
  }

  if (code === '23502') {
    return { status: 400, body: { error: 'Identifiant de process requis.' } } as const;
  }

  if (code === '42501') {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de créer un process." }
    } as const;
  }

  if (code === '23505') {
    return {
      status: 409,
      body: {
        error: 'Impossible de créer un nouveau process car une contrainte d\'unicité empêche son insertion.'
      }
    } as const;
  }

  if (code === '23503') {
    return {
      status: 404,
      body: { error: 'Organisation introuvable pour la création du process.' }
    } as const;
  }

  if (isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de créer un process." }
    } as const;
  }

  return { status: 500, body: { error: 'Impossible de créer un nouveau process.' } } as const;
};

export async function GET() {
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
    console.error('Erreur lors de la récupération des organisations de l’utilisateur', membershipError);
    return NextResponse.json(
      { error: 'Impossible de récupérer la liste des process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json([], { headers: NO_STORE_HEADERS });
  }

  try {
    await ensureSampleDataSeeded(supabase);
  } catch (seedError) {
    console.error('Erreur lors de la préparation des données de démonstration (processes)', seedError);
  }

  const { data, error } = await supabase
    .from('process_snapshots')
    .select('id, title, updated_at, organization_id')
    .in('organization_id', accessibleOrganizationIds)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erreur lors de la récupération des process', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer la liste des process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = (data ?? []).map((item) => ({
    id: item.id,
    title: typeof item.title === 'string' && item.title.trim() ? item.title : DEFAULT_PROCESS_TITLE,
    updatedAt: normalizeUpdatedAt(item.updated_at)
  }));

  const parsed = processSummarySchema.array().safeParse(normalized);
  if (!parsed.success) {
    console.error('Liste des process invalide', parsed.error);
    return NextResponse.json(
      { error: 'Les données des process sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedBody = createProcessSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Le titre fourni est invalide.', details: parsedBody.error.flatten() },
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

  const desiredTitle = parsedBody.data.title?.trim() ?? DEFAULT_PROCESS_TITLE;
  const payload = createDefaultProcessPayload(desiredTitle);

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour la création de process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de déterminer l’organisation de destination.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const manageableMemberships = getManageableMemberships(memberships);
  const targetOrganization = selectDefaultOrganization(manageableMemberships);

  if (!targetOrganization) {
    return NextResponse.json(
      { error: "Vous devez être propriétaire ou administrateur pour créer un process." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data, error } = await supabase.rpc('create_process_snapshot', {
    payload: {
      title: payload.title,
      steps: payload.steps,
      organization_id: targetOrganization.organizationId
    }
  });

  if (error) {
    console.error('Erreur lors de la création du process', error);
    const mapped = mapCreateProcessError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la création du process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const record = Array.isArray(data) ? data[0] : data;

  if (!record) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la création du process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const parsed = processResponseSchema.safeParse({
    id: record.id,
    title: typeof record.title === 'string' && record.title.trim() ? record.title : DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(record.steps),
    updatedAt: normalizeUpdatedAt(record.updated_at)
  });

  if (!parsed.success) {
    console.error('Process créé avec un format inattendu', parsed.error);
    return NextResponse.json(
      { error: 'La création du process a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data as ProcessResponse, {
    status: 201,
    headers: NO_STORE_HEADERS
  });
}
