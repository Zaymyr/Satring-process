import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SettingsPanel } from '@/components/settings/settings-panel';
import { DEFAULT_LOCALE, getDictionary, type Locale } from '@/lib/i18n/dictionaries';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  const localeCookie = cookies().get('locale')?.value as Locale | undefined;
  const locale = localeCookie === 'fr' ? 'fr' : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.settings.metadata.title,
    description: dictionary.settings.metadata.description
  };
}

export default async function SettingsPage() {
  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    redirect('/sign-in');
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <SettingsPanel />
    </div>
  );
}
