import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignUpForm } from '@/components/sign-up-form';
import { DEFAULT_LOCALE, getDictionary, type Locale } from '@/lib/i18n/dictionaries';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  const localeCookie = cookies().get('locale')?.value as Locale | undefined;
  const locale = localeCookie === 'fr' ? 'fr' : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.auth.signUp.metadata.title,
    description: dictionary.auth.signUp.metadata.description
  };
}

export default async function SignUpPage() {
  const supabase = createServerClient();
  const { user } = await getServerUser(supabase);

  const localeCookie = cookies().get('locale')?.value as Locale | undefined;
  const locale = localeCookie === 'fr' ? 'fr' : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  if (user) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold text-slate-900">{dictionary.auth.signUp.heading}</h1>
          <p className="text-sm text-slate-600">{dictionary.auth.signUp.description}</p>
        </div>
        <SignUpForm />
        <div className="space-y-1 text-center text-xs text-slate-500">
          <p>
            {dictionary.auth.signUp.cta.prompt}{' '}
            <Link href="/sign-in" className="font-medium text-slate-700 hover:underline">
              {dictionary.auth.signUp.cta.action}
            </Link>
          </p>
          <p>
            <Link href="/" className="font-medium text-slate-700 hover:underline">
              {dictionary.auth.signUp.backHome}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
