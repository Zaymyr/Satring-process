import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cookies } from 'next/headers';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { createServerClient } from '@/lib/supabase/server';
import { AuthProvider } from '@/components/providers/auth-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Visualiseur de processus Mermaid',
  description: 'Modélisez vos processus et suivez vos indicateurs en toute sécurité.'
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { session }
  } = await supabase.auth.getSession();

  return (
    <html lang="fr" className={inter.variable}>
      <body className="main-shell">
        <AuthProvider initialSession={session}>
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
