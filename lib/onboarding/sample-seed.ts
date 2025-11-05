import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const seedResponseSchema = z
  .object({
    seeded: z.boolean(),
    reason: z.string().trim().min(1).optional()
  })
  .strict()
  .partial({ reason: true });

export async function ensureSampleDataSeeded(
  client: SupabaseClient
): Promise<z.infer<typeof seedResponseSchema> | null> {
  const { data, error } = await client.rpc('seed_sample_data');

  if (error) {
    throw error;
  }

  if (data === null) {
    return null;
  }

  const parsed = seedResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error('Réponse invalide lors de la préparation des données de démonstration.');
  }

  return parsed.data;
}
