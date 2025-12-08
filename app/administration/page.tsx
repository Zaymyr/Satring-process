import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { AdministrationPanel } from '@/components/administration/administration-panel';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { fetchUserOrganizations } from '@/lib/organization/memberships';
import { profileResponseSchema } from '@/lib/validation/profile';

export const metadata: Metadata = {
  title: 'Administration — PI',
  description: "Gérez les informations liées à votre compte utilisateur."
};

export default async function AdministrationPage() {
  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    redirect('/sign-in');
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('user_profiles')
    .select('username, onboarding_overlay_state')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Erreur lors de la récupération du profil pour la page administration', profileError);
    throw profileError;
  }

  let organizations = [] as Awaited<ReturnType<typeof fetchUserOrganizations>>;

  try {
    organizations = await fetchUserOrganizations(supabase);
  } catch (error) {
    console.error('Erreur lors de la récupération des organisations sur la page administration', error);
    organizations = [];
  }

  const parsed = profileResponseSchema.safeParse({
    email: user.email ?? '',
    username: profileRow?.username ?? null,
    onboardingOverlayState: profileRow?.onboarding_overlay_state ?? null,
    organizations
  });

  if (!parsed.success) {
    console.error('Données de profil invalides sur la page administration', parsed.error);
    notFound();
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <AdministrationPanel initialProfile={parsed.data} />
    </div>
  );
}
