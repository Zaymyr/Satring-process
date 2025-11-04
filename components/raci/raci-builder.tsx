'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const departmentSchema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères.")
});

const roleSchema = z.object({
  roleName: z.string().min(2, 'Le rôle doit comporter au moins 2 caractères.')
});

const actionSchema = z.object({
  actionName: z.string().min(2, "L'action doit comporter au moins 2 caractères.")
});

const filledRaciValues = ['R', 'A', 'C', 'I'] as const;

const raciDefinitions: Record<(typeof filledRaciValues)[number], { short: string; description: string }> = {
  R: {
    short: 'Responsable',
    description: "Responsable de l'exécution de la tâche et rend compte de son avancement."
  },
  A: {
    short: 'Autorité',
    description: "Détient l'autorité finale pour valider ou trancher."
  },
  C: {
    short: 'Consulté',
    description: 'Doit être consulté pour apporter son expertise avant la décision.'
  },
  I: {
    short: 'Informé',
    description: "Doit être tenu informé de l'avancement et des décisions."
  }
} as const;

const raciOptions = ([
  { value: '', label: '—' } as const
].concat(
  filledRaciValues.map((value) => ({
    value,
    label: `${value} — ${raciDefinitions[value].short}`
  }))
)) as const;

type DepartmentFormValues = z.infer<typeof departmentSchema>;
type RoleFormValues = z.infer<typeof roleSchema>;
type ActionFormValues = z.infer<typeof actionSchema>;

type FilledRaciValue = (typeof filledRaciValues)[number];
type RaciValue = FilledRaciValue | '';

type Department = {
  id: string;
  name: string;
  roles: Array<{ id: string; name: string }>;
  actions: Array<{ id: string; name: string }>;
  matrix: Record<string, Record<string, RaciValue>>;
};

const createInitialDepartment = (): Department => ({
  id: crypto.randomUUID(),
  name: 'Opérations',
  roles: [
    { id: crypto.randomUUID(), name: 'Responsable de département' },
    { id: crypto.randomUUID(), name: 'Chef de projet' },
    { id: crypto.randomUUID(), name: 'Analyste qualité' }
  ],
  actions: [
    { id: crypto.randomUUID(), name: 'Définir la feuille de route' },
    { id: crypto.randomUUID(), name: 'Suivre l\'exécution' },
    { id: crypto.randomUUID(), name: 'Communiquer les résultats' }
  ],
  matrix: {}
});

const ensureMatrixCoverage = (department: Department): Department => {
  const nextMatrix: Department['matrix'] = { ...department.matrix };

  for (const action of department.actions) {
    nextMatrix[action.id] = { ...nextMatrix[action.id] };
    for (const role of department.roles) {
      if (!nextMatrix[action.id][role.id]) {
        nextMatrix[action.id][role.id] = '';
      }
    }
  }

  return { ...department, matrix: nextMatrix };
};

const buildInitialDepartment = () => ensureMatrixCoverage(createInitialDepartment());

