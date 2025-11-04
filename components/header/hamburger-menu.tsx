'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/raci', label: 'Matrices RACI' }
] satisfies Array<{ href: Route; label: string }>;

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (triggerRef.current?.contains(target) === true ||
          dropdownRef.current?.contains(target) === true)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="global-navigation"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        <span className="sr-only">{open ? 'Fermer la navigation' : 'Ouvrir la navigation'}</span>
      </button>

      {open ? (
        <div
          ref={dropdownRef}
          id="global-navigation"
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
          aria-label="Navigation principale"
        >
          <p className="px-2 pb-2 text-sm font-semibold text-slate-900">Menu</p>
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className={cn(
                      'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <span>{item.label}</span>
                    {isActive ? (
                      <span className="text-xs font-semibold uppercase tracking-wide">Actif</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <p>Générez vos matrices RACI par département en quelques clics.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
