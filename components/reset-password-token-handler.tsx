'use client';

import { useEffect, useRef } from 'react';

export function ResetPasswordTokenHandler() {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const hash = typeof window !== 'undefined' ? window.location.hash : '';

    if (!hash || !hash.includes('access_token')) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) return;

    const expiresAt = params.get('expires_at');
    const expiresIn = params.get('expires_in');
    const type = params.get('type');

    const search = new URLSearchParams();
    search.set('access_token', accessToken);
    search.set('refresh_token', refreshToken);
    search.set('next', '/reset-password');

    if (expiresAt) search.set('expires_at', expiresAt);
    if (expiresIn) search.set('expires_in', expiresIn);
    if (type) search.set('type', type);

    handledRef.current = true;
    window.location.replace(`/auth/callback?${search.toString()}`);
  }, []);

  return null;
}
