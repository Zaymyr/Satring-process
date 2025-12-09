'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useLocale } from './locale-provider';

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({
  locale,
  dictionary,
  children
}: {
  locale: Locale;
  dictionary?: Dictionary;
  children: ReactNode;
}) {
  const localeContext = useLocale();
  const resolvedLocale = localeContext?.locale ?? locale;

  const value = useMemo<I18nContextValue>(() => {
    const resolvedDictionary =
      dictionary && locale === resolvedLocale ? dictionary : getDictionary(resolvedLocale);

    return {
      locale: resolvedLocale,
      dictionary: resolvedDictionary
    };
  }, [dictionary, locale, resolvedLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}
