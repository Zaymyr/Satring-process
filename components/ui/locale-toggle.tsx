'use client';

import { Loader2 } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { useLocale, type Locale } from '@/components/providers/locale-provider';

const localeFlag: Record<Locale, string> = {
  en: '🇬🇧',
  fr: '🇫🇷'
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
      {isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <span aria-hidden>{localeFlag[locale]}</span>}
      <span className="sr-only">{dictionary.header.localeToggle.options[locale]}</span>
    </button>
  );
}
