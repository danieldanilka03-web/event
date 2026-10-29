'use server';

import { revalidatePath } from 'next/cache';
import { getPool } from '@/server/db';
import { requireUser } from '@/server/auth/guards';
import { HoldError, holdSeat, releaseHold } from '@/server/db/halls';
import { idSchema } from '@/shared/validators';
import type { ActionResult } from './auth';

/**
 * Регистрация на мероприятие.
 *
 * Всё выполняется в одной транзакции на пуле, поэтому параллельные заявки на
 * последнее место сериализуются. Для мероприятий с фиксированной рассадкой
 * дополнительно требуется seatId: кресло должно быть свободно и забронировано
 * текущим пользователем (бронь ещё не истекла).
 */
export async function registerForEventAction(
  _prev: ActionResult<{ registrationId: string; registrationIds?: string[] }> | null,
  input: {
    eventId: string;
    seatId?: string | null;
    seatIds?: string[] | null;
    quantity?: number;
  },
): Promise<ActionResult<{ registrationId: string; registrationIds: string[] }>> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(input.eventId);
  if (!parsedId.success) {
    return { ok: false, error: 'Некорректное мероприятие' };
  }
  const eventId = parsedId.data;

  // Нормализуем список мест
  const seatIds: string[] =
    Array.isArray(input.seatIds) && input.seatIds.length > 0
      ? input.seatIds
      : input.seatId
        ? [input.seatId]
        : [];

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query<{
      id: string;
      status: string;
      start_date: Date;
      layout_rows: number | null;
      max_seats: number;
      occupied_seats: number;
    }>(
      'SELECT id, status, start_date, layout_rows, max_seats, occupied_seats FROM events WHERE id = $1 FOR UPDATE',
      [eventId],
    );
    const event = eventRes.rows[0];
    if (!event) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Мероприятие не найдено' };
    }
    if (event.status !== 'published') {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Мероприятие недоступно для записи' };
    }
    if (new Date(event.start_date).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Мероприятие уже началось' };
    }

    // Для залов с рассадкой выбор мест обязателен
    if (event.layout_rows !== null && seatIds.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Выберите хотя бы одно место в зале' };
    }

    const count =
      event.layout_rows !== null
        ? seatIds.length
        : Math.max(1, Math.min(5, input.quantity ?? 1));

    // Проверяем наличие достаточного количества мест
    if (event.occupied_seats + count > event.max_seats) {
      await client.query('ROLLBACK');
      const freeSeats = Math.max(0, event.max_seats - event.occupied_seats);
      return {
        ok: false,
        error: `Недостаточно свободных мест (осталось: ${freeSeats})`,
      };
    }

    // Мероприятие с фиксированной рассадкой: проверяем каждое выбранное кресло
    if (seatIds.length > 0) {
      for (const sId of seatIds) {
        const seatRes = await client.query<{ id: string }>(
          `SELECT s.id FROM seats s
           WHERE s.id = $1 AND s.event_id = $2
             AND NOT EXISTS (
               SELECT 1 FROM registrations r
               WHERE r.seat_id = s.id AND r.event_id = s.event_id AND r.status = 'active'
             )
             AND EXISTS (
               SELECT 1 FROM seat_holds h
               WHERE h.seat_id = s.id AND h.user_id = $3 AND h.expires_at > now()
             )
           FOR UPDATE OF s`,
          [sId, eventId, user.id],
        );
        if (seatRes.rowCount === 0) {
          await client.query('ROLLBACK');
          return {
            ok: false,
            error: 'Бронь одного из мест истекла или место занято. Выберите места повторно.',
          };
        }
      }
    }

    // Атомарно занимаем необходимое число мест
    const seatCountRes = await client.query<{ id: string }>(
      `UPDATE events SET occupied_seats = occupied_seats + $1
       WHERE id = $2 AND status = 'published' AND occupied_seats + $1 <= max_seats
       RETURNING id`,
      [count, eventId],
    );
    if (seatCountRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Свободных мест нет' };
    }

    const createdIds: string[] = [];

    if (seatIds.length > 0) {
      for (const sId of seatIds) {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO registrations (event_id, user_id, seat_id, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING id`,
          [eventId, user.id, sId],
        );
        createdIds.push(ins.rows[0].id);
        await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [sId]);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO registrations (event_id, user_id, seat_id, status)
           VALUES ($1, $2, NULL, 'active')
           RETURNING id`,
          [eventId, user.id],
        );
        createdIds.push(ins.rows[0].id);
      }
    }

    await client.query('COMMIT');

    revalidatePath(`/events/${eventId}`);
    revalidatePath('/my-tickets');
    return {
      ok: true,
      data: {
        registrationId: createdIds[0],
        registrationIds: createdIds,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('registerForEvent failed', e);
    return { ok: false, error: 'Не удалось записаться на мероприятие. Попробуйте ещё раз.' };
  } finally {
    client.release();
  }
}

