import { z } from 'zod';

import { organizationRoleSchema } from '@/lib/validation/profile';

export const invitationRoleSchema = z.enum(['owner', 'creator', 'viewer']);

export const organizationInvitationStatusSchema = z.enum(['pending', 'accepted', 'revoked']);

export const inviteMemberInputSchema = z.object({
  email: z.string().min(1, "L'adresse e-mail est requise.").email('Adresse e-mail invalide.'),
  role: invitationRoleSchema
});

export const inviteMemberResponseSchema = z.object({
  success: z.literal(true),
  status: z.enum(['invited', 'added', 'updated', 'already-member']),
  message: z.string().min(1)
});

export const organizationInvitationSchema = z.object({
  id: z.string().uuid("Identifiant d'invitation invalide."),
  organizationId: z.string().uuid("Identifiant d'organisation invalide."),
  invitedUserId: z.string().uuid("Identifiant d'utilisateur invalide."),
  inviterId: z.string().uuid("Identifiant de l'invitant invalide.").nullable(),
  email: z.string().email('Adresse e-mail invalide.'),
  role: organizationRoleSchema,
  status: organizationInvitationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable()
});

export const organizationInvitationListResponseSchema = z.object({
  invitations: organizationInvitationSchema.array()
});

export const revokeInvitationResponseSchema = z.object({
  invitation: organizationInvitationSchema
});

export const revokeInvitationParamsSchema = z.object({
  invitationId: z.string().uuid("Identifiant d'invitation invalide."),
  organizationId: z.string().uuid("Identifiant d'organisation invalide.")
});

export type InvitationRole = z.infer<typeof invitationRoleSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;
export type InviteMemberResponse = z.infer<typeof inviteMemberResponseSchema>;
export type OrganizationInvitation = z.infer<typeof organizationInvitationSchema>;
