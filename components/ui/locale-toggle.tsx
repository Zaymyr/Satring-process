'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { useLocale, type Locale } from '@/components/providers/locale-provider';

export const localeFlag: Record<Locale, { src: string; alt: string }> = {
  en: { src: '/flags/gb.svg', alt: 'United Kingdom flag' },
  fr: { src: '/flags/fr.svg', alt: 'Drapeau français' }
};

export function LocaleToggle() {
  const { locale, setLocale, isPending } = useLocale();
  const { dictionary } = useI18n();

  const nextLocale: Locale = locale === 'en' ? 'fr' : 'en';

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      disabled={isPending}
      className="flex h-9 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-75"
      aria-label={`${dictionary.header.localeToggle.label}: ${dictionary.header.localeToggle.options[nextLocale]}`}
      title={dictionary.header.localeToggle.options[nextLocale]}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      ) : (
        <Image
          src={localeFlag[locale].src}
          alt={localeFlag[locale].alt}
          width={20}
          height={20}
          className="h-5 w-6 rounded-sm"
          priority
        />
      )}
      <span className="sr-only">{dictionary.header.localeToggle.options[locale]}</span>
    </button>
  );
}
