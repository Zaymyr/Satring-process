import { jsonb, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import type { ProcessStep } from '@/lib/validation/process';

export const processSnapshots = pgTable(
  'process_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    title: text('title').notNull(),
    steps: jsonb('steps').$type<ProcessStep[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerUnique: uniqueIndex('process_snapshots_owner_id_key').on(table.ownerId)
  })
);

export type ProcessSnapshot = typeof processSnapshots.$inferSelect;
export type NewProcessSnapshot = typeof processSnapshots.$inferInsert;
