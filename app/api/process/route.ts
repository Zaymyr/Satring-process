import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { processPayloadSchema, processResponseSchema, type ProcessPayload } from '@/lib/validation/process';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

const processIdSchema = z.string().uuid();

type SupabaseError = {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
};

const mapSaveProcessError = (error: SupabaseError) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return {
      status: 401,
      body: { error: 'Authentification requise.' }
    } as const;
  }

  if (code === '22P02') {
    return {
      status: 400,
      body: { error: 'Le format des étapes est invalide.' }
    } as const;
  }

  if (code === '22023') {
    return {
      status: 422,
      body: { error: 'Ajoutez au moins deux étapes pour sauvegarder votre process.' }
    } as const;
  }

  if (code === '23502') {
    return {
      status: 400,
      body: { error: 'Identifiant de process requis pour la sauvegarde.' }
    } as const;
  }

  if (code === '42501') {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de sauvegarder ce process." }
    } as const;
  }

  if (code === 'P0002') {
    return {
      status: 404,
      body: { error: 'Process introuvable.' }
    } as const;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const details = typeof error.details === 'string' ? error.details.toLowerCase() : '';
  const rlsDenied = message.includes('row level security') || details.includes('row level security');

  if (rlsDenied) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de sauvegarder ce process." }
    } as const;
  }

  return {
    status: 500,
    body: { error: 'Impossible de sauvegarder le process.' }
  } as const;
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

export async function GET(request: Request) {
  const processId = processIdSchema.safeParse(new URL(request.url).searchParams.get('id'));

  if (!processId.success) {
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

  const { data, error } = await supabase
    .from('process_snapshots')
    .select('id, title, steps, updated_at')
    .eq('owner_id', user.id)
    .eq('id', processId.data)
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la récupération du process', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer le process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Process introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const parsed = processResponseSchema.safeParse({
    id: data.id,
    title: data.title ?? DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(data.steps),
    updatedAt: normalizeUpdatedAt(data.updated_at)
  });

  if (!parsed.success) {
    console.error('Données de process invalides', parsed.error);
    return NextResponse.json(
      { error: 'Les données du process sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let payload: unknown;

  const processId = processIdSchema.safeParse(new URL(request.url).searchParams.get('id'));

  if (!processId.success) {
    return NextResponse.json(
      { error: 'Identifiant de process invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    payload = await request.json();
  } catch (error) {
    console.error('Corps de requête JSON invalide', error);
    return NextResponse.json(
      { error: 'Requête invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const payloadObject: Record<string, unknown> =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};

  const parsedPayload = processPayloadSchema.safeParse({ ...payloadObject, id: processId.data });
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: 'Le format des étapes est invalide.', details: parsedPayload.error.flatten() },
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

  const body: ProcessPayload = parsedPayload.data;

  const { data, error } = await supabase.rpc('save_process_snapshot', {
    payload: { id: body.id, title: body.title, steps: body.steps }
  });

  if (error) {
    console.error('Erreur lors de la sauvegarde du process', error);
    const mapped = mapSaveProcessError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la sauvegarde du process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const record = Array.isArray(data) ? data[0] : data;

  if (!record) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la sauvegarde du process.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const parsedResponse = processResponseSchema.safeParse({
    id: record.id,
    title: typeof record.title === 'string' && record.title.trim().length > 0 ? record.title : DEFAULT_PROCESS_TITLE,
    steps: normalizeSteps(record.steps),
    updatedAt: normalizeUpdatedAt(record.updated_at)
  });

  if (!parsedResponse.success) {
    console.error('Réponse de sauvegarde du process invalide', parsedResponse.error);
    return NextResponse.json(
      { error: 'La sauvegarde a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedResponse.data, { headers: NO_STORE_HEADERS });
}