export function RaciBuilder() {
  const initialDepartment = useMemo(() => buildInitialDepartment(), []);
  const [departments, setDepartments] = useState<Department[]>([initialDepartment]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(initialDepartment.id);

  const selectedDepartment = useMemo(
    () => departments.find((dept) => dept.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  const assignments = useMemo(() => {
    if (!selectedDepartment) {
      return [] as Array<{
        actionLabel: string;
        responsibilities: Array<{ value: FilledRaciValue; roles: string[] }>;
      }>;
    }

    return selectedDepartment.actions.map((action) => {
      const row = selectedDepartment.matrix[action.id] ?? {};
      const responsibilities = filledRaciValues.map((value) => ({
        value,
        roles: selectedDepartment.roles
          .filter((role) => row[role.id] === value)
          .map((role) => role.name)
      }));

      return {
        actionLabel: action.name,
        responsibilities
      };
    });
  }, [selectedDepartment]);

  const departmentForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '' }
  });

  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { roleName: '' }
  });

  const actionForm = useForm<ActionFormValues>({
    resolver: zodResolver(actionSchema),
    defaultValues: { actionName: '' }
  });

  const handleCreateDepartment = departmentForm.handleSubmit((values) => {
    const newDepartment = ensureMatrixCoverage({
      id: crypto.randomUUID(),
      name: values.name.trim(),
      roles: [],
      actions: [],
      matrix: {}
    });

    setDepartments((prev) => [...prev, newDepartment]);
    setSelectedDepartmentId(newDepartment.id);
    departmentForm.reset();
  });

  const handleAddRole = roleForm.handleSubmit((values) => {
    if (!selectedDepartment) return;

    const trimmedName = values.roleName.trim();
    if (!trimmedName) return;

    setDepartments((prev) =>
      prev.map((dept) => {
        if (dept.id !== selectedDepartment.id) return dept;

        const newRole = { id: crypto.randomUUID(), name: trimmedName };
        const updatedDepartment = ensureMatrixCoverage({
          ...dept,
          roles: [...dept.roles, newRole]
        });

        return updatedDepartment;
      })
    );

    roleForm.reset();
  });

  const handleAddAction = actionForm.handleSubmit((values) => {
    if (!selectedDepartment) return;

    const trimmedName = values.actionName.trim();
    if (!trimmedName) return;

    setDepartments((prev) =>
      prev.map((dept) => {
        if (dept.id !== selectedDepartment.id) return dept;

        const newAction = { id: crypto.randomUUID(), name: trimmedName };
        const updatedDepartment = ensureMatrixCoverage({
          ...dept,
          actions: [...dept.actions, newAction]
        });

        return updatedDepartment;
      })
    );

    actionForm.reset();
  });

  const updateMatrix = (departmentId: string, actionId: string, roleId: string, value: RaciValue) => {
    setDepartments((prev) =>
      prev.map((dept) => {
        if (dept.id !== departmentId) return dept;

        const nextMatrix: Department['matrix'] = { ...dept.matrix };
        nextMatrix[actionId] = { ...nextMatrix[actionId], [roleId]: value };

        return {
          ...dept,
          matrix: nextMatrix
        };
      })
    );
  };

  const handleDepartmentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value || null;
    setSelectedDepartmentId(nextId);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-10 overflow-y-auto px-6 py-10">
      <header className="space-y-3">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Matrices RACI
        </span>
        <h1 className="text-3xl font-semibold text-slate-900">Planifiez les responsabilités par département</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Construisez une matrice RACI pour chaque département : définissez vos équipes, listez les actions clés et
          assignez les rôles de Responsable, Autorité, Consulté ou Informé pour clarifier la collaboration.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <Label htmlFor="department">Département actuel</Label>
              <select
                id="department"
                value={selectedDepartmentId ?? ''}
                onChange={handleDepartmentChange}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {departments.length === 0 ? <option value="">Aucun département</option> : null}
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <form onSubmit={handleCreateDepartment} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-department">Ajouter un département</Label>
                <Input
                  id="new-department"
                  placeholder="Ex : Marketing"
                  {...departmentForm.register('name')}
                  aria-invalid={departmentForm.formState.errors.name ? 'true' : 'false'}
                />
                {departmentForm.formState.errors.name ? (
                  <p className="text-xs text-red-600">{departmentForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <Button type="submit" className="w-full">
                Créer le département
              </Button>
            </form>
          </div>

          {selectedDepartment ? (
            <div className="space-y-6 border-t border-slate-200 pt-6">
              <form onSubmit={handleAddRole} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-role">Ajouter un rôle</Label>
                  <Input
                    id="new-role"
                    placeholder="Ex : Responsable produit"
                    {...roleForm.register('roleName')}
                    aria-invalid={roleForm.formState.errors.roleName ? 'true' : 'false'}
                  />
                  {roleForm.formState.errors.roleName ? (
                    <p className="text-xs text-red-600">{roleForm.formState.errors.roleName.message}</p>
                  ) : null}
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  Ajouter le rôle
                </Button>
              </form>

              <form onSubmit={handleAddAction} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-action">Ajouter une action</Label>
                  <Input
                    id="new-action"
                    placeholder="Ex : Validation budget"
                    {...actionForm.register('actionName')}
                    aria-invalid={actionForm.formState.errors.actionName ? 'true' : 'false'}
                  />
                  {actionForm.formState.errors.actionName ? (
                    <p className="text-xs text-red-600">{actionForm.formState.errors.actionName.message}</p>
                  ) : null}
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  Ajouter l’action
                </Button>
              </form>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {selectedDepartment ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Matrice RACI — {selectedDepartment.name}</h2>
                <p className="text-sm text-slate-600">
                  Assignez un rôle pour chaque action en sélectionnant la responsabilité appropriée.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="w-56 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                      {selectedDepartment.roles.map((role) => (
                        <th
                          key={role.id}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {role.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedDepartment.actions.length === 0 ? (
                      <tr>
                        <td colSpan={selectedDepartment.roles.length + 1} className="px-6 py-6 text-center text-sm text-slate-500">
                          Ajoutez des actions pour commencer à construire votre matrice.
                        </td>
                      </tr>
                    ) : (
                      selectedDepartment.actions.map((action) => (
                        <tr key={action.id} className="bg-white hover:bg-slate-50/60">
                          <th
                            scope="row"
                            className="px-6 py-4 text-left text-sm font-medium text-slate-900"
                          >
                            {action.name}
                          </th>
                          {selectedDepartment.roles.map((role) => (
                            <td key={role.id} className="px-4 py-3 text-sm">
                              <select
                                value={selectedDepartment.matrix[action.id]?.[role.id] ?? ''}
                                onChange={(event) =>
                                  updateMatrix(selectedDepartment.id, action.id, role.id, event.target.value as RaciValue)
                                }
                                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                              >
                                {raciOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {selectedDepartment.actions.length > 0 ? (
                <div className="border-t border-slate-200 bg-white px-6 py-5">
                  <h3 className="text-sm font-semibold text-slate-900">Synthèse par action</h3>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {assignments.map(({ actionLabel, responsibilities }) => (
                      <div key={actionLabel} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">{actionLabel}</p>
                        <ul className="mt-3 space-y-2 text-xs text-slate-600">
                          {responsibilities.map(({ value, roles }) => (
                            <li key={value} className="flex items-start justify-between gap-3">
                              <span className="font-medium text-slate-800">
                                {value} — {raciDefinitions[value].short}
                              </span>
                              <span className="text-right text-slate-600">
                                {roles.length > 0 ? roles.join(', ') : 'Non attribué'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">
              <p>Sélectionnez ou créez un département pour générer sa matrice RACI.</p>
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Rappels sur la méthodologie</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {filledRaciValues.map((value) => (
                <div key={value} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-sm font-semibold text-slate-900">
                    {value} — {raciDefinitions[value].short}
                  </dt>
                  <dd className="mt-1 text-xs text-slate-600">{raciDefinitions[value].description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </section>
    </div>
  );
}
