import { z } from 'zod';

export const stepTypeValues = ['start', 'action', 'decision', 'finish'] as const;

const departmentIdSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : null),
  z.union([
    z.string().uuid('Identifiant de département invalide.'),
    z.literal(null)
  ])
);

const branchTargetSchema = z
  .string()
  .min(1)
  .optional()
  .nullable()
  .transform((value) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const draftDepartmentNameSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.union([z.string().min(1, 'Nom de département invalide.'), z.literal(null)])
);

const draftRoleNameSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.union([z.string().min(1, 'Nom de rôle invalide.'), z.literal(null)])
);

const roleIdSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.union([z.string().uuid('Identifiant de rôle invalide.'), z.literal(null)])
);

export const stepSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    type: z.enum(stepTypeValues),
    departmentId: departmentIdSchema,
    draftDepartmentName: draftDepartmentNameSchema.optional().default(null),
    roleId: roleIdSchema,
    draftRoleName: draftRoleNameSchema.optional().default(null),
    yesTargetId: branchTargetSchema.default(null),
    noTargetId: branchTargetSchema.default(null)
  })
  .superRefine((step, ctx) => {
    if (step.departmentId && step.draftDepartmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Sélectionnez un département existant ou indiquez un nom provisoire, pas les deux.',
        path: ['draftDepartmentName']
      });
    }

    if (step.roleId && step.draftRoleName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sélectionnez un rôle existant ou indiquez un nom provisoire, pas les deux.',
        path: ['draftRoleName']
      });
    }

    if (step.roleId && step.draftDepartmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Associez un rôle existant à un département enregistré, pas à un brouillon.',
        path: ['departmentId']
      });
    }

    if (step.draftRoleName && !step.departmentId && !step.draftDepartmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Créez ou sélectionnez un département avant de définir un rôle.',
        path: ['draftRoleName']
      });
    }
  });

export const processPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  steps: z.array(stepSchema).min(2)
});

export const processResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  steps: z.array(stepSchema).min(2),
  updatedAt: z.string().datetime().nullable()
});

export const processSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  updatedAt: z.string().datetime().nullable()
});

export type StepType = (typeof stepTypeValues)[number];
export type ProcessStep = z.infer<typeof stepSchema>;
export type ProcessPayload = z.infer<typeof processPayloadSchema>;
export type ProcessResponse = z.infer<typeof processResponseSchema>;
export type ProcessSummary = z.infer<typeof processSummarySchema>;
