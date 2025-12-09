'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/components/providers/i18n-provider';
import { useLocale, type Locale } from '@/components/providers/locale-provider';
import { localeFlag } from '@/components/ui/locale-toggle';
import { cn } from '@/lib/utils/cn';

type LanguageSelectorModalProps = {
  isOpen: boolean;
  onLocaleSelected: (value: Locale) => void | Promise<void>;
};

export function LanguageSelectorModal({ isOpen, onLocaleSelected }: LanguageSelectorModalProps) {
  const { dictionary } = useI18n();
  const { locale: currentLocale, setLocale, isPending } = useLocale();
  const [isMounted, setIsMounted] = useState(false);
  const [inFlightLocale, setInFlightLocale] = useState<Locale | null>(null);

  const {
    title,
    description,
    helper,
    dialogAriaLabel,
    options
  } = dictionary.landing.onboarding.languageSelector;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSelect = async (value: Locale) => {
    setInFlightLocale(value);
    const success = await setLocale(value);

    if (!success) {
      setInFlightLocale(null);
      return;
    }

    try {
      await onLocaleSelected(value);
    } finally {
      setInFlightLocale(null);
    }
  };

  const optionList = useMemo(() => Object.entries(options) as [Locale, (typeof options)[Locale]][], [options]);

  if (!isMounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dialogAriaLabel}
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
    >
      <div
        id="language-selector-modal"
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl ring-1 ring-slate-900/5"
      >
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold leading-6 text-slate-900">{title}</p>
          <p className="text-sm text-slate-600">{description}</p>
          <p className="text-xs text-slate-500">{helper}</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {optionList.map(([value, option]) => {
            const isActive = value === currentLocale;
            const isOptionPending = inFlightLocale === value;
            const isDisabled = Boolean(inFlightLocale) || isPending;

            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelect(value)}
                disabled={isDisabled}
                aria-label={option.selectAriaLabel}
                className={cn(
                  'group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition',
                  'border-slate-200 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-75',
                  isActive ? 'bg-slate-900 text-white hover:border-slate-200' : 'bg-white text-slate-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <Image
                      src={localeFlag[value].src}
                      alt={option.flagAlt}
                      width={40}
                      height={40}
                      className="h-8 w-10 rounded object-cover"
                      priority
                    />
                  </span>
                  <div className="flex flex-col">
                    <span className={cn('text-sm font-semibold', isActive ? 'text-white' : 'text-slate-900')}>
                      {option.label}
                    </span>
                    <span className={cn('text-xs', isActive ? 'text-slate-100' : 'text-slate-500')}>
                      {option.description}
                    </span>
                  </div>
                </div>
                {isOptionPending || isPending ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isActive ? 'text-white' : 'text-slate-500')} />
                ) : (
                  <span
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      isActive ? 'text-slate-100' : 'text-slate-500'
                    )}
                  >
                    {isActive ? '✓' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
