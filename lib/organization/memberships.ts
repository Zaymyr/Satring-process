import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { organizationRoleSchema } from '@/lib/validation/profile';

const rawMembershipSchema = z.object({
  id: z.string().uuid('Identifiant d\'organisation invalide.'),
  name: z.string().min(1, "Le nom de l'organisation est requis."),
  role: organizationRoleSchema
});

const membershipListSchema = rawMembershipSchema.array();

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export type OrganizationMembership = {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
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
    role: item.role
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

export function getAccessibleOrganizationIds(memberships: OrganizationMembership[]): string[] {
  return memberships.map((membership) => membership.organizationId);
}
