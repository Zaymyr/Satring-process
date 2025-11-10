import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { roleInputSchema, roleSchema } from '@/lib/validation/role';
import {
  fetchUserOrganizations,
  getAccessibleOrganizationIds
} from '@/lib/organization/memberships';

import {
  mapRoleWriteError,
  NO_STORE_HEADERS,
  normalizeRoleRecord,
  roleIdParamSchema
} from '../../departments/helpers';

type RouteContext = {
  params: { roleId?: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsedParams = roleIdParamSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Identifiant de rôle invalide.' },
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

  const roleId = parsedParams.data.roleId;

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour mettre à jour le rôle', membershipError);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour le rôle.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Rôle introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('roles')
    .update({ name: parsedBody.data.name, color: parsedBody.data.color })
    .eq('id', roleId)
    .in('organization_id', accessibleOrganizationIds)
    .select('id, name, color, department_id, created_at, updated_at, organization_id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la mise à jour du rôle', error);
    const mapped = mapRoleWriteError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Rôle introuvable.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = normalizeRoleRecord(data);
  const parsedRole = roleSchema.safeParse(normalized);

  if (!parsedRole.success) {
    console.error('Rôle mis à jour invalide', parsedRole.error);
    return NextResponse.json(
      { error: 'Les données du rôle mis à jour sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedRole.data, { headers: NO_STORE_HEADERS });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsedParams = roleIdParamSchema.safeParse(context.params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Identifiant de rôle invalide.' },
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

  const roleId = parsedParams.data.roleId;

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour supprimer le rôle', membershipError);
    return NextResponse.json(
      { error: 'Impossible de supprimer le rôle.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Rôle introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('roles')
    .delete()
    .eq('id', roleId)
    .in('organization_id', accessibleOrganizationIds)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Erreur lors de la suppression du rôle', error);
    const mapped = mapRoleWriteError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Rôle introuvable.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
