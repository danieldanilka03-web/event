'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { signToken, sessionCookie } from '@/server/auth/jwt';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/shared/validators';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten().fieldErrors;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value && value.length) out[key] = value[0] as string;
  }
  return out;
}

export async function registerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    phone: formData.get('phone') ?? '',
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, error: 'Проверьте заполнение полей', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const data: RegisterInput = parsed.data;
  const email = data.email.toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return { ok: false, error: 'Пользователь с таким email уже существует', fieldErrors: { email: 'Этот email уже занят' } };
  }

  // Роль при самостоятельной регистрации всегда participant.
  const passwordHash = await bcrypt.hash(data.password, 10);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      fullName: data.fullName,
      phone: data.phone && data.phone.length ? data.phone : null,
      role: 'participant',
    })
    .returning({ id: users.id, role: users.role });

  const token = await signToken({ id: user.id, role: user.role });
  (await cookies()).set(sessionCookie.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionCookie.maxAge,
  });

  return { ok: true, data: { id: user.id } };
}

export async function loginAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, error: 'Проверьте заполнение полей', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const data: LoginInput = parsed.data;
  const email = data.email.toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const invalid = { ok: false, error: 'Неверный email или пароль' } as const;
  if (!user) {
    // Сравниваем с фиктивным хешем, чтобы не различать время ответа.
    await bcrypt.compare(data.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    return invalid;
  }

  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) return invalid;

  if (user.isBlocked) {
    return { ok: false, error: 'Аккаунт заблокирован. Обратитесь к администратору.' };
  }

  const token = await signToken({ id: user.id, role: user.role });
  (await cookies()).set(sessionCookie.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionCookie.maxAge,
  });

  return { ok: true, data: { id: user.id } };
}

export async function logoutAction() {
  (await cookies()).delete(sessionCookie.name);
  redirect('/');
}
