import { z } from 'zod';

export const stepTypeValues = ['start', 'action', 'decision', 'finish'] as const;

export const stepSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: z.enum(stepTypeValues)
});

export const processPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  steps: z.array(stepSchema).min(2)
});

export const processResponseSchema = processPayloadSchema.extend({
  updatedAt: z.string().datetime().nullable()
});

export type StepType = (typeof stepTypeValues)[number];
export type ProcessStep = z.infer<typeof stepSchema>;
export type ProcessPayload = z.infer<typeof processPayloadSchema>;
export type ProcessResponse = z.infer<typeof processResponseSchema>;
