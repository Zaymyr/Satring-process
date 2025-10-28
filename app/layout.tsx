import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { createServerClient } from '@/lib/supabase/server';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Satring — Process clarity made simple',
  description:
    'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
};

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans antialiased">
        <QueryProvider>
          <div className="flex min-h-screen flex-col">
            <header className="w-full border-b border-slate-200 bg-white/90 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500">
                    {user ? 'Connecté :' : 'Non connecté'}
                  </span>
                  {user ? (
                    <span className="max-w-[220px] truncate rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                      {user.email}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-600">Invité</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {user ? (
                    <form action="/api/auth/sign-out" method="post">
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Se déconnecter
                      </button>
                    </form>
                  ) : (
                    <>
                      <Link
                        href="/sign-up"
                        className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Créer un compte
                      </Link>
                      <Link
                        href="/sign-in"
                        className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Se connecter
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </header>
            <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
