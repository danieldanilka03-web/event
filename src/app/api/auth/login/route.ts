import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { signToken, sessionCookie } from '@/server/auth/jwt';
import { loginSchema } from '@/shared/validators';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Ожидался JSON' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Проверьте заполнение полей', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const ok = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ ok: false, error: 'Неверный email или пароль' }, { status: 401 });
  }
  if (user.isBlocked) {
    return NextResponse.json(
      { ok: false, error: 'Аккаунт заблокирован. Обратитесь к администратору.' },
      { status: 403 },
    );
  }

  const token = await signToken({ id: user.id, role: user.role });
  (await cookies()).set(sessionCookie.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionCookie.maxAge,
  });

  return NextResponse.json({ ok: true, data: { id: user.id, role: user.role } });
}
