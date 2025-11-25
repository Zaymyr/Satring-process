'use client';

import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OrganizationMembers } from '@/components/administration/organization-members';
import type { ProfileResponse } from '@/lib/validation/profile';
import { profileOrganizationSchema } from '@/lib/validation/profile';
import {
  updateOrganizationNameInputSchema,
  type UpdateOrganizationNameInput
} from '@/lib/validation/organization';

type ProfileOrganization = ProfileResponse['organizations'][number];

type OrganizationCardProps = {
  organization: ProfileOrganization;
  roleLabel: string;
};

export function OrganizationCard({ organization, roleLabel }: OrganizationCardProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const formId = useId();

  const form = useForm<UpdateOrganizationNameInput>({
    resolver: zodResolver(updateOrganizationNameInputSchema),
    defaultValues: { name: organization.organizationName }
  });

  const mutation = useMutation({
    mutationFn: async (values: UpdateOrganizationNameInput) => {
      const response = await fetch(`/api/organizations/${organization.organizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible de mettre à jour le nom de l'organisation.";
        throw new Error(message);
      }

      return profileOrganizationSchema.parse(json);
    },
    onSuccess: (updatedOrganization) => {
      setServerError(null);
      setSuccessMessage("Nom de l’organisation mis à jour.");
      form.reset({ name: updatedOrganization.organizationName });
      queryClient.setQueryData<ProfileResponse>(['profile', 'self'], (previous) => {
        if (!previous) {
          return previous;
        }

        const nextOrganizations = previous.organizations.map((item) => (
          item.organizationId === updatedOrganization.organizationId ? updatedOrganization : item
        ));

        return { ...previous, organizations: nextOrganizations };
      });
    },
    onError: (error: unknown) => {
      setSuccessMessage(null);
      setServerError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'self'] });
    }
  });

  const isOwner = organization.role === 'owner';

  return (
    <li className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">{roleLabel}</p>
          <h3 className="text-base font-semibold text-slate-900">Organisation</h3>
        </div>
        {!isOwner ? (
          <p className="text-sm font-semibold text-slate-900">{organization.organizationName}</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setServerError(null);
              setSuccessMessage(null);
              mutation.mutate(values);
            })}
          >
            <div className="space-y-2">
              <Label htmlFor={formId}>Nom de l’organisation</Label>
              <Input
                id={formId}
                autoComplete="off"
                {...form.register('name')}
                placeholder="ex: Acme Corp"
                disabled={mutation.isPending}
              />
              {form.formState.errors.name ? (
                <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
              {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
            </div>
          </form>
        )}
      </section>

      <OrganizationMembers
        organizationId={organization.organizationId}
        organizationName={organization.organizationName}
        canManage={organization.role === 'owner'}
        planName={organization.planName}
        roleLimits={organization.roleLimits}
      />
    </li>
  );
}
