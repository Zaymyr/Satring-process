import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Route } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

const routes: ReadonlyArray<{ href: Route; label: string }> = [
  { href: '/', label: 'Accueil' },
  { href: '/departments', label: 'Départements & rôles' },
  { href: '/diagram', label: 'Diagramme' }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient(cookies());
  const {
    data: { session }
  } = await supabase.auth.getSession();

  let userEmail: string | undefined;
  if (session) {
    const { data: profile } = await supabase.auth.getUser();
    userEmail = profile.user?.email ?? undefined;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:py-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Visualiseur de processus Mermaid</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Cartographiez vos flux, synchronisez vos équipes et générez un diagramme Mermaid toujours à jour.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {userEmail ? (
              <>
                <span className="text-sm text-slate-500">{userEmail}</span>
                <form action="/api/auth/sign-out" method="post">
                  <Button type="submit" variant="outline">
                    Se déconnecter
                  </Button>
                </form>
              </>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Accès invité (auth désactivée)
              </span>
            )}
          </div>
        </div>
        <nav className="border-t border-slate-200 bg-slate-50/90">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3 text-sm font-medium text-slate-600">
            {routes.map((route) => (
              <Link key={route.href} href={route.href} className="rounded-md px-3 py-1.5 transition hover:bg-white hover:text-slate-900">
                {route.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="page-container mx-auto w-full max-w-6xl">{children}</main>
    </div>
  );
}
