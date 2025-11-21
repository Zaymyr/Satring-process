import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { roleInputSchema, roleSchema } from '@/lib/validation/role';
import {
  fetchUserOrganizations,
  getAccessibleOrganizationIds
} from '@/lib/organization/memberships';

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

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error(
      'Erreur lors de la récupération des organisations pour créer le rôle',
      membershipError
    );
    return NextResponse.json(
      { error: 'Impossible de déterminer l’organisation cible.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Département introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data: department, error: departmentError } = await supabase
    .from('departments')
    .select('id, organization_id')
    .eq('id', departmentId)
    .in('organization_id', accessibleOrganizationIds)
    .maybeSingle();

  if (departmentError) {
    console.error('Erreur lors de la vérification du département avant création du rôle', departmentError);
    return NextResponse.json(
      { error: 'Impossible de créer le rôle.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!department) {
    return NextResponse.json({ error: 'Département introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const organizationId =
    typeof department.organization_id === 'string'
      ? department.organization_id
      : String(department.organization_id ?? '');

  if (!organizationId) {
    console.error('Identifiant organisation manquant pour la création du rôle', department);
    return NextResponse.json(
      { error: 'Impossible de déterminer l’organisation cible.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const { data, error } = await supabase
    .from('roles')
    .insert({
      department_id: departmentId,
      name: parsedBody.data.name,
      color: parsedBody.data.color,
      organization_id: organizationId
    })
    .select('id, name, color, department_id, created_at, updated_at')
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
