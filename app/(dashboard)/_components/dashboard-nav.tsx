'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';

import { cn } from '@/lib/utils/cn';

type DashboardRoute = {
  href: Route;
  label: string;
};

type DashboardNavProps = {
  routes: ReadonlyArray<DashboardRoute>;
};

export function DashboardNav({ routes }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav className="border-t border-slate-200 bg-slate-50/90">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-3 text-sm font-medium text-slate-600">
        {routes.map((route) => {
          const isActive =
            pathname === route.href ||
            (route.href !== '/' && typeof pathname === 'string' && pathname.startsWith(route.href));

          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                'rounded-md px-3 py-1.5 transition hover:bg-white hover:text-slate-900',
                isActive && 'border border-slate-200 bg-white text-slate-900 shadow-sm'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {route.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
