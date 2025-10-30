import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import { departmentNameSchema, departmentSchema } from '@/lib/validation/department';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

const paramsSchema = z.object({ id: z.string().uuid() });

const updatePayloadSchema = z.object({
  name: departmentNameSchema
});

const isUniqueViolation = (error: { code?: string }) => error.code?.toUpperCase() === '23505';

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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: "Identifiant de département invalide." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsedBody = updatePayloadSchema.safeParse(body);

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
    .update({ name })
    .eq('id', params.data.id)
    .eq('owner_id', user.id)
    .select('id, name, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la mise à jour du département', error);
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'Un département avec ce nom existe déjà.' },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: 'Impossible de mettre à jour le département.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Département introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const normalized = normalizeDepartment(data as SupabaseDepartmentRow);
  const parsed = departmentSchema.safeParse(normalized);

  if (!parsed.success) {
    console.error('Département mis à jour avec un format inattendu', parsed.error);
    return NextResponse.json(
      { error: 'La mise à jour du département a renvoyé un format inattendu.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data, { headers: NO_STORE_HEADERS });
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: "Identifiant de département invalide." },
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
    .delete()
    .eq('id', params.data.id)
    .eq('owner_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la suppression du département', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer le département.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Département introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
