'use client';

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';

const supportedLocales = ['en', 'fr'] as const;
export type Locale = (typeof supportedLocales)[number];

const LocaleSchema = z.object({
  locale: z.enum(supportedLocales)
});

type LocaleContextValue = {
  locale: Locale;
  setLocale: (value: Locale) => Promise<void>;
  isPending: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = useCallback(
    async (value: Locale) => {
      if (value === locale) {
        return;
      }

      setLocaleState(value);

      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ locale: value })
      });

      if (!response.ok) {
        setLocaleState(locale);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    },
    [locale, router]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      isPending
    }),
    [isPending, locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }

  return context;
}

export function parseLocale(input: unknown): Locale | null {
  const validationResult = LocaleSchema.safeParse(input);

  if (!validationResult.success) {
    return null;
  }

  return validationResult.data.locale;
}
