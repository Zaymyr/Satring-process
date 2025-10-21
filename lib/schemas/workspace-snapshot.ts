import { z } from 'zod';

export const workspaceSnapshotSchema = z.object({
  id: z.string(),
  departmentCount: z.number().int().nonnegative(),
  roleCount: z.number().int().nonnegative(),
  detailCount: z.number().int().nonnegative(),
  diagramProcessCount: z.number().int().nonnegative(),
  lastOrganigramUpdate: z.string().datetime().nullish(),
  lastDiagramUpdate: z.string().datetime().nullish(),
  updatedAt: z.string().datetime()
});

export const updateWorkspaceSnapshotSchema = workspaceSnapshotSchema
  .pick({ departmentCount: true, roleCount: true, detailCount: true, diagramProcessCount: true })
  .partial()
  .extend({
    lastOrganigramUpdate: z.string().datetime().optional().nullable(),
    lastDiagramUpdate: z.string().datetime().optional().nullable()
  });

export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type UpdateWorkspaceSnapshotInput = z.infer<typeof updateWorkspaceSnapshotSchema>;
