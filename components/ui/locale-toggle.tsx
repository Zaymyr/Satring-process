'use client';

import { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { useLocale, type Locale } from '@/components/providers/locale-provider';

export function LocaleToggle() {
  const { locale, setLocale, isPending } = useLocale();
  const { dictionary } = useI18n();
  const selectId = useId();

  const localeOptions: Locale[] = ['en', 'fr'];

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700" htmlFor={selectId}>
      <span className="text-slate-500">{dictionary.header.localeToggle.label}</span>
      <div className="relative">
        <select
          id={selectId}
          className="flex h-9 w-32 appearance-none items-center rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
          disabled={isPending}
        >
          {localeOptions.map((optionLocale) => (
            <option key={optionLocale} value={optionLocale}>
              {dictionary.header.localeToggle.options[optionLocale]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '▾'}
        </span>
      </div>
    </label>
  );
}
