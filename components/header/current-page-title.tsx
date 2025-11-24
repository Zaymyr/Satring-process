'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/providers/i18n-provider';
import { NAVIGATION_LINKS } from '@/lib/navigation/nav-links';
import { cn } from '@/lib/utils/cn';

export function CurrentPageTitle({ className }: { className?: string }) {
  const pathname = usePathname();
  const { dictionary } = useI18n();

  const activeLabel = useMemo(() => {
    if (!pathname) {
      return null;
    }

    const active = NAVIGATION_LINKS.find((link) => {
      if (link.href === '/') {
        return pathname === '/';
      }

      return pathname === link.href || pathname.startsWith(`${link.href}/`);
    });

    if (!active) {
      return null;
    }

    return dictionary.header.navigation.links[active.labelKey];
  }, [pathname, dictionary.header.navigation.links]);

  if (!activeLabel) {
    return null;
  }

  return (
    <div className={cn('text-center text-sm font-semibold text-slate-900 sm:text-base', className)}>
      {activeLabel}
    </div>
  );
}
