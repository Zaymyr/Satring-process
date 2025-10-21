'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

interface AuthContextValue {
  session: Session | null;
  setSession: (session: Session | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children, initialSession }: { children: React.ReactNode; initialSession: Session | null }) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const value = useMemo(() => ({ session, setSession }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