export async function cancelRegistrationAction(
  _prev: ActionResult<null> | null,
  input: { registrationId: string },
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(input.registrationId);
  if (!parsedId.success) return { ok: false, error: 'Некорректная запись' };
  const registrationId = parsedId.data;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const regRes = await client.query<{
      id: string;
      event_id: string;
      seat_id: string | null;
      status: string;
      start_date: Date;
      event_status: string;
    }>(
      `SELECT r.id, r.event_id, r.seat_id, r.status, e.start_date, e.status AS event_status
       FROM registrations r JOIN events e ON e.id = r.event_id
       WHERE r.id = $1 AND r.user_id = $2 FOR UPDATE OF r`,
      [registrationId, user.id],
    );
    const reg = regRes.rows[0];
    if (!reg) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Запись не найдена' };
    }
    if (new Date(reg.start_date).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Нельзя отменить запись на прошедшее мероприятие' };
    }
    if (reg.status === 'cancelled') {
      // Повторная отмена ничего не меняет.
      await client.query('COMMIT');
      return { ok: true, data: null };
    }

    const freedSeatId = reg.seat_id;
    await client.query(`UPDATE registrations SET status = 'cancelled', seat_id = NULL WHERE id = $1`, [registrationId]);

    // Проверяем очередь листа ожидания: если есть кандидат, бронируем освободившееся место за ним.
    // Если очередь пуста — уменьшаем occupied_seats, освобождая место для общего доступа.
    const { dispatchWaitlistOfferWithClient } = await import('@/server/db/waitlist');
    await dispatchWaitlistOfferWithClient(client, reg.event_id, freedSeatId);

    await client.query('COMMIT');
    revalidatePath('/my-tickets');
    revalidatePath(`/events/${reg.event_id}`);
    return { ok: true, data: null };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('cancelRegistration failed', e);
    return { ok: false, error: 'Не удалось отменить запись. Попробуйте ещё раз.' };
  } finally {
    client.release();
  }
}

/** Создаёт временную бронь кресла на 10 минут. */
export async function holdSeatAction(
  _prev: ActionResult<{ seatId: string; expiresAt: string }> | null,
  input: { eventId: string; seatId: string },
): Promise<ActionResult<{ seatId: string; expiresAt: string }>> {
  const user = await requireUser();
  const eventId = idSchema.safeParse(input.eventId);
  const seatId = idSchema.safeParse(input.seatId);
  if (!eventId.success || !seatId.success) return { ok: false, error: 'Некорректные данные' };

  try {
    const result = await holdSeat(eventId.data, seatId.data, user.id);
    revalidatePath(`/events/${eventId.data}`);
    return result;
  } catch (e) {
    if (e instanceof HoldError) return { ok: false, error: e.message };
    console.error('holdSeat failed', e);
    return { ok: false, error: 'Не удалось забронировать место. Попробуйте ещё раз.' };
  }
}

/** Досрочно снимает бронь (кнопка «Отпустить место» или отдельное кресло). */
export async function releaseHoldAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string; seatId?: string | null },
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const eventId = idSchema.safeParse(input.eventId);
  if (!eventId.success) return { ok: false, error: 'Некорректное мероприятие' };

  await releaseHold(eventId.data, user.id, input.seatId ?? null);
  revalidatePath(`/events/${eventId.data}`);
  return { ok: true, data: null };
}
