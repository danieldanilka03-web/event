import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './session';
import type { SafeUser } from '@/server/db/schema';

export type Role = 'participant' | 'organizer' | 'admin';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SafeUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/');
  return user;
}

/** Вариант для Server Actions и Route Handlers: бросает ошибку вместо redirect. */
export async function requireUserOrThrow(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Требуется вход в систему');
  return user;
}

/** Вариант для Server Actions и Route Handlers: бросает ошибку вместо redirect. */
export async function requireRoleOrThrow(...roles: Role[]): Promise<SafeUser> {
  const user = await requireUserOrThrow();
  if (!roles.includes(user.role)) throw new AuthError('Недостаточно прав для этого действия');
  return user;
}
