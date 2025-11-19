import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { organizationRoleSchema } from '@/lib/validation/profile';

const rawMembershipSchema = z.object({
  id: z.string().uuid("Identifiant d'organisation invalide."),
  name: z.string().min(1, "Le nom de l'organisation est requis."),
  role: organizationRoleSchema,
  plan_slug: z.string().min(1).nullable().optional(),
  plan_name: z.string().min(1).nullable().optional(),
  max_owners: z.number().int().min(0).nullable().optional(),
  max_admins: z.number().int().min(0).nullable().optional(),
  max_members: z.number().int().min(0).nullable().optional()
});

const membershipListSchema = rawMembershipSchema.array();

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export type OrganizationMembership = {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
  planSlug: string | null;
  planName: string | null;
  roleLimits: {
    owner: number | null;
    admin: number | null;
    member: number | null;
  };
};

export async function fetchUserOrganizations(
  client: SupabaseClient
): Promise<OrganizationMembership[]> {
  const { data, error } = await client.rpc('get_user_organizations');

  if (error) {
    throw error;
  }

  const parsed = membershipListSchema.safeParse(data ?? []);

  if (!parsed.success) {
    throw new Error('Réponse des organisations invalide.');
  }

  return parsed.data.map((item) => ({
    organizationId: item.id,
    organizationName: item.name,
    role: item.role,
    planSlug: item.plan_slug ?? null,
    planName: item.plan_name ?? null,
    roleLimits: {
      owner: typeof item.max_owners === 'number' ? item.max_owners : null,
      admin: typeof item.max_admins === 'number' ? item.max_admins : null,
      member: typeof item.max_members === 'number' ? item.max_members : null
    }
  }));
}

export function selectDefaultOrganization(
  memberships: OrganizationMembership[]
): OrganizationMembership | null {
  if (memberships.length === 0) {
    return null;
  }

  const ordered = [...memberships].sort((left, right) => {
    const rank = (role: OrganizationRole) => {
      switch (role) {
        case 'owner':
          return 0;
        case 'admin':
          return 1;
        default:
          return 2;
      }
    };

    const roleComparison = rank(left.role) - rank(right.role);

    if (roleComparison !== 0) {
      return roleComparison;
    }

    return left.organizationName.localeCompare(right.organizationName, 'fr', {
      sensitivity: 'base'
    });
  });

  return ordered[0] ?? null;
}

const MANAGER_ROLES: ReadonlySet<OrganizationRole> = new Set(['owner', 'admin']);

const isManageableRole = (role: OrganizationRole) => MANAGER_ROLES.has(role);

export function getManageableMemberships(
  memberships: OrganizationMembership[]
): OrganizationMembership[] {
  return memberships.filter((membership) => isManageableRole(membership.role));
}

export function getManageableOrganizationIds(memberships: OrganizationMembership[]): string[] {
  return getManageableMemberships(memberships).map((membership) => membership.organizationId);
}

export function getAccessibleOrganizationIds(memberships: OrganizationMembership[]): string[] {
  return memberships.map((membership) => membership.organizationId);
}
