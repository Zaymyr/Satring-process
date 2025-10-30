'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  departmentListSchema,
  departmentNameSchema,
  departmentSchema,
  type Department
} from '@/lib/validation/department';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const departmentFormSchema = z.object({
  name: departmentNameSchema
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload.error === 'string') {
      return payload.error;
    }
    if (payload && payload.details && typeof payload.details === 'object') {
      const details = payload.details as Record<string, unknown>;
      const nameErrors = details?.name;
      if (Array.isArray(nameErrors) && typeof nameErrors[0] === 'string') {
        return nameErrors[0];
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return fallback;
};

const requestDepartments = async (): Promise<Department[]> => {
  const response = await fetch('/api/departments', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de récupérer les départements.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentListSchema.parse(json);
};

const createDepartmentRequest = async (values: DepartmentFormValues): Promise<Department> => {
  const response = await fetch('/api/departments', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values)
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

const updateDepartmentRequest = async (
  departmentId: string,
  values: DepartmentFormValues
): Promise<Department> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(departmentId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values)
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de mettre à jour le département.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentSchema.parse(json);
};

const deleteDepartmentRequest = async (departmentId: string): Promise<void> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(departmentId)}`, {
    method: 'DELETE',
    credentials: 'include',
    cache: 'no-store'
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

type EditDepartmentFormProps = {
  department: Department;
  onSubmit: (values: DepartmentFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

const EditDepartmentForm = ({
  department,
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage
}: EditDepartmentFormProps) => {
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: department.name }
  });

  useEffect(() => {
    form.reset({ name: department.name });
  }, [department.name, form]);

  useEffect(() => {
    form.setFocus('name');
  }, [form]);

  const submitHandler = form.handleSubmit(onSubmit);

  return (
    <form onSubmit={submitHandler} className="flex flex-col gap-2">
      <Input
        {...form.register('name')}
        disabled={isSubmitting}
        aria-invalid={Boolean(form.formState.errors.name)}
      />
      {form.formState.errors.name ? (
        <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
      ) : null}
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting} className="inline-flex items-center gap-1">
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Enregistrer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Annuler
        </Button>
      </div>
    </form>
  );
};

export function DepartmentsPanel() {
  const queryClient = useQueryClient();
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const departmentsQuery = useQuery<Department[], ApiError>({
    queryKey: ['departments'],
    queryFn: requestDepartments,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const createForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: '' }
  });

  const createMutation = useMutation<Department, ApiError, DepartmentFormValues>({
    mutationFn: createDepartmentRequest,
    onSuccess: (created) => {
      queryClient.setQueryData<Department[] | undefined>(['departments'], (previous) => {
        const next = [...(previous ?? []), created];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      createForm.reset();
    }
  });

  const updateMutation = useMutation<Department, ApiError, { id: string; values: DepartmentFormValues }>({
    mutationFn: ({ id, values }) => updateDepartmentRequest(id, values),
    onSuccess: (updated) => {
      queryClient.setQueryData<Department[] | undefined>(['departments'], (previous) => {
        if (!previous) {
          return previous;
        }
        const next = previous.map((department) =>
          department.id === updated.id ? updated : department
        );
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setEditingDepartmentId(null);
    }
  });

  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: async (departmentId) => {
      await deleteDepartmentRequest(departmentId);
      return undefined;
    },
    onSuccess: (_, departmentId) => {
      queryClient.setQueryData<Department[] | undefined>(['departments'], (previous) =>
        previous?.filter((department) => department.id !== departmentId)
      );
      setPendingDeleteId(null);
    }
  });

  const isUnauthorized =
    departmentsQuery.isError &&
    departmentsQuery.error instanceof ApiError &&
    departmentsQuery.error.status === 401;

  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);

  const handleCreateSubmit = createForm.handleSubmit((values) => {
    createMutation.mutate(values);
  });

  const handleEdit = (departmentId: string) => {
    setEditingDepartmentId(departmentId);
  };

  const handleCancelEdit = () => {
    setEditingDepartmentId(null);
  };

  const handleDelete = (departmentId: string) => {
    if (deleteMutation.isPending) {
      return;
    }

    setPendingDeleteId(departmentId);

    const confirmed = window.confirm('Supprimer ce département ?');
    if (!confirmed) {
      setPendingDeleteId(null);
      return;
    }

    deleteMutation.mutate(departmentId, {
      onError: () => {
        setPendingDeleteId(null);
      }
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {isUnauthorized ? (
        <p className="text-sm text-slate-600">Connectez-vous pour gérer vos départements.</p>
      ) : (
        <>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                {...createForm.register('name')}
                placeholder="Nouveau département"
                disabled={createMutation.isPending}
                aria-invalid={Boolean(createForm.formState.errors.name)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-1"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Ajouter
              </Button>
            </div>
            {createForm.formState.errors.name ? (
              <p className="text-xs text-red-600">{createForm.formState.errors.name.message}</p>
            ) : null}
            {createMutation.isError ? (
              <p className="text-xs text-red-600">{createMutation.error.message}</p>
            ) : null}
          </form>
          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white/70 p-3">
            {departmentsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des départements…
              </div>
            ) : departmentsQuery.isError ? (
              <p className="text-sm text-red-600">{departmentsQuery.error.message}</p>
            ) : departments.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun département pour le moment.</p>
            ) : (
              <ul className="space-y-3">
                {departments.map((department) => {
                  const isEditing = editingDepartmentId === department.id;
                  const isDeleting = pendingDeleteId === department.id && deleteMutation.isPending;

                  return (
                    <li key={department.id} className="rounded-lg border border-slate-200 bg-white/90 p-3">
                      {isEditing ? (
                        <EditDepartmentForm
                          department={department}
                          onSubmit={(values) => updateMutation.mutate({ id: department.id, values })}
                          onCancel={handleCancelEdit}
                          isSubmitting={updateMutation.isPending}
                          errorMessage={
                            updateMutation.isError && department.id === editingDepartmentId
                              ? updateMutation.error.message
                              : null
                          }
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{department.name}</p>
                            <p className="text-xs text-slate-500">
                              Dernière mise à jour :{' '}
                              {new Intl.DateTimeFormat('fr-FR', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              }).format(new Date(department.updatedAt))}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(department.id)}
                              disabled={updateMutation.isPending || deleteMutation.isPending}
                              className="inline-flex items-center gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Renommer
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(department.id)}
                              disabled={isDeleting || updateMutation.isPending}
                              className="inline-flex items-center gap-1"
                            >
                              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
