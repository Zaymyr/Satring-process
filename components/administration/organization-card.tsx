'use client';

import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProfileResponse } from '@/lib/validation/profile';
import { profileOrganizationSchema } from '@/lib/validation/profile';
import {
  updateOrganizationNameInputSchema,
  type UpdateOrganizationNameInput
} from '@/lib/validation/organization';
import {
  inviteMemberInputSchema,
  inviteMemberResponseSchema,
  type InviteMemberInput
} from '@/lib/validation/invitation';

type ProfileOrganization = ProfileResponse['organizations'][number];

type OrganizationCardProps = {
  organization: ProfileOrganization;
  roleLabel: string;
};

export function OrganizationCard({ organization, roleLabel }: OrganizationCardProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteServerError, setInviteServerError] = useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const formId = useId();
  const inviteEmailId = useId();
  const inviteRoleId = useId();

  const form = useForm<UpdateOrganizationNameInput>({
    resolver: zodResolver(updateOrganizationNameInputSchema),
    defaultValues: { name: organization.organizationName }
  });

  const inviteForm = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberInputSchema),
    defaultValues: { email: '', role: 'viewer' }
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

  const inviteMutation = useMutation({
    mutationFn: async (values: InviteMemberInput) => {
      const response = await fetch(`/api/organizations/${organization.organizationId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible d'envoyer l'invitation.";
        throw new Error(message);
      }

      return inviteMemberResponseSchema.parse(json);
    },
    onSuccess: (data, variables) => {
      setInviteServerError(null);
      setInviteSuccessMessage(data.message);
      inviteForm.reset({ email: '', role: variables.role });
    },
    onError: (error: unknown) => {
      setInviteSuccessMessage(null);
      setInviteServerError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'self'] });
    }
  });

  const isOwner = organization.role === 'owner';

  return (
    <li className="rounded-lg border border-slate-200 px-4 py-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">{roleLabel}</p>
          {!isOwner ? (
            <p className="text-sm font-semibold text-slate-900">{organization.organizationName}</p>
          ) : null}
        </div>

        {isOwner ? (
          <div className="space-y-8">
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

            <form
              className="space-y-4"
              onSubmit={inviteForm.handleSubmit((values) => {
                setInviteServerError(null);
                setInviteSuccessMessage(null);
                inviteMutation.mutate(values);
              })}
            >
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Inviter un membre</h3>
                <p className="text-sm text-slate-500">
                  Envoyez une invitation par e-mail et assignez un rôle à ce membre dans votre organisation.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={inviteEmailId}>Adresse e-mail</Label>
                <Input
                  id={inviteEmailId}
                  type="email"
                  autoComplete="off"
                  placeholder="ex: alex@example.com"
                  disabled={inviteMutation.isPending}
                  {...inviteForm.register('email')}
                />
                {inviteForm.formState.errors.email ? (
                  <p className="text-sm text-red-600">{inviteForm.formState.errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor={inviteRoleId}>Rôle dans l’organisation</Label>
                <select
                  id={inviteRoleId}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  disabled={inviteMutation.isPending}
                  {...inviteForm.register('role')}
                >
                  <option value="owner">Propriétaire</option>
                  <option value="creator">Créateur</option>
                  <option value="viewer">Lecteur</option>
                </select>
                {inviteForm.formState.errors.role ? (
                  <p className="text-sm text-red-600">{inviteForm.formState.errors.role.message}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Envoi…' : 'Envoyer l’invitation'}
                </Button>
                {inviteSuccessMessage ? <p className="text-sm text-emerald-600">{inviteSuccessMessage}</p> : null}
                {inviteServerError ? <p className="text-sm text-red-600">{inviteServerError}</p> : null}
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </li>
  );
}
