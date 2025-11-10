import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { ProcessStep } from '@/lib/validation/process';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    createdByIndex: index('organizations_created_by_idx').on(table.createdBy),
    createdAtIndex: index('organizations_created_at_idx').on(table.createdAt),
    updatedAtIndex: index('organizations_updated_at_idx').on(table.updatedAt)
  })
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.userId], name: 'organization_members_pkey' }),
    userIndex: index('organization_members_user_idx').on(table.userId),
    roleIndex: index('organization_members_role_idx').on(table.role),
    updatedAtIndex: index('organization_members_updated_at_idx').on(table.updatedAt)
  })
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export const processSnapshots = pgTable(
  'process_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    title: text('title').notNull().default('Étapes du processus'),
    steps: jsonb('steps').$type<ProcessStep[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIndex: index('process_snapshots_owner_id_idx').on(table.ownerId),
    organizationIndex: index('process_snapshots_organization_id_idx').on(table.organizationId),
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
    organizationId: uuid('organization_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#C7D2FE'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIndex: index('departments_owner_id_idx').on(table.ownerId),
    organizationIndex: index('departments_organization_id_idx').on(table.organizationId),
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
    organizationId: uuid('organization_id').notNull(),
    departmentId: uuid('department_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#C7D2FE'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIndex: index('roles_owner_id_idx').on(table.ownerId),
    organizationIndex: index('roles_organization_id_idx').on(table.organizationId),
    departmentIndex: index('roles_department_id_idx').on(table.departmentId),
    updatedAtIndex: index('roles_updated_at_idx').on(table.updatedAt)
  })
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export const userOnboardingStates = pgTable(
  'user_onboarding_states',
  {
    organizationId: uuid('organization_id').primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    sampleSeededAt: timestamp('sample_seeded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  }
);

export type UserOnboardingState = typeof userOnboardingStates.$inferSelect;
export type NewUserOnboardingState = typeof userOnboardingStates.$inferInsert;
