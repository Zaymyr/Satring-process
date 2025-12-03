import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, readErrorMessage } from '@/lib/api/errors';
import {
  departmentListSchema,
  departmentSchema,
  type Department,
  type DepartmentInput
} from '@/lib/validation/department';

export const departmentQueryKeys = {
  all: ['departments'] as const
};

const fetchDepartments = async (): Promise<Department[]> => {
  const response = await fetch('/api/departments', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de lister vos départements.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentListSchema.parse(json);
};

const createDepartment = async (input: DepartmentInput): Promise<Department> => {
  const response = await fetch('/api/departments', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de créer le département.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentSchema.parse(json);
};

const deleteDepartment = async (departmentId: string): Promise<void> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(departmentId)}`, {
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
    const message = await readErrorMessage(response, 'Impossible de supprimer le département.');
    throw new ApiError(message, response.status);
  }
};

const updateDepartment = async (input: DepartmentInput & { id: string }): Promise<Department> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, color: input.color })
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, "Impossible de mettre à jour le département.");
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentSchema.parse(json);
};

export const useDepartments = () => {
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery<Department[], ApiError>({
    queryKey: departmentQueryKeys.all,
    queryFn: fetchDepartments,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const invalidateDepartments = useCallback(
    () => queryClient.invalidateQueries({ queryKey: departmentQueryKeys.all }),
    [queryClient]
  );

  const setDepartmentsCache = useCallback(
    (departments: Department[]) => queryClient.setQueryData(departmentQueryKeys.all, departments),
    [queryClient]
  );

  return { departmentsQuery, invalidateDepartments, setDepartmentsCache };
};

export { createDepartment, deleteDepartment, fetchDepartments, updateDepartment };
