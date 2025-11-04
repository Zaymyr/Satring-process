'use client';

import { useState } from 'react';
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

  const closeMenu = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="global-navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Ouvrir la navigation</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex bg-white">
          <nav
            id="global-navigation"
            className="flex h-full w-full max-w-xs flex-col border-r border-slate-200 bg-white shadow-xl"
            aria-label="Navigation principale"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">Menu</p>
              <button
                type="button"
                onClick={closeMenu}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Fermer la navigation</span>
              </button>
            </div>
            <ul className="flex flex-col gap-1 px-4 py-4">
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
            <div className="mt-auto px-5 py-4 text-xs text-slate-500">
              <p>Générez vos matrices RACI par département en quelques clics.</p>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
