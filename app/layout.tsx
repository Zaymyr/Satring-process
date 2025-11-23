import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';
import { HamburgerMenu } from '@/components/header/hamburger-menu';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { LocaleToggle } from '@/components/ui/locale-toggle';
import { createServerClient } from '@/lib/supabase/server';
import { Analytics } from '@vercel/analytics/react';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const messages = {
  fr: {
    connected: 'Connecté :',
    disconnected: 'Non connecté',
    guest: 'Invité',
    signOut: 'Se déconnecter',
    signUp: 'Créer un compte',
    signIn: 'Se connecter'
  },
  en: {
    connected: 'Signed in as',
    disconnected: 'Not signed in',
    guest: 'Guest',
    signOut: 'Sign out',
    signUp: 'Create account',
    signIn: 'Sign in'
  }
} as const;

export const metadata: Metadata = {
  title: 'Satring — Process clarity made simple',
  description:
    'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
};

type SupportedLocale = keyof typeof messages;

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let displayName: string | null = null;

  if (user) {
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Erreur lors de la récupération du profil utilisateur', profileError);
    }

    displayName = profileData?.username ?? user.email ?? null;
  }

  const localeCookie = cookies().get('locale')?.value;
  const locale: SupportedLocale = localeCookie === 'en' ? 'en' : 'fr';
  const text = messages[locale];

  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans antialiased">
        <LocaleProvider initialLocale={locale}>
          <QueryProvider>
            <div className="flex h-screen flex-col overflow-hidden">
              <header className="relative z-50 w-full shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <HamburgerMenu />
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-500">
                        {user ? text.connected : text.disconnected}
                      </span>
                      {user ? (
                        <span className="max-w-[220px] truncate rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
                          {displayName ?? (locale === 'en' ? 'Profile' : 'Profil')}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">{text.guest}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <LocaleToggle />
                    {user ? (
                      <form action="/api/auth/sign-out" method="post">
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          {text.signOut}
                        </button>
                      </form>
                    ) : (
                      <>
                        <Link
                          href="/sign-up"
                          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          {text.signUp}
                        </Link>
                        <Link
                          href="/sign-in"
                          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          {text.signIn}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </header>
              <main className="flex-1 overflow-hidden">{children}</main>
            </div>
          </QueryProvider>
        </LocaleProvider>

        {/* Vercel Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
