import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.')
});

const resetSchema = z.object({
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServerClient(cookies());
  const url = new URL(request.url);
  const origin = request.headers.get('origin') ?? `${url.protocol}//${url.host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) {
    return NextResponse.json({ error: "Impossible d'envoyer l'e-mail de réinitialisation." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServerClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Session expirée. Demandez un nouveau lien de réinitialisation.' }, { status: 401 });
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return NextResponse.json({ error: "Impossible de mettre à jour le mot de passe." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
