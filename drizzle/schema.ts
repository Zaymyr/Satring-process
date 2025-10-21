import { pgTable, text, integer, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';

export const workspaceSnapshots = pgTable(
  'workspace_snapshots',
  {
    id: text('id').primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    departmentCount: integer('department_count').default(0).notNull(),
    roleCount: integer('role_count').default(0).notNull(),
    detailCount: integer('detail_count').default(0).notNull(),
    diagramProcessCount: integer('diagram_process_count').default(0).notNull(),
    lastOrganigramUpdate: timestamp('last_organigram_update', { withTimezone: true }),
    lastDiagramUpdate: timestamp('last_diagram_update', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerKey: uniqueIndex('workspace_snapshots_owner_id_key').on(table.ownerId)
  })
);
