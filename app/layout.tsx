import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';
import { HamburgerMenu } from '@/components/header/hamburger-menu';
import { CurrentPageTitle } from '@/components/header/current-page-title';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { LocaleToggle } from '@/components/ui/locale-toggle';
import { AuthHashTokenHandler } from '@/components/auth-hash-token-handler';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { DEFAULT_LOCALE, getDictionary, type Locale } from '@/lib/i18n/dictionaries';
import { Analytics } from '@vercel/analytics/react';


const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const defaultDictionary = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: defaultDictionary.metadata.title,
  description: defaultDictionary.metadata.description
};

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const supabase = createServerClient();
  const { user } = await getServerUser(supabase);

  const localeCookie = cookies().get('locale')?.value as Locale | undefined;
  const locale: Locale = localeCookie === 'fr' ? 'fr' : 'en';
  const dictionary = getDictionary(locale);

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
        <LocaleProvider initialLocale={locale}>
          <I18nProvider locale={locale} dictionary={dictionary}>
            <QueryProvider>
              <AuthHashTokenHandler />
              <div className="flex h-screen flex-col overflow-hidden">
                <header className="relative z-50 w-full shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur">
                  <div className="grid w-full grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-[auto,1fr,auto] sm:items-center">
                    <div className="flex items-center gap-4 sm:min-w-0">
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
                    <div className="flex justify-center">
                      <CurrentPageTitle />
                    </div>
                    <div className="flex items-center gap-3 justify-start sm:justify-end sm:justify-self-end">
                      <LocaleToggle />
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
                <main className="flex-1 overflow-y-auto">{children}</main>
              </div>
            </QueryProvider>
          </I18nProvider>
        </LocaleProvider>

        {/* Vercel Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
