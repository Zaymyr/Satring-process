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

export const stepSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: z.enum(stepTypeValues),
  departmentId: departmentIdSchema,
  roleId: roleIdSchema,
  yesTargetId: branchTargetSchema.default(null),
  noTargetId: branchTargetSchema.default(null)
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
