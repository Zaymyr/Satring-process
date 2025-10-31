import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
    color: text('color').notNull().default('#C7D2FE'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIndex: index('departments_owner_id_idx').on(table.ownerId),
    updatedAtIndex: index('departments_updated_at_idx').on(table.updatedAt)
  })
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    departmentId: uuid('department_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIndex: index('roles_owner_id_idx').on(table.ownerId),
    departmentIndex: index('roles_department_id_idx').on(table.departmentId),
    updatedAtIndex: index('roles_updated_at_idx').on(table.updatedAt)
  })
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
