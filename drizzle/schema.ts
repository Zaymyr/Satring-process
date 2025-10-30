import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { ProcessStep } from '@/lib/validation/process';

export const processSnapshots = pgTable(
  'process_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    title: text('title').notNull().default('Étapes du processus'),
    steps: jsonb('steps').$type<ProcessStep[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIndex: index('process_snapshots_owner_id_idx').on(table.ownerId),
    updatedAtIndex: index('process_snapshots_updated_at_idx').on(table.updatedAt)
  })
);

export type ProcessSnapshot = typeof processSnapshots.$inferSelect;
export type NewProcessSnapshot = typeof processSnapshots.$inferInsert;

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIndex: index('departments_owner_id_idx').on(table.ownerId),
    ownerNameUnique: uniqueIndex('departments_owner_id_name_key').on(table.ownerId, table.name)
  })
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
