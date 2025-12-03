import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { ApiError, readErrorMessage } from '@/lib/api/errors';
import { roleSchema, type Role, type RoleCreateInput, type RoleUpdateInput } from '@/lib/validation/role';

export const roleQueryKeys = {
  byDepartment: (departmentId: string | null | undefined) => ['roles', { departmentId }] as const
};

const createRole = async (input: RoleCreateInput): Promise<Role> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(input.departmentId)}/roles`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, color: input.color })
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de créer le rôle.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return roleSchema.parse(json);
};

const updateRole = async (input: RoleUpdateInput): Promise<Role> => {
  const response = await fetch(`/api/roles/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, color: input.color })
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de mettre à jour le rôle.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return roleSchema.parse(json);
};

const deleteRole = async (roleId: string): Promise<void> => {
  const response = await fetch(`/api/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (response.status === 204) {
    return;
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de supprimer le rôle.');
    throw new ApiError(message, response.status);
  }
};

export const useRoles = () => {
  const queryClient = useQueryClient();

  const invalidateRoles = useCallback(
    (departmentId?: string | null) =>
      queryClient.invalidateQueries({ queryKey: roleQueryKeys.byDepartment(departmentId ?? null) }),
    [queryClient]
  );

  return { invalidateRoles };
};

export { createRole, deleteRole, updateRole };
