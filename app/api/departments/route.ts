import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import {
  departmentListSchema,
  departmentNameSchema,
  departmentSchema
} from '@/lib/validation/department';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

const createPayloadSchema = z.object({
  name: departmentNameSchema
});

type SupabaseDepartmentRow = {
  id: string;
  name: unknown;
  created_at: unknown;
  updated_at: unknown;
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string);

  if (Number.isNaN(date.getTime())) {
    console.error('Horodatage de département invalide', value);
    return null;
  }

  return date.toISOString();
};

const normalizeDepartment = (row: SupabaseDepartmentRow) => {
  const createdAt = normalizeTimestamp(row.created_at);
  const updatedAt = normalizeTimestamp(row.updated_at);

  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name.trim() : '',
    createdAt,
    updatedAt
  };
};

const mapUniqueViolationToResponse = (error: { code?: string }) => {
  if (error.code?.toUpperCase() === '23505') {
    return NextResponse.json(
      { error: 'Un département avec ce nom existe déjà.' },
      { status: 409, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    { error: 'Impossible de créer le département.' },
    { status: 500, headers: NO_STORE_HEADERS }
  );
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

  const { data, error } = await supabase
    .from('departments')
    .select('id, name, created_at, updated_at')
    .eq('owner_id', user.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('Erreur lors de la récupération des départements', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer la liste des départements.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = (data ?? []).map(normalizeDepartment);
  const parsed = departmentListSchema.safeParse(normalized);

  if (!parsed.success) {
    console.error('Liste des départements invalide', parsed.error);
    return NextResponse.json(
      { error: 'Les données des départements sont invalides.' },
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
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsedBody = createPayloadSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Le nom du département est invalide.', details: parsedBody.error.flatten() },
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

  const name = parsedBody.data.name.trim();

  const { data, error } = await supabase
    .from('departments')
    .insert({ owner_id: user.id, name })
    .select('id, name, created_at, updated_at')
    .single();

  if (error) {
    console.error('Erreur lors de la création du département', error);
    return mapUniqueViolationToResponse(error);
  }

  const normalized = normalizeDepartment(data as SupabaseDepartmentRow);
  const parsed = departmentSchema.safeParse(normalized);

  if (!parsed.success) {
    console.error('Département créé avec un format inattendu', parsed.error);
    return NextResponse.json(
      { error: 'La création du département a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data, { status: 201, headers: NO_STORE_HEADERS });
}
