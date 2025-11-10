import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { processSummarySchema, type ProcessSummary } from '@/lib/validation/process';
import {
  fetchUserOrganizations,
  getAccessibleOrganizationIds
} from '@/lib/organization/memberships';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

const paramsSchema = z.object({ id: z.string().uuid() });

const renameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Le titre doit contenir au moins un caractère.')
    .max(120, 'Le titre ne peut pas dépasser 120 caractères.')
});

type SupabaseError = {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
};

const isRlsDeniedError = (error: SupabaseError) => {
  const normalizedSegments = [error.message, error.details, error.hint]
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase().replace(/[-_]+/g, ' ') : ''))
    .filter((segment) => segment.length > 0);

  return normalizedSegments.some((segment) =>
    segment.includes('row level security') || segment.includes('permission denied for table')
  );
};

const mapDeleteProcessError = (error: SupabaseError) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return { status: 401, body: { error: 'Authentification requise.' } } as const;
  }

  if (code === '42501') {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de supprimer ce process." }
    } as const;
  }

  if (code === 'P0002') {
    return { status: 404, body: { error: 'Process introuvable.' } } as const;
  }

  if (isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de supprimer ce process." }
    } as const;
  }

  return { status: 500, body: { error: 'Impossible de supprimer le process.' } } as const;
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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsedBody = renameSchema.safeParse(body);
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

  const title = parsedBody.data.title.trim();

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour renommer le process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de renommer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('process_snapshots')
    .update({ title })
    .eq('id', params.data.id)
    .in('organization_id', accessibleOrganizationIds)
    .select('id, title, updated_at, organization_id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors du renommage du process', error);
    return NextResponse.json(
      { error: 'Impossible de renommer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const parsed = processSummarySchema.safeParse({
    id: data.id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : DEFAULT_PROCESS_TITLE,
    updatedAt: normalizeUpdatedAt(data.updated_at)
  });

  if (!parsed.success) {
    console.error('Process renommé avec un format inattendu', parsed.error);
    return NextResponse.json(
      { error: 'Le renommage a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data as ProcessSummary, { headers: NO_STORE_HEADERS });
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
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
    console.error('Erreur lors de la récupération des organisations pour supprimer le process', membershipError);
    return NextResponse.json(
      { error: 'Impossible de supprimer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('process_snapshots')
    .delete()
    .eq('id', params.data.id)
    .in('organization_id', accessibleOrganizationIds)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la suppression du process', error);
    const mapped = mapDeleteProcessError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Process introuvable.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
