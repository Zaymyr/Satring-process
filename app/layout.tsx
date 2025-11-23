import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { HamburgerMenu } from '@/components/header/hamburger-menu';
import { createServerClient } from '@/lib/supabase/server';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { DEFAULT_LOCALE, getDictionary } from '@/lib/i18n/dictionaries';
import { Analytics } from '@vercel/analytics/react';


const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const defaultLocale = DEFAULT_LOCALE;
const defaultDictionary = getDictionary(defaultLocale);

export const metadata: Metadata = {
  title: defaultDictionary.metadata.title,
  description: defaultDictionary.metadata.description
};

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const locale = defaultLocale;
  const dictionary = getDictionary(locale);

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

  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans antialiased">
        <I18nProvider locale={locale} dictionary={dictionary}>
          <QueryProvider>
            <div className="flex h-screen flex-col overflow-hidden">
              <header className="relative z-50 w-full shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <HamburgerMenu />
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-500">
                        {user ? dictionary.header.authenticatedLabel : dictionary.header.unauthenticatedLabel}
                      </span>
                      {user ? (
                        <span className="max-w-[220px] truncate rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
                          {displayName ?? dictionary.header.profileFallback}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">{dictionary.header.guestLabel}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {user ? (
                      <form action="/api/auth/sign-out" method="post">
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          {dictionary.header.signOut}
                        </button>
                      </form>
                    ) : (
                      <>
                        <Link
                          href="/sign-up"
                          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          {dictionary.header.createAccount}
                        </Link>
                        <Link
                          href="/sign-in"
                          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          {dictionary.header.signIn}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </header>
              <main className="flex-1 overflow-hidden">{children}</main>
            </div>
          </QueryProvider>
        </I18nProvider>

        {/* Vercel Analytics */}
        <Analytics />
      </body>
    </html>
  );
}

