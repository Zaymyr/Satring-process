import { z } from 'zod';

import { roleListSchema, roleNameSchema, type Role } from './role';

export const DEFAULT_DEPARTMENT_COLOR = '#C7D2FE';

export const departmentNameSchema = z
  .string({ required_error: 'Le nom du département est requis.' })
  .trim()
  .min(1, 'Le nom du département doit contenir au moins un caractère.')
  .max(120, 'Le nom du département ne peut pas dépasser 120 caractères.');

export const departmentColorSchema = z
  .string({ required_error: 'La couleur du département est requise.' })
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'La couleur doit être un code hexadécimal sur 6 caractères.')
  .transform((value) => value.toUpperCase());

export const departmentSchema = z.object({
  id: z.string().uuid('Identifiant de département invalide.'),
  name: departmentNameSchema,
  color: departmentColorSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  roles: roleListSchema.optional().default([])
});

export const departmentListSchema = departmentSchema.array();

export const departmentInputSchema = z.object({
  name: departmentNameSchema,
  color: departmentColorSchema
});

export type Department = Omit<z.infer<typeof departmentSchema>, 'roles'> & { roles: Role[] };
export type DepartmentInput = z.infer<typeof departmentInputSchema>;

export const departmentCascadeFormSchema = departmentInputSchema.extend({
  roles: z
    .array(
      z.object({
        roleId: z.string().uuid('Identifiant de rôle invalide.').optional(),
        name: roleNameSchema
      })
    )
    .default([])
});

export type DepartmentCascadeForm = z.infer<typeof departmentCascadeFormSchema>;
