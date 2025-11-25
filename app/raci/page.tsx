import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { RaciBuilder } from '@/components/raci/raci-builder';
import { DEFAULT_LOCALE, getDictionary, type Locale } from '@/lib/i18n/dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const localeCookie = cookies().get('locale')?.value as Locale | undefined;
  const locale = localeCookie === 'fr' ? 'fr' : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.raci.metadata.title,
    description: dictionary.raci.metadata.description
  };
}

export default function RaciPage() {
  return <RaciBuilder />;
}
