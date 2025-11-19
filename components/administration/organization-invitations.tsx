'use client';

import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProfileResponse } from '@/lib/validation/profile';
import {
  inviteMemberInputSchema,
  inviteMemberResponseSchema,
  organizationInvitationListResponseSchema,
  resendInvitationResponseSchema,
  revokeInvitationResponseSchema,
  type InviteMemberInput,
  type OrganizationInvitation
} from '@/lib/validation/invitation';

type ProfileOrganization = ProfileResponse['organizations'][number];

type OrganizationInvitationsProps = {
  organization: ProfileOrganization;
};

const INVITATION_ROLE_LABELS: Record<OrganizationInvitation['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre'
};

export function OrganizationInvitations({ organization }: OrganizationInvitationsProps) {
  const queryClient = useQueryClient();
  const [inviteServerError, setInviteServerError] = useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const [revokeServerError, setRevokeServerError] = useState<string | null>(null);
  const [revokeSuccessMessage, setRevokeSuccessMessage] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [resendServerError, setResendServerError] = useState<string | null>(null);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const inviteEmailId = useId();
  const inviteRoleId = useId();
  const isOwner = organization.role === 'owner';

  const inviteForm = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberInputSchema),
    defaultValues: { email: '', role: 'viewer' }
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
      queryClient.invalidateQueries({
        queryKey: ['organization', organization.organizationId, 'invitations']
      });
    }
  });

  const invitationsQuery = useQuery({
    queryKey: ['organization', organization.organizationId, 'invitations'],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organization.organizationId}/invitations`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible de charger les invitations de l'organisation.";
        throw new Error(message);
      }

      const parsed = organizationInvitationListResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error("Réponse invalide lors de la récupération des invitations.");
      }

      return parsed.data.invitations;
    },
    enabled: isOwner
  });

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(
        `/api/organizations/${organization.organizationId}/invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: { Accept: 'application/json' }
        }
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible de révoquer cette invitation.";
        throw new Error(message);
      }

      const parsed = revokeInvitationResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error("Réponse invalide après la révocation de l'invitation.");
      }

      return parsed.data.invitation;
    },
    onMutate: (invitationId) => {
      setRevokeServerError(null);
      setRevokeSuccessMessage(null);
      setRevokingInvitationId(invitationId);
    },
    onError: (error: unknown) => {
      setRevokeSuccessMessage(null);
      setRevokeServerError(
        error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
      );
    },
    onSuccess: () => {
      setRevokeServerError(null);
      setRevokeSuccessMessage('Invitation révoquée.');
    },
    onSettled: () => {
      setRevokingInvitationId(null);
      queryClient.invalidateQueries({
        queryKey: ['organization', organization.organizationId, 'invitations']
      });
      queryClient.invalidateQueries({ queryKey: ['profile', 'self'] });
    }
  });

  const resendMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(
        `/api/organizations/${organization.organizationId}/invitations/${invitationId}`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' }
        }
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible de renvoyer cette invitation.";
        throw new Error(message);
      }

      const parsed = resendInvitationResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error("Réponse invalide après le renvoi de l'invitation.");
      }

      return parsed.data.invitation;
    },
    onMutate: (invitationId) => {
      setResendServerError(null);
      setResendSuccessMessage(null);
      setResendingInvitationId(invitationId);
    },
    onError: (error: unknown) => {
      setResendSuccessMessage(null);
      setResendServerError(
        error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
      );
    },
    onSuccess: () => {
      setResendServerError(null);
      setResendSuccessMessage('Invitation renvoyée.');
    },
    onSettled: () => {
      setResendingInvitationId(null);
      queryClient.invalidateQueries({
        queryKey: ['organization', organization.organizationId, 'invitations']
      });
      queryClient.invalidateQueries({ queryKey: ['profile', 'self'] });
    }
  });

  const invitations = (invitationsQuery.data ?? []) as OrganizationInvitation[];
  const visibleInvitations = invitations.filter((invitation) => invitation.status !== 'revoked');
  const pendingInvitations = visibleInvitations.filter((invitation) => invitation.status === 'pending');

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Date inconnue';
    }

    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isOwner) {
    return null;
  }

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Organisation</p>
        <p className="text-sm font-semibold text-slate-900">{organization.organizationName}</p>
      </div>

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

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Invitations envoyées</h3>
          <p className="text-sm text-slate-500">
            Consultez les invitations en attente ou déjà acceptées. Révoquez l’accès si nécessaire.
          </p>
        </div>

        {invitationsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Chargement des invitations…</p>
        ) : null}

        {invitationsQuery.isError ? (
          <p className="text-sm text-red-600" role="alert">
            {invitationsQuery.error instanceof Error
              ? invitationsQuery.error.message
              : "Impossible de charger les invitations pour le moment."}
          </p>
        ) : null}

        {revokeSuccessMessage ? (
          <p className="text-sm text-emerald-600">{revokeSuccessMessage}</p>
        ) : null}
        {revokeServerError ? (
          <p className="text-sm text-red-600">{revokeServerError}</p>
        ) : null}
        {resendSuccessMessage ? (
          <p className="text-sm text-emerald-600">{resendSuccessMessage}</p>
        ) : null}
        {resendServerError ? <p className="text-sm text-red-600">{resendServerError}</p> : null}

        {!invitationsQuery.isLoading && pendingInvitations.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune invitation n’a encore été envoyée pour cette organisation.
          </p>
        ) : null}

        <div className="space-y-4">
          {pendingInvitations.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                En attente
              </h4>
              <ul className="space-y-2">
                {pendingInvitations.map((invitation) => {
                  const isRevoking = revokeMutation.isPending && revokingInvitationId === invitation.id;
                  const isResending = resendMutation.isPending && resendingInvitationId === invitation.id;

                  return (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{invitation.email}</p>
                        <p className="text-xs text-slate-500">
                          {INVITATION_ROLE_LABELS[invitation.role] ?? invitation.role} • Envoyée le {formatDate(invitation.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="shrink-0"
                          onClick={() => resendMutation.mutate(invitation.id)}
                          disabled={isResending}
                        >
                          {isResending ? 'Renvoi…' : 'Renvoyer'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 text-slate-900 hover:text-white"
                          onClick={() => revokeMutation.mutate(invitation.id)}
                          disabled={isRevoking}
                        >
                          {isRevoking ? 'Révocation…' : 'Révoquer'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
