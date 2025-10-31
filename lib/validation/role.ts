import { z } from 'zod';

export const roleNameSchema = z
  .string({ required_error: 'Le nom du rôle est requis.' })
  .trim()
  .min(1, 'Le nom du rôle doit contenir au moins un caractère.')
  .max(120, 'Le nom du rôle ne peut pas dépasser 120 caractères.');

export const roleSchema = z.object({
  id: z.string().uuid('Identifiant de rôle invalide.'),
  departmentId: z.string().uuid('Identifiant de département invalide.'),
  name: roleNameSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
});

export const roleListSchema = roleSchema.array();

export const roleInputSchema = z.object({
  name: roleNameSchema
});

export const roleCreateSchema = z.object({
  departmentId: z.string().uuid('Identifiant de département invalide.'),
  name: roleNameSchema
});

export const roleUpdateSchema = z.object({
  id: z.string().uuid('Identifiant de rôle invalide.'),
  name: roleNameSchema
});

export type Role = z.infer<typeof roleSchema>;
export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
