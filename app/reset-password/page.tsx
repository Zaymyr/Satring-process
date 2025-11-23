import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { ResetPasswordForm } from '@/components/reset-password-form';
import { ResetPasswordTokenHandler } from '@/components/reset-password-token-handler';
import { DEFAULT_LOCALE, getDictionary, type Locale } from '@/lib/i18n/dictionaries';
import { createServerClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const localeCookie = cookies().get('locale')?.value as Locale | undefined;
  const locale = localeCookie === 'fr' ? 'fr' : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.auth.resetPassword.metadata.title,
    description: dictionary.auth.resetPassword.metadata.description
  };
}

export default async function ResetPasswordPage() {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const localeCookie = cookies().get('locale')?.value as Locale | undefined;
  const locale = localeCookie === 'fr' ? 'fr' : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl">
        <ResetPasswordTokenHandler />
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold text-slate-900">{dictionary.auth.resetPassword.heading}</h1>
          <p className="text-sm text-slate-600">{dictionary.auth.resetPassword.description}</p>
        </div>
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="space-y-4 text-center text-sm text-slate-600">
            <p>{dictionary.auth.resetPassword.invalidLink.title}</p>
            <p>{dictionary.auth.resetPassword.invalidLink.description}</p>
            <Link href="/sign-in" className="text-sm font-medium text-slate-700 hover:underline">
              {dictionary.auth.resetPassword.invalidLink.cta}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
