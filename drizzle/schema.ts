import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { ProcessStep } from '@/lib/validation/process';

export type OnboardingOverlayState = boolean | Record<string, unknown> | null;

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

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    maxOwners: integer('max_owners').notNull(),
    maxAdmins: integer('max_admins').notNull(),
    maxMembers: integer('max_members').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    slugIndex: uniqueIndex('subscription_plans_slug_key').on(table.slug),
    createdAtIndex: index('subscription_plans_created_at_idx').on(table.createdAt),
    updatedAtIndex: index('subscription_plans_updated_at_idx').on(table.updatedAt)
  })
);

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    nameIndex: uniqueIndex('products_name_lower_idx').on(sql`lower(${table.name})`),
    createdAtIndex: index('products_created_at_idx').on(table.createdAt),
    updatedAtIndex: index('products_updated_at_idx').on(table.updatedAt)
  })
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const organizationPlanSubscriptions = pgTable(
  'organization_plan_subscriptions',
  {
    organizationId: uuid('organization_id').primaryKey(),
    planId: uuid('plan_id').notNull(),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).defaultNow().notNull(),
    renewsAt: timestamp('renews_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    planIndex: index('organization_plan_subscriptions_plan_idx').on(table.planId),
    renewsAtIndex: index('organization_plan_subscriptions_renews_at_idx').on(table.renewsAt),
    updatedAtIndex: index('organization_plan_subscriptions_updated_at_idx').on(table.updatedAt)
  })
);

export type OrganizationPlanSubscription = typeof organizationPlanSubscriptions.$inferSelect;
export type NewOrganizationPlanSubscription = typeof organizationPlanSubscriptions.$inferInsert;

export const userProductSelections = pgTable(
  'user_product_selections',
  {
    userId: uuid('user_id').notNull(),
    productId: uuid('product_id').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.productId], name: 'user_product_selections_pkey' }),
    productIndex: index('user_product_selections_product_idx').on(table.productId),
    positionIndex: uniqueIndex('user_product_selections_position_unique').on(table.userId, table.position),
    updatedAtIndex: index('user_product_selections_updated_at_idx').on(table.updatedAt)
  })
);

export type UserProductSelection = typeof userProductSelections.$inferSelect;
export type NewUserProductSelection = typeof userProductSelections.$inferInsert;

export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    invitedUserId: uuid('invited_user_id').notNull(),
    inviterId: uuid('inviter_id'),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true })
  },
  (table) => ({
    organizationUserIndex: uniqueIndex('organization_invitations_org_user_idx').on(
      table.organizationId,
      table.invitedUserId
    ),
    organizationEmailIndex: uniqueIndex('organization_invitations_org_email_idx').on(
      table.organizationId,
      table.email
    ),
    statusIndex: index('organization_invitations_status_idx').on(table.status),
    createdAtIndex: index('organization_invitations_created_at_idx').on(table.createdAt)
  })
);

export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
export type NewOrganizationInvitation = typeof organizationInvitations.$inferInsert;

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey(),
  username: text('username').unique(),
  onboardingOverlayState: jsonb('onboarding_overlay_state').$type<OnboardingOverlayState>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

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

export const jobDescriptions = pgTable(
  'job_descriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roleId: uuid('role_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    title: text('title').notNull().default('Fiche de poste'),
    generalDescription: text('general_description').notNull().default(''),
    responsibilities: text('responsibilities').array().notNull().default([]),
    objectives: text('objectives').array().notNull().default([]),
    collaboration: text('collaboration').array().notNull().default([]),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    roleIndex: uniqueIndex('job_descriptions_role_id_idx').on(table.roleId),
    organizationIndex: index('job_descriptions_org_idx').on(table.organizationId),
    updatedAtIndex: index('job_descriptions_updated_at_idx').on(table.updatedAt)
  })
);

export type JobDescription = typeof jobDescriptions.$inferSelect;
export type NewJobDescription = typeof jobDescriptions.$inferInsert;

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
