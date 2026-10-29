'use server';

import { revalidatePath } from 'next/cache';
import { requireUser, requireRoleOrThrow } from '@/server/auth/guards';
import {
  claimWaitlistSpot,
  dispatchWaitlistOfferWithClient,
  joinWaitlist,
  leaveWaitlist,
  rejectWaitlistSpot,
  WaitlistError,
} from '@/server/db/waitlist';
import { db, getPool } from '@/server/db';
import { waitlist, events } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { idSchema } from '@/shared/validators';
import type { ActionResult } from './auth';

/** Встать в лист ожидания мероприятия. */
export async function joinWaitlistAction(
  _prev: ActionResult<{ position: number }> | null,
  input: { eventId: string },
): Promise<ActionResult<{ position: number }>> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(input.eventId);
  if (!parsedId.success) return { ok: false, error: 'Некорректное мероприятие' };
  const eventId = parsedId.data;

  try {
    const result = await joinWaitlist(eventId, user.id);
    revalidatePath(`/events/${eventId}`);
    revalidatePath('/my-tickets');
    return { ok: true, data: { position: result.position } };
  } catch (e) {
    if (e instanceof WaitlistError) return { ok: false, error: e.message };
    console.error('joinWaitlist failed', e);
    return { ok: false, error: 'Не удалось встать в лист ожидания. Попробуйте ещё раз.' };
  }
}

/** Покинуть лист ожидания. */
export async function leaveWaitlistAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string },
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(input.eventId);
  if (!parsedId.success) return { ok: false, error: 'Некорректное мероприятие' };
  const eventId = parsedId.data;

  try {
    await leaveWaitlist(eventId, user.id);
    revalidatePath(`/events/${eventId}`);
    revalidatePath('/my-tickets');
    return { ok: true, data: null };
  } catch (e) {
    console.error('leaveWaitlist failed', e);
    return { ok: false, error: 'Не удалось выйти из очереди.' };
  }
}

/** Оформить билет по предложенному месту из листа ожидания. */
export async function claimWaitlistSpotAction(
  _prev: ActionResult<{ registrationId: string }> | null,
  input: { eventId: string; waitlistId: string },
): Promise<ActionResult<{ registrationId: string }>> {
  const user = await requireUser();
  const evParsed = idSchema.safeParse(input.eventId);
  const wlParsed = idSchema.safeParse(input.waitlistId);
  if (!evParsed.success || !wlParsed.success) {
    return { ok: false, error: 'Некорректные параметры' };
  }

  try {
    const result = await claimWaitlistSpot(evParsed.data, user.id, wlParsed.data);
    revalidatePath(`/events/${evParsed.data}`);
    revalidatePath('/my-tickets');
    return { ok: true, data: result };
  } catch (e) {
    if (e instanceof WaitlistError) return { ok: false, error: e.message };
    console.error('claimWaitlistSpot failed', e);
    return { ok: false, error: 'Не удалось оформить билет. Возможно, время предложения истекло.' };
  }
}

/** Отказаться от предложенного места. */
export async function rejectWaitlistSpotAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string; waitlistId: string },
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const evParsed = idSchema.safeParse(input.eventId);
  const wlParsed = idSchema.safeParse(input.waitlistId);
  if (!evParsed.success || !wlParsed.success) {
    return { ok: false, error: 'Некорректные параметры' };
  }

  try {
    await rejectWaitlistSpot(evParsed.data, user.id, wlParsed.data);
    revalidatePath(`/events/${evParsed.data}`);
    revalidatePath('/my-tickets');
    return { ok: true, data: null };
  } catch (e) {
    console.error('rejectWaitlistSpot failed', e);
    return { ok: false, error: 'Не удалось отказаться от места.' };
  }
}

/** Действие организатора: вручную продвинуть очередь (предложить место следующему). */
export async function manualDispatchWaitlistAction(
  _prev: ActionResult<{ dispatched: boolean }> | null,
  input: { eventId: string },
): Promise<ActionResult<{ dispatched: boolean }>> {
  const user = await requireRoleOrThrow('organizer', 'admin');
  const evParsed = idSchema.safeParse(input.eventId);
  if (!evParsed.success) return { ok: false, error: 'Некорректное мероприятие' };

  // Проверяем права организатора на это мероприятие
  const [event] = await db.select().from(events).where(eq(events.id, evParsed.data)).limit(1);
  if (!event) return { ok: false, error: 'Мероприятие не найдено' };
  if (user.role !== 'admin' && event.organizerId !== user.id) {
    return { ok: false, error: 'Нет доступа к этому мероприятию' };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await dispatchWaitlistOfferWithClient(client, evParsed.data, null);
    await client.query('COMMIT');

    revalidatePath(`/organizer/events/${evParsed.data}/waitlist`);
    revalidatePath(`/events/${evParsed.data}`);
    return { ok: true, data: { dispatched: res.dispatched } };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('manualDispatchWaitlistAction failed', e);
    return { ok: false, error: 'Не удалось продвинуть очередь.' };
  } finally {
    client.release();
  }
}

/** Действие организатора: изменить приоритет участника в очереди. */
export async function updateWaitlistPriorityAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string; waitlistId: string; priority: number },
): Promise<ActionResult<null>> {
  const user = await requireRoleOrThrow('organizer', 'admin');
  const evParsed = idSchema.safeParse(input.eventId);
  const wlParsed = idSchema.safeParse(input.waitlistId);
  if (!evParsed.success || !wlParsed.success) return { ok: false, error: 'Некорректные параметры' };

  const [event] = await db.select().from(events).where(eq(events.id, evParsed.data)).limit(1);
  if (!event || (user.role !== 'admin' && event.organizerId !== user.id)) {
    return { ok: false, error: 'Нет доступа' };
  }

  await db
    .update(waitlist)
    .set({ priority: input.priority })
    .where(eq(waitlist.id, wlParsed.data));

  revalidatePath(`/organizer/events/${evParsed.data}/waitlist`);
  return { ok: true, data: null };
}

/** Действие организатора: удалить участника из очереди. */
export async function removeWaitlistEntryAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string; waitlistId: string },
): Promise<ActionResult<null>> {
  const user = await requireRoleOrThrow('organizer', 'admin');
  const evParsed = idSchema.safeParse(input.eventId);
  const wlParsed = idSchema.safeParse(input.waitlistId);
  if (!evParsed.success || !wlParsed.success) return { ok: false, error: 'Некорректные параметры' };

  const [event] = await db.select().from(events).where(eq(events.id, evParsed.data)).limit(1);
  if (!event || (user.role !== 'admin' && event.organizerId !== user.id)) {
    return { ok: false, error: 'Нет доступа' };
  }

  await db
    .update(waitlist)
    .set({ status: 'cancelled' })
    .where(eq(waitlist.id, wlParsed.data));

  revalidatePath(`/organizer/events/${evParsed.data}/waitlist`);
  return { ok: true, data: null };
}
