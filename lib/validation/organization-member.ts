import { z } from 'zod';

import { organizationIdSchema } from '@/lib/validation/organization';
import { organizationRoleSchema, usernameSchema } from '@/lib/validation/profile';

export const userIdSchema = z.string({ required_error: "Identifiant d'utilisateur requis." }).uuid("Identifiant d'utilisateur invalide.");

export const organizationMemberSchema = z.object({
  userId: userIdSchema,
  email: z.string().email('Adresse e-mail invalide.'),
  username: usernameSchema.nullable(),
  role: organizationRoleSchema,
  joinedAt: z.string().datetime({ offset: true })
});

export const organizationMemberListResponseSchema = z.object({
  members: organizationMemberSchema.array()
});

export const removeOrganizationMemberParamsSchema = z.object({
  organizationId: organizationIdSchema,
  userId: userIdSchema
});

export const removeOrganizationMemberResponseSchema = z.object({
  success: z.literal(true)
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
