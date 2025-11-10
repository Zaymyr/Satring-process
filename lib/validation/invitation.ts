import { z } from 'zod';

export const invitationRoleSchema = z.enum(['owner', 'creator', 'viewer']);

export const inviteMemberInputSchema = z.object({
  email: z.string().min(1, "L'adresse e-mail est requise.").email('Adresse e-mail invalide.'),
  role: invitationRoleSchema
});

export const inviteMemberResponseSchema = z.object({
  success: z.literal(true),
  status: z.enum(['invited', 'added', 'updated', 'already-member']),
  message: z.string().min(1)
});

export type InvitationRole = z.infer<typeof invitationRoleSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;
export type InviteMemberResponse = z.infer<typeof inviteMemberResponseSchema>;
