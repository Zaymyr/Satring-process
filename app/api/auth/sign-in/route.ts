import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServerClient(cookies());
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    const message =
      error.message === 'Invalid login credentials'
        ? 'Wrong password. Please try again.'
        : error.message;

    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
