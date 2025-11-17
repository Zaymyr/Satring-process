'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { OrganizationCard } from '@/components/administration/organization-card';
import { OrganizationInvitations } from '@/components/administration/organization-invitations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProfileResponse, UpdateProfileInput } from '@/lib/validation/profile';
import { profileResponseSchema, updateProfileInputSchema } from '@/lib/validation/profile';
import { cn } from '@/lib/utils/cn';

type AdministrationPanelProps = {
  initialProfile: ProfileResponse;
};

const ROLE_LABELS: Record<ProfileResponse['organizations'][number]['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre'
};

export function AdministrationPanel({ initialProfile }: AdministrationPanelProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'profile' | 'organization' | 'invitations'>('profile');

  const profileQuery = useQuery({
    queryKey: ['profile', 'self'],
    queryFn: async () => {
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : 'Impossible de charger votre profil.';
        throw new Error(message);
      }

      return profileResponseSchema.parse(json);
    },
    initialData: initialProfile
  });

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileInputSchema),
    defaultValues: {
      username: initialProfile.username ?? ''
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: UpdateProfileInput) => {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible de mettre à jour le nom d'utilisateur.";
        throw new Error(message);
      }

      return profileResponseSchema.parse(json);
    },
    onSuccess: (data) => {
      setServerError(null);
      setSuccessMessage('Votre nom d’utilisateur a été mis à jour.');
      form.reset({ username: data.username ?? '' });
      queryClient.setQueryData(['profile', 'self'], data);
    },
    onError: (error: unknown) => {
      setSuccessMessage(null);
      setServerError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'self'] });
    }
  });

  const profile = profileQuery.data;
  const ownerOrganizations = profile.organizations.filter((organization) => organization.role === 'owner');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Administration</h1>
        <p className="mt-2 text-sm text-slate-600">
          Personnalisez les informations affichées dans l’en-tête et consultez votre organisation actuelle.
        </p>
        {profileQuery.isError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {profileQuery.error instanceof Error
              ? profileQuery.error.message
              : 'Une erreur est survenue lors du rafraîchissement de vos données.'}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64">
          <nav className="flex flex-row gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm lg:flex-col">
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                activeSection === 'profile'
                  ? 'bg-slate-900 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
              onClick={() => setActiveSection('profile')}
              aria-current={activeSection === 'profile' ? 'page' : undefined}
            >
              <span>Informations du profil</span>
            </button>

            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                activeSection === 'organization'
                  ? 'bg-slate-900 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
              onClick={() => setActiveSection('organization')}
              aria-current={activeSection === 'organization' ? 'page' : undefined}
            >
              <span>Organisation</span>
              <span className="text-xs font-semibold">
                {profile.organizations.length}
              </span>
            </button>

            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                activeSection === 'invitations'
                  ? 'bg-slate-900 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
              onClick={() => setActiveSection('invitations')}
              aria-current={activeSection === 'invitations' ? 'page' : undefined}
            >
              <span>Invitations</span>
              <span className="text-xs font-semibold">
                {ownerOrganizations.length}
              </span>
            </button>
          </nav>
        </aside>

        <section className="flex-1">
          {activeSection === 'profile' ? (
            <Card className="border-slate-200 bg-white text-slate-900">
              <CardHeader>
                <CardTitle>Informations du profil</CardTitle>
                <CardDescription className="text-slate-500">
                  Votre e-mail reste privé, mais vous pouvez choisir un nom public pour l’application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input id="email" value={profile.email} readOnly className="bg-slate-100" />
                </div>

                <form
                  className="space-y-4"
                  onSubmit={form.handleSubmit((values) => {
                    setServerError(null);
                    setSuccessMessage(null);
                    mutation.mutate(values);
                  })}
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">Nom d’utilisateur</Label>
                    <Input
                      id="username"
                      autoComplete="off"
                      {...form.register('username')}
                      placeholder="ex: jeanne_dupont"
                      disabled={mutation.isPending}
                    />
                    <p className="text-sm text-slate-500">
                      Entre 3 et 30 caractères. Utilisez uniquement des lettres, chiffres ou underscores.
                    </p>
                    {form.formState.errors.username ? (
                      <p className="text-sm text-red-600">{form.formState.errors.username.message}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending ? 'Enregistrement…' : 'Enregistrer' }
                    </Button>
                    {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
                    {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : activeSection === 'organization' ? (
            <Card className="border-slate-200 bg-white text-slate-900">
              <CardHeader>
                <CardTitle>Organisation</CardTitle>
                <CardDescription className="text-slate-500">
                  Vous appartenez actuellement aux organisations suivantes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile.organizations.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Aucune organisation n’est liée à votre compte pour le moment.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {profile.organizations.map((organization) => (
                      <OrganizationCard
                        key={organization.organizationId}
                        organization={organization}
                        roleLabel={ROLE_LABELS[organization.role]}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 bg-white text-slate-900">
              <CardHeader>
                <CardTitle>Invitations</CardTitle>
                <CardDescription className="text-slate-500">
                  Invitez de nouveaux membres et suivez les invitations en attente ou acceptées.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ownerOrganizations.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Vous devez être propriétaire d’une organisation pour envoyer des invitations.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {ownerOrganizations.map((organization) => (
                      <OrganizationInvitations key={organization.organizationId} organization={organization} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
