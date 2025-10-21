'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { workspaceSnapshotSchema, updateWorkspaceSnapshotSchema, type WorkspaceSnapshot } from '@/lib/schemas/workspace-snapshot';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const updateSchema = updateWorkspaceSnapshotSchema.pick({
  departmentCount: true,
  roleCount: true,
  detailCount: true,
  diagramProcessCount: true
});

type UpdateSchema = z.infer<typeof updateSchema>;

const fetchSnapshot = async (): Promise<WorkspaceSnapshot> => {
  const response = await fetch('/api/workspace-snapshot', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Impossible de charger les métriques');
  }
  const json = await response.json();
  return workspaceSnapshotSchema.parse(json);
};

export function WorkspaceMetrics() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['workspace-snapshot'],
    queryFn: fetchSnapshot
  });

  const form = useForm<UpdateSchema>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      departmentCount: 0,
      roleCount: 0,
      detailCount: 0,
      diagramProcessCount: 0
    }
  });

  useEffect(() => {
    if (data) {
      form.reset({
        departmentCount: data.departmentCount,
        roleCount: data.roleCount,
        detailCount: data.detailCount,
        diagramProcessCount: data.diagramProcessCount
      });
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: async (payload: UpdateSchema) => {
      const response = await fetch('/api/workspace-snapshot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? 'Mise à jour impossible');
      }
      const json = await response.json();
      return workspaceSnapshotSchema.parse(json);
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(['workspace-snapshot'], snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-snapshot'] });
    }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
  });

  if (isLoading) {
    return <p className="text-sm text-slate-600">Chargement des métriques…</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500">{(error as Error).message}</p>;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-10">
      <section className="metric-grid">
        <MetricCard label="Départements suivis" value={data.departmentCount} />
        <MetricCard label="Rôles documentés" value={data.roleCount} />
        <MetricCard label="Fiches enrichies" value={data.detailCount} />
        <MetricCard label="Étapes du processus" value={data.diagramProcessCount} />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Mise à jour des indicateurs</CardTitle>
          <CardDescription>Synchronisez vos compteurs depuis vos ateliers ou vos exports externes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Field name="departmentCount" label="Départements" register={form.register} error={form.formState.errors.departmentCount?.message} />
            <Field name="roleCount" label="Rôles" register={form.register} error={form.formState.errors.roleCount?.message} />
            <Field name="detailCount" label="Fiches détaillées" register={form.register} error={form.formState.errors.detailCount?.message} />
            <Field
              name="diagramProcessCount"
              label="Étapes Mermaid"
              register={form.register}
              error={form.formState.errors.diagramProcessCount?.message}
            />
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes contextuelles</Label>
              <Textarea id="notes" placeholder="Décrivez les évolutions depuis la dernière réunion" className="mt-2" />
              <p className="mt-2 text-xs text-slate-500">Ces notes restent locales pour guider votre équipe.</p>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Synchronisation…' : 'Enregistrer les métriques'}
              </Button>
            </div>
            {mutation.isError && <p className="md:col-span-2 text-sm text-red-500">{(mutation.error as Error).message}</p>}
            {mutation.isSuccess && <p className="md:col-span-2 text-sm text-emerald-600">Métriques mises à jour avec succès.</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <span className="metric-card__label">{label}</span>
      <p className="metric-card__value">{value}</p>
    </div>
  );
}

interface FieldProps {
  name: keyof UpdateSchema;
  label: string;
  register: UseFormRegister<UpdateSchema>;
  error?: string;
}

function Field({ name, label, register, error }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type="number" min={0} {...register(name, { valueAsNumber: true })} />
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}
