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
  _prev: ActionResult<{ registrationId: string }> | null,
  input: { eventId: string; seatId?: string | null },
): Promise<ActionResult<{ registrationId: string }>> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(input.eventId);
  if (!parsedId.success) {
    return { ok: false, error: 'Некорректное мероприятие' };
  }
  const eventId = parsedId.data;
  const seatId = input.seatId ?? null;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query<{
      id: string;
      status: string;
      start_date: Date;
      layout_rows: number | null;
    }>('SELECT id, status, start_date, layout_rows FROM events WHERE id = $1 FOR UPDATE', [
      eventId,
    ]);
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

    // Повторную запись отсекаем до занятия места, иначе пользователь получил бы
    // «Свободных мест нет» вместо понятного «Вы уже зарегистрированы».
    const dupRes = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, user.id],
    );
    const duplicate = dupRes.rows[0];
    if (duplicate?.status === 'active') {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Вы уже зарегистрированы' };
    }

    // Мероприятие с фиксированной рассадкой требует выбранного кресла.
    if (event.layout_rows !== null && !seatId) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Выберите место в зале' };
    }

    if (seatId) {
      // Кресло должно принадлежать мероприятию, быть свободным и быть
      // забронировано именно этим пользователем.
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
        [seatId, eventId, user.id],
      );
      if (seatRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          error: 'Бронь места истекла или место занято. Выберите другое место.',
        };
      }
    }

    // Атомарное занятие места.
    const seatCountRes = await client.query<{ id: string }>(
      `UPDATE events SET occupied_seats = occupied_seats + 1
       WHERE id = $1 AND status = 'published' AND occupied_seats < max_seats
       RETURNING id`,
      [eventId],
    );
    if (seatCountRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Свободных мест нет' };
    }

    // Возобновление ранее отменённой записи (новая строка нарушила бы UNIQUE).
    if (duplicate) {
      const upd = await client.query<{ id: string }>(
        `UPDATE registrations SET status = 'active', seat_id = $2, created_at = now()
         WHERE id = $1 RETURNING id`,
        [duplicate.id, seatId],
      );
      if (seatId) {
        await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [seatId]);
      }
      await client.query('COMMIT');

      revalidatePath(`/events/${eventId}`);
      revalidatePath('/my-tickets');
      return { ok: true, data: { registrationId: upd.rows[0].id } };
    }

    const ins = await client.query<{ id: string }>(
      `INSERT INTO registrations (event_id, user_id, seat_id) VALUES ($1, $2, $3) RETURNING id`,
      [eventId, user.id, seatId],
    );

    // Бронь обслужила своё назначение — освобождаем кресло.
    if (seatId) {
      await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [seatId]);
    }

    await client.query('COMMIT');

    revalidatePath(`/events/${eventId}`);
    revalidatePath('/my-tickets');
    return { ok: true, data: { registrationId: ins.rows[0].id } };
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

/** Досрочно снимает бронь (кнопка «Отпустить место»). */
export async function releaseHoldAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string },
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const eventId = idSchema.safeParse(input.eventId);
  if (!eventId.success) return { ok: false, error: 'Некорректное мероприятие' };

  await releaseHold(eventId.data, user.id);
  revalidatePath(`/events/${eventId.data}`);
  return { ok: true, data: null };
}
