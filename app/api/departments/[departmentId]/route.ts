import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { departmentInputSchema, departmentSchema } from '@/lib/validation/department';
import {
  fetchUserOrganizations,
  getAccessibleOrganizationIds
} from '@/lib/organization/memberships';

import {
  departmentIdParamSchema,
  mapDepartmentWriteError,
  NO_STORE_HEADERS,
  normalizeDepartmentRecord
} from '../helpers';

type RouteContext = {
  params: { departmentId?: string };
};

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsedBody = departmentInputSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Le nom fourni est invalide.', details: parsedBody.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const departmentId = parsedParams.data.departmentId;

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour mettre à jour le département', membershipError);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour le département.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Département introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('departments')
    .update({ name: parsedBody.data.name, color: parsedBody.data.color })
    .eq('id', departmentId)
    .in('organization_id', accessibleOrganizationIds)
    .select('id, name, color, created_at, updated_at, organization_id, roles:roles(id, name, color, department_id, created_at, updated_at)')
    .order('updated_at', { foreignTable: 'roles', ascending: false })
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la mise à jour du département', error);
    const mapped = mapDepartmentWriteError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Département introuvable.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = normalizeDepartmentRecord(data);
  const parsedDepartment = departmentSchema.safeParse(normalized);

  if (!parsedDepartment.success) {
    console.error('Département mis à jour invalide', parsedDepartment.error);
    return NextResponse.json(
      { error: 'Les données du département mis à jour sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedDepartment.data, { headers: NO_STORE_HEADERS });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = departmentIdParamSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Identifiant de département invalide.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const departmentId = parsedParams.data.departmentId;

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour supprimer le département', membershipError);
    return NextResponse.json(
      { error: 'Impossible de supprimer le département.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Département introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('departments')
    .delete()
    .eq('id', departmentId)
    .in('organization_id', accessibleOrganizationIds)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la suppression du département', error);
    const mapped = mapDepartmentWriteError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Département introuvable.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
