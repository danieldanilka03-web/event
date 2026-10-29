'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { events, users } from '@/server/db/schema';
import { requireRoleOrThrow } from '@/server/auth/guards';
import { countAdmins } from '@/server/db/queries';
import { idSchema, roleSchema, eventStatusSchema } from '@/shared/validators';
import type { ActionResult } from './auth';

export async function setUserRoleAction(
  _prev: ActionResult<null> | null,
  input: { userId: string; role: 'participant' | 'organizer' | 'admin' },
): Promise<ActionResult<null>> {
  const admin = await requireRoleOrThrow('admin');
  const idParsed = idSchema.safeParse(input.userId);
  const roleParsed = roleSchema.safeParse(input.role);
  if (!idParsed.success || !roleParsed.success) {
    return { ok: false, error: 'Некорректные данные' };
  }
  const userId = idParsed.data;
  const role = roleParsed.data;

  if (userId === admin.id && role !== 'admin') {
    return { ok: false, error: 'Нельзя понизить самого себя' };
  }
  if (role !== 'admin') {
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (target?.role === 'admin' && (await countAdmins()) <= 1) {
      return { ok: false, error: 'В системе должен остаться хотя бы один администратор' };
    }
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath('/admin/users');
  return { ok: true, data: null };
}

export async function toggleBlockAction(
  _prev: ActionResult<null> | null,
  input: { userId: string; block: boolean },
): Promise<ActionResult<null>> {
  const admin = await requireRoleOrThrow('admin');
  const idParsed = idSchema.safeParse(input.userId);
  const blockParsed = input.block;
  if (!idParsed.success || typeof blockParsed !== 'boolean') {
    return { ok: false, error: 'Некорректные данные' };
  }
  const userId = idParsed.data;
  if (userId === admin.id) {
    return { ok: false, error: 'Нельзя заблокировать самого себя' };
  }

  const [target] = await db
    .select({ role: users.role, isBlocked: users.isBlocked })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return { ok: false, error: 'Пользователь не найден' };

  if (blockParsed && target.role === 'admin' && (await countAdmins()) <= 1) {
    return { ok: false, error: 'Нельзя заблокировать единственного администратора' };
  }

  await db.update(users).set({ isBlocked: blockParsed }).where(eq(users.id, userId));
  revalidatePath('/admin/users');
  return { ok: true, data: null };
}

export async function moderateEventAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string; status: 'draft' | 'published' | 'cancelled' },
): Promise<ActionResult<null>> {
  await requireRoleOrThrow('admin');
  const idParsed = idSchema.safeParse(input.eventId);
  const statusParsed = eventStatusSchema.safeParse(input.status);
  if (!idParsed.success || !statusParsed.success) return { ok: false, error: 'Некорректные данные' };

  await db.update(events).set({ status: statusParsed.data }).where(eq(events.id, idParsed.data));
  revalidatePath('/admin/events');
  revalidatePath('/');
  return { ok: true, data: null };
}

export async function adminDeleteEventAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string },
): Promise<ActionResult<null>> {
  await requireRoleOrThrow('admin');
  const idParsed = idSchema.safeParse(input.eventId);
  if (!idParsed.success) return { ok: false, error: 'Некорректное мероприятие' };
  await db.delete(events).where(eq(events.id, idParsed.data));
  revalidatePath('/admin/events');
  revalidatePath('/');
  return { ok: true, data: null };
}

export async function updateProfileAction(
  _prev: ActionResult<null> | null,
  input: { fullName: string; phone: string },
): Promise<ActionResult<null>> {
  const user = await requireRoleOrThrow('participant', 'organizer', 'admin');
  const formData = input;
  const fullName = String(formData.fullName ?? '').trim();
  const phone = String(formData.phone ?? '').trim();
  if (fullName.length < 2) {
    return { ok: false, error: 'Проверьте заполнение полей', fieldErrors: { fullName: 'Введите ФИО' } };
  }
  await db
    .update(users)
    .set({ fullName, phone: phone.length ? phone : null })
    .where(eq(users.id, user.id));
  revalidatePath('/profile');
  return { ok: true, data: null };
}

