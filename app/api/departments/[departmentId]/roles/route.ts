import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { roleInputSchema, roleSchema } from '@/lib/validation/role';

import {
  departmentIdParamSchema,
  mapRoleWriteError,
  NO_STORE_HEADERS,
  normalizeRoleRecord
} from '../../helpers';

type RouteContext = {
  params: { departmentId?: string };
};

export async function POST(request: Request, context: RouteContext) {
  const parsedParams = departmentIdParamSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Identifiant de département invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedBody = roleInputSchema.safeParse(body ?? {});
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

  const departmentId = parsedParams.data.departmentId;

  const { data, error } = await supabase
    .from('roles')
    .insert({ department_id: departmentId, name: parsedBody.data.name })
    .select('id, name, department_id, created_at, updated_at')
    .single();

  if (error) {
    console.error('Erreur lors de la création du rôle', error);
    const mapped = mapRoleWriteError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la création du rôle.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = normalizeRoleRecord(data);
  const parsedRole = roleSchema.safeParse(normalized);

  if (!parsedRole.success) {
    console.error('Rôle créé invalide', parsedRole.error);
    return NextResponse.json(
      { error: 'Les données du rôle créé sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedRole.data, { status: 201, headers: NO_STORE_HEADERS });
}
