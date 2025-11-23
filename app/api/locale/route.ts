import { NextResponse } from 'next/server';
import { z } from 'zod';

const LocaleSchema = z.object({
  locale: z.enum(['en', 'fr'])
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validationResult = LocaleSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid locale' },
      {
        status: 400
      }
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: 'locale',
    value: validationResult.data.locale,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax'
  });

  return response;
}
