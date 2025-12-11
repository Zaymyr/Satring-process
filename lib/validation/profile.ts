import { z } from 'zod';

import { onboardingStepKeySchema } from '@/lib/onboarding/steps';

export const onboardingOverlayProgressSchema = z.object({
  completedSteps: z.record(onboardingStepKeySchema, z.boolean()).default({}),
  dismissed: z.boolean().optional(),
  completionSeen: z.boolean().optional()
});

export const organizationRoleSchema = z.enum(['owner', 'admin', 'member']);

export const onboardingOverlayStateSchema = z
  .union([z.boolean(), onboardingOverlayProgressSchema])
  .nullable();

const planIdentifierSchema = z.string().min(1, 'Identifiant de plan invalide.');
const planNameSchema = z.string().min(1, 'Nom de plan invalide.');
const roleLimitValueSchema = z.number().int().min(0, 'La limite doit être positive.').nullable();

export const organizationRoleLimitsSchema = z.object({
  owner: roleLimitValueSchema,
  admin: roleLimitValueSchema,
  member: roleLimitValueSchema
});

export const profileOrganizationSchema = z.object({
  organizationId: z.string().uuid("Identifiant d'organisation invalide."),
  organizationName: z.string().min(1, "Le nom de l'organisation est requis."),
  role: organizationRoleSchema,
  planSlug: planIdentifierSchema.nullable(),
  planName: planNameSchema.nullable(),
  roleLimits: organizationRoleLimitsSchema
});

export const usernameSchema = z
  .string({ required_error: "Le nom d'utilisateur est requis." })
  .trim()
  .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères.")
  .max(30, "Le nom d'utilisateur ne peut pas dépasser 30 caractères.")
  .regex(/^[a-z0-9_]+$/i, "Utilisez uniquement des lettres, chiffres ou underscores.");

export const updateProfileInputSchema = z
  .object({
    username: usernameSchema.optional(),
    onboardingOverlayState: onboardingOverlayStateSchema.optional()
  })
  .refine((value) => value.username !== undefined || value.onboardingOverlayState !== undefined, {
    message: 'Aucun champ à mettre à jour.',
    path: ['username']
  });

export const profileResponseSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  username: usernameSchema.nullable(),
  onboardingOverlayState: onboardingOverlayStateSchema,
  organizations: profileOrganizationSchema.array()
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type OrganizationRoleLimits = z.infer<typeof organizationRoleLimitsSchema>;
export type OnboardingOverlayState = z.infer<typeof onboardingOverlayStateSchema>;
export type OnboardingOverlayProgress = z.infer<typeof onboardingOverlayProgressSchema>;
