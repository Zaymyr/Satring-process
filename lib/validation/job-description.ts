import { z } from 'zod';

export const jobDescriptionSectionsSchema = z.object({
  title: z.string().min(1, 'Le titre de la fiche est requis.'),
  generalDescription: z.string().min(1, 'La description générale est requise.'),
  responsibilities: z.array(z.string().min(1, 'Responsabilité invalide.')).min(1, 'Ajoutez au moins une responsabilité.'),
  objectives: z.array(z.string().min(1, 'Objectif invalide.')).min(1, 'Ajoutez au moins un objectif.'),
  collaboration: z.array(z.string().min(1, 'Collaboration invalide.')).min(1, 'Ajoutez au moins une collaboration attendue.')
});

export const jobDescriptionSchema = z.object({
  roleId: z.string().uuid('Identifiant de rôle invalide.'),
  organizationId: z.string().uuid("Identifiant d'organisation invalide."),
  content: z.string().min(1, 'La fiche de poste générée est vide.'),
  updatedAt: z.string().datetime(),
  sections: jobDescriptionSectionsSchema
});

export const jobDescriptionResponseSchema = z.object({
  jobDescription: jobDescriptionSchema.nullable()
});

export type JobDescription = z.infer<typeof jobDescriptionSchema>;
export type JobDescriptionResponse = z.infer<typeof jobDescriptionResponseSchema>;
