import { z } from 'zod';

export const departmentNameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom du département doit contenir au moins un caractère.')
  .max(120, 'Le nom du département ne peut pas dépasser 120 caractères.');

export const departmentSchema = z.object({
  id: z.string().uuid(),
  name: departmentNameSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
});

export const departmentListSchema = departmentSchema.array();

export type Department = z.infer<typeof departmentSchema>;

export type DepartmentInput = z.infer<typeof departmentNameSchema>;
