import { z } from 'zod';

export const jobDescriptionSchema = z.object({
  roleId: z.string().uuid('Identifiant de rôle invalide.'),
  organizationId: z.string().uuid("Identifiant d'organisation invalide."),
  content: z.string().min(1, 'La fiche de poste générée est vide.'),
  updatedAt: z.string().datetime()
});

export const jobDescriptionResponseSchema = z.object({
  jobDescription: jobDescriptionSchema.nullable()
});

export type JobDescription = z.infer<typeof jobDescriptionSchema>;
export type JobDescriptionResponse = z.infer<typeof jobDescriptionResponseSchema>;
