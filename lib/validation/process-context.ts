import { z } from 'zod';

import { departmentColorSchema, departmentNameSchema } from './department';
import { processPayloadSchema } from './process';
import { DEFAULT_ROLE_COLOR, roleColorSchema, roleNameSchema } from './role';

const processMetadataSchema = z.object({
  id: z.string().uuid('Identifiant de process invalide.'),
  title: processPayloadSchema.shape.title
});

const roleDefinitionSchema = z.object({
  id: z.string().uuid('Identifiant de rôle invalide.').optional(),
  name: roleNameSchema,
  color: roleColorSchema.default(DEFAULT_ROLE_COLOR)
});

const departmentDefinitionSchema = z.object({
  id: z.string().uuid('Identifiant de département invalide.').optional(),
  name: departmentNameSchema,
  color: departmentColorSchema,
  roles: z.array(roleDefinitionSchema).default([])
});

export const processContextUpdateSchema = z.object({
  process: processMetadataSchema,
  steps: processPayloadSchema.shape.steps,
  departments: z.array(departmentDefinitionSchema).default([])
});

export type ProcessContextUpdate = z.infer<typeof processContextUpdateSchema>;
export type DepartmentDefinition = z.infer<typeof departmentDefinitionSchema>;
export type RoleDefinition = z.infer<typeof roleDefinitionSchema>;
