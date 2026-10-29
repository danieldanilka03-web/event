import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users, type SafeUser } from '@/server/db/schema';
import { sessionCookie, verifyToken, type SessionUser } from './jwt';

export async function getSessionUserFromCookie(): Promise<SessionUser | null> {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Актуальный пользователь из БД: роль и блокировка проверяются заново на каждом запросе,
 * поэтому блокировка администратором действует немедленно.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSessionUserFromCookie();
  if (!session) return null;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      isBlocked: users.isBlocked,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!row || row.isBlocked) return null;
  return row;
}

export type { SessionUser };
