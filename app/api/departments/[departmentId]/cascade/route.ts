import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { departmentCascadeFormSchema, departmentSchema } from '@/lib/validation/department';

import {
  departmentIdParamSchema,
  mapDepartmentWriteError,
  mapRoleWriteError,
  normalizeDepartmentRecord,
  NO_STORE_HEADERS
} from '../../helpers';

interface RouteContext {
  params: { departmentId?: string };
}

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

  const parsedBody = departmentCascadeFormSchema.safeParse(body ?? {});

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Les données fournies pour le département sont invalides.', details: parsedBody.error.flatten() },
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

  const { data: existingDepartment, error: existingDepartmentError } = await supabase
    .from('departments')
    .select(
      'id, name, color, created_at, updated_at, roles:roles(id, name, department_id, created_at, updated_at)'
    )
    .eq('id', departmentId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (existingDepartmentError) {
    console.error('Erreur lors de la récupération du département', existingDepartmentError);
    return NextResponse.json(
      { error: 'Impossible de récupérer le département.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!existingDepartment) {
    return NextResponse.json(
      { error: 'Département introuvable.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedDepartment = normalizeDepartmentRecord(existingDepartment);
  const { name, color, roles } = parsedBody.data;

  if (normalizedDepartment.name !== name || normalizedDepartment.color !== color) {
    const { data: updatedDepartmentRow, error: updateDepartmentError } = await supabase
      .from('departments')
      .update({ name, color })
      .eq('id', departmentId)
      .eq('owner_id', user.id)
      .select('id')
      .maybeSingle();

    if (updateDepartmentError) {
      console.error('Erreur lors de la mise à jour du département', updateDepartmentError);
      const mapped = mapDepartmentWriteError(updateDepartmentError);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
    }

    if (!updatedDepartmentRow) {
      return NextResponse.json(
        { error: 'Département introuvable.' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }
  }

  const existingRolesById = new Map(
    (normalizedDepartment.roles ?? []).map((role) => [role.id, role])
  );
  const seenRoleIds = new Set<string>();

  for (const roleInput of roles) {
    if (roleInput.roleId) {
      seenRoleIds.add(roleInput.roleId);
      const originalRole = existingRolesById.get(roleInput.roleId);

      if (!originalRole) {
        return NextResponse.json(
          { error: "Un rôle fourni n'appartient pas à ce département." },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      if (originalRole.name !== roleInput.name) {
        const { data: updatedRoleRow, error: updateRoleError } = await supabase
          .from('roles')
          .update({ name: roleInput.name })
          .eq('id', roleInput.roleId)
          .eq('department_id', departmentId)
          .eq('owner_id', user.id)
          .select('id')
          .maybeSingle();

        if (updateRoleError) {
          console.error('Erreur lors de la mise à jour du rôle', updateRoleError);
          const mapped = mapRoleWriteError(updateRoleError);
          return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
        }

        if (!updatedRoleRow) {
          return NextResponse.json(
            { error: 'Rôle introuvable pour ce département.' },
            { status: 404, headers: NO_STORE_HEADERS }
          );
        }
      }

      continue;
    }

    const { data: createdRole, error: createRoleError } = await supabase
      .from('roles')
      .insert({ department_id: departmentId, name: roleInput.name })
      .select('id, name, department_id, created_at, updated_at')
      .single();

    if (createRoleError) {
      console.error('Erreur lors de la création du rôle', createRoleError);
      const mapped = mapRoleWriteError(createRoleError);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
    }

    if (!createdRole) {
      return NextResponse.json(
        { error: 'Réponse vide lors de la création du rôle.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  const rolesToDelete: string[] = [];

  for (const existingRoleId of existingRolesById.keys()) {
    if (!seenRoleIds.has(existingRoleId)) {
      rolesToDelete.push(existingRoleId);
    }
  }

  if (rolesToDelete.length > 0) {
    const { error: deleteRolesError } = await supabase
      .from('roles')
      .delete()
      .in('id', rolesToDelete)
      .eq('owner_id', user.id);

    if (deleteRolesError) {
      console.error('Erreur lors de la suppression des rôles', deleteRolesError);
      const mapped = mapRoleWriteError(deleteRolesError);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
    }
  }

  const { data: refreshedDepartment, error: refreshedDepartmentError } = await supabase
    .from('departments')
    .select(
      'id, name, color, created_at, updated_at, roles:roles(id, name, department_id, created_at, updated_at)'
    )
    .eq('id', departmentId)
    .eq('owner_id', user.id)
    .single();

  if (refreshedDepartmentError) {
    console.error('Erreur lors de la récupération du département mis à jour', refreshedDepartmentError);
    return NextResponse.json(
      { error: 'Impossible de récupérer le département mis à jour.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedRefreshed = normalizeDepartmentRecord(refreshedDepartment);
  const parsedDepartment = departmentSchema.safeParse(normalizedRefreshed);

  if (!parsedDepartment.success) {
    console.error('Département mis à jour invalide', parsedDepartment.error);
    return NextResponse.json(
      { error: 'Les données du département mis à jour sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedDepartment.data, { headers: NO_STORE_HEADERS });
}
