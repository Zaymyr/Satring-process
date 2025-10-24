import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { processSummarySchema, type ProcessSummary } from '@/lib/validation/process';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

const paramsSchema = z.object({ id: z.string().uuid() });

const renameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Le titre doit contenir au moins un caractère.')
    .max(120, 'Le titre ne peut pas dépasser 120 caractères.')
});

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

  const { data, error } = await supabase
    .from('process_snapshots')
    .update({ title })
    .eq('id', params.data.id)
    .eq('owner_id', user.id)
    .select('id, title, updated_at')
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
