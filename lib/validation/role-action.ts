import { z } from 'zod';

import { roleColorSchema } from './role';

export const roleActionResponsibilityValues = ['R', 'A'] as const;

export const roleActionItemSchema = z.object({
  processId: z.string().uuid('Identifiant de process invalide.'),
  processTitle: z.string().min(1, 'Le titre du process est requis.'),
  stepId: z.string().min(1, "L'identifiant de l'étape est requis."),
  stepLabel: z.string().min(1, "Le libellé de l'étape est requis."),
  responsibility: z.enum(roleActionResponsibilityValues)
});

export const roleActionSummarySchema = z.object({
  roleId: z.string().uuid('Identifiant de rôle invalide.'),
  roleName: z.string().min(1, 'Le nom du rôle est requis.'),
  departmentId: z.string().uuid('Identifiant de département invalide.'),
  departmentName: z.string().min(1, 'Le nom du département est requis.'),
  roleColor: roleColorSchema,
  actions: z.array(roleActionItemSchema)
});

export const roleActionSummaryListSchema = roleActionSummarySchema.array();

export type RoleActionItem = z.infer<typeof roleActionItemSchema>;
export type RoleActionSummary = z.infer<typeof roleActionSummarySchema>;
