import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { departmentInputSchema, departmentListSchema, departmentSchema } from '@/lib/validation/department';

import {
  mapDepartmentWriteError,
  NO_STORE_HEADERS,
  normalizeDepartmentRecord
} from './helpers';

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
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erreur lors de la récupération des départements', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer la liste des départements.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = (data ?? []).map(normalizeDepartmentRecord);
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
    body = {};
  }

  const parsedBody = departmentInputSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Le nom fourni est invalide.', details: parsedBody.error.flatten() },
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
    .from('departments')
    .insert({ name: parsedBody.data.name })
    .select('id, name, created_at, updated_at')
    .single();

  if (error) {
    console.error('Erreur lors de la création du département', error);
    const mapped = mapDepartmentWriteError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la création du département.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = normalizeDepartmentRecord(data);
  const parsedDepartment = departmentSchema.safeParse(normalized);

  if (!parsedDepartment.success) {
    console.error('Département créé invalide', parsedDepartment.error);
    return NextResponse.json(
      { error: 'Les données du département créé sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedDepartment.data, { status: 201, headers: NO_STORE_HEADERS });
}
