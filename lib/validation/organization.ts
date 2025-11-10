import { z } from 'zod';

export const organizationIdSchema = z
  .string({ required_error: "Identifiant d'organisation requis." })
  .uuid("Identifiant d'organisation invalide.");

export const organizationNameSchema = z
  .string({ required_error: "Le nom de l'organisation est requis." })
  .trim()
  .min(3, "Le nom de l'organisation doit contenir au moins 3 caractères.")
  .max(80, "Le nom de l'organisation ne peut pas dépasser 80 caractères.");

export const updateOrganizationNameParamsSchema = z.object({
  organizationId: organizationIdSchema
});

export const updateOrganizationNameInputSchema = z.object({
  name: organizationNameSchema
});

export type UpdateOrganizationNameInput = z.infer<typeof updateOrganizationNameInputSchema>;
export type UpdateOrganizationNameParams = z.infer<typeof updateOrganizationNameParamsSchema>;
