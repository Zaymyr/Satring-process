import { NextResponse } from 'next/server';

import { getInviteDemoDepartments } from '@/lib/department/demo';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { generateRandomHexColor } from '@/lib/colors';
import { departmentInputSchema, departmentListSchema, departmentSchema } from '@/lib/validation/department';
import {
  fetchUserOrganizations,
  getAccessibleOrganizationIds,
  selectDefaultOrganization
} from '@/lib/organization/memberships';

import {
  mapDepartmentWriteError,
  NO_STORE_HEADERS,
  normalizeDepartmentRecord
} from './helpers';

export async function GET() {
  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError) {
    console.error("Erreur lors de la récupération de l'utilisateur", authError);
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  if (!user) {
    const demoDepartments = getInviteDemoDepartments();
    const parsedDemo = departmentListSchema.safeParse(demoDepartments);

    if (!parsedDemo.success) {
      console.error('Données de démonstration invalides', parsedDemo.error);
      return NextResponse.json(
        { error: 'Impossible de fournir les départements de démonstration.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(parsedDemo.data, { headers: NO_STORE_HEADERS });
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour les départements', membershipError);
    return NextResponse.json(
      { error: 'Impossible de récupérer la liste des départements.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json([], { headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('departments')
    .select('id, name, color, created_at, updated_at, organization_id, roles:roles(id, name, color, department_id, created_at, updated_at)')
    .in('organization_id', accessibleOrganizationIds)
    .order('updated_at', { ascending: false })
    .order('updated_at', { foreignTable: 'roles', ascending: false });

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

  const normalizedBody: Record<string, unknown> =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  if (typeof normalizedBody.color !== 'string') {
    normalizedBody.color = generateRandomHexColor();
  }

  const parsedBody = departmentInputSchema.safeParse(normalizedBody);
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

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour la création de département', membershipError);
    return NextResponse.json(
      { error: 'Impossible de déterminer l’organisation cible.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const targetOrganization = selectDefaultOrganization(memberships);

  if (!targetOrganization) {
    return NextResponse.json(
      { error: 'Aucune organisation disponible pour créer un département.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data, error } = await supabase
    .from('departments')
    .insert({
      name: parsedBody.data.name,
      color: parsedBody.data.color,
      organization_id: targetOrganization.organizationId
    })
    .select('id, name, color, created_at, updated_at, organization_id, roles:roles(id, name, color, department_id, created_at, updated_at)')
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
