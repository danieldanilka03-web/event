import { and, asc, count, desc, eq, gt, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { db, getPool } from '@/server/db';
import {
  events,
  registrations,
  seatHolds,
  seats,
  users,
  waitlist,
  type WaitlistRow,
  type WaitlistStatus,
} from '@/server/db/schema';

export const WAITLIST_OFFER_TTL_MINUTES = 30;

export class WaitlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistError';
  }
}

export type { WaitlistUserStatus } from '@/shared/waitlist';

/**
 * Очищает истёкшие предложения (срок выкупа 30 минут прошёл).
 * Если предложение истекло, кресло/место автоматически передаётся следующему кандидату.
 */
export async function cleanExpiredOffers(eventId: string): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const expiredRes = await client.query<{ id: string; seat_id: string | null }>(
      `UPDATE waitlist
       SET status = 'expired'
       WHERE event_id = $1 AND status = 'offered' AND expires_at <= now()
       RETURNING id, seat_id`,
      [eventId],
    );

    if (expiredRes.rows.length > 0) {
      for (const row of expiredRes.rows) {
        if (row.seat_id) {
          await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [row.seat_id]);
        }
        // Передаём освободившееся предложение следующему в очереди
        await dispatchWaitlistOfferWithClient(client, eventId, row.seat_id);
      }
    }

    return expiredRes.rowCount ?? 0;
  } finally {
    client.release();
  }
}

/**
 * Ключевой алгоритм распределения мест из листа ожидания:
 * 1. Ищет следующего кандидата в очереди FIFO с учётом приоритета (ORDER BY priority ASC, created_at ASC).
 * 2. Если кандидат найден — переводит его в статус 'offered' на 30 минут (бронирует место за ним).
 * 3. Если очередь пуста — освобождает место для общего каталога (occupied_seats = occupied_seats - 1).
 */
export async function dispatchWaitlistOfferWithClient(
  client: { query: <T = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }> },
  eventId: string,
  freedSeatId?: string | null,
): Promise<{ dispatched: boolean; candidateUserId?: string; expiresAt?: Date }> {
  // Ищем следующего ожидающего участника
  const candidateRes = await client.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM waitlist
     WHERE event_id = $1 AND status = 'waiting'
     ORDER BY priority ASC, created_at ASC
     LIMIT 1
     FOR UPDATE`,
    [eventId],
  );

  const candidate = candidateRes.rows[0];
  if (!candidate) {
    // В очереди никого нет — место освобождается для всех
    await client.query(
      `UPDATE events
       SET occupied_seats = greatest(0, occupied_seats - 1)
       WHERE id = $1 AND occupied_seats > 0`,
      [eventId],
    );
    return { dispatched: false };
  }

  const expiresAt = new Date(Date.now() + WAITLIST_OFFER_TTL_MINUTES * 60 * 1000);

  await client.query(
    `UPDATE waitlist
     SET status = 'offered', seat_id = $2, offered_at = now(), expires_at = $3
     WHERE id = $1`,
    [candidate.id, freedSeatId ?? null, expiresAt],
  );

  // Если у события фиксированная рассадка и освободилось конкретное кресло, блокируем его для предложенного
  if (freedSeatId) {
    await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [freedSeatId]);
    await client.query(
      `INSERT INTO seat_holds (seat_id, event_id, user_id, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (seat_id) DO UPDATE SET user_id = $3, expires_at = $4`,
      [freedSeatId, eventId, candidate.user_id, expiresAt],
    );
  }

  return { dispatched: true, candidateUserId: candidate.user_id, expiresAt };
}

/** Встать в лист ожидания. */
export async function joinWaitlist(
  eventId: string,
  userId: string,
): Promise<{ id: string; position: number }> {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new WaitlistError('Мероприятие не найдено');
  if (event.status !== 'published') throw new WaitlistError('Мероприятие недоступно для записи');
  if (new Date(event.startDate).getTime() <= Date.now()) {
    throw new WaitlistError('Мероприятие уже началось');
  }

  // Проверка: уже зарегистрирован
  const [reg] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, userId), eq(registrations.status, 'active')))
    .limit(1);
  if (reg) throw new WaitlistError('Вы уже зарегистрированы на это мероприятие');

  // Проверка: уже в очереди
  const [existingQueue] = await db
    .select({ id: waitlist.id, status: waitlist.status })
    .from(waitlist)
    .where(
      and(
        eq(waitlist.eventId, eventId),
        eq(waitlist.userId, userId),
        or(eq(waitlist.status, 'waiting'), eq(waitlist.status, 'offered')),
      ),
    )
    .limit(1);
  if (existingQueue) {
    throw new WaitlistError('Вы уже находитесь в листе ожидания');
  }

  // Считаем текущий размер очереди для определения позиции
  const [queueCount] = await db
    .select({ value: count() })
    .from(waitlist)
    .where(and(eq(waitlist.eventId, eventId), eq(waitlist.status, 'waiting')));
  const position = (queueCount?.value ?? 0) + 1;

  const [row] = await db
    .insert(waitlist)
    .values({
      eventId,
      userId,
      status: 'waiting',
      priority: 0,
    })
    .returning({ id: waitlist.id });

  return { id: row.id, position };
}

/** Покинуть лист ожидания. */
export async function leaveWaitlist(eventId: string, userId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const entryRes = await client.query<{ id: string; status: string; seat_id: string | null }>(
      `SELECT id, status, seat_id FROM waitlist
       WHERE event_id = $1 AND user_id = $2 AND status IN ('waiting', 'offered')
       FOR UPDATE`,
      [eventId, userId],
    );
    const entry = entryRes.rows[0];
    if (!entry) {
      await client.query('COMMIT');
      return;
    }

    await client.query(`UPDATE waitlist SET status = 'cancelled' WHERE id = $1`, [entry.id]);

    if (entry.status === 'offered') {
      if (entry.seat_id) {
        await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [entry.seat_id]);
      }
      // Место освободилось — передаём следующему участнику
      await dispatchWaitlistOfferWithClient(client, eventId, entry.seat_id);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Выкуп билета по предложению из листа ожидания (пользователь согласился). */
export async function claimWaitlistSpot(
  eventId: string,
  userId: string,
  waitlistId: string,
): Promise<{ registrationId: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const entryRes = await client.query<{
      id: string;
      seat_id: string | null;
      status: string;
      expires_at: Date;
    }>(
      `SELECT id, seat_id, status, expires_at FROM waitlist
       WHERE id = $1 AND event_id = $2 AND user_id = $3 FOR UPDATE`,
      [waitlistId, eventId, userId],
    );
    const entry = entryRes.rows[0];
    if (!entry || entry.status !== 'offered') {
      await client.query('ROLLBACK');
      throw new WaitlistError('Предложение не найдено или уже недоступно');
    }
    if (new Date(entry.expires_at).getTime() <= Date.now()) {
      await client.query(`UPDATE waitlist SET status = 'expired' WHERE id = $1`, [entry.id]);
      if (entry.seat_id) {
        await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [entry.seat_id]);
      }
      await dispatchWaitlistOfferWithClient(client, eventId, entry.seat_id);
      await client.query('COMMIT');
      throw new WaitlistError('Время действия предложения истекло. Место передано следующему участнику.');
    }

    // Проверяем наличие отменённой записи
    const dupRes = await client.query<{ id: string }>(
      'SELECT id FROM registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, userId],
    );
    let registrationId: string;
    if (dupRes.rows.length > 0) {
      const upd = await client.query<{ id: string }>(
        `UPDATE registrations SET status = 'active', seat_id = $2, created_at = now()
         WHERE id = $1 RETURNING id`,
        [dupRes.rows[0].id, entry.seat_id],
      );
      registrationId = upd.rows[0].id;
    } else {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO registrations (event_id, user_id, seat_id) VALUES ($1, $2, $3) RETURNING id`,
        [eventId, userId, entry.seat_id],
      );
      registrationId = ins.rows[0].id;
    }

    // Отмечаем выкуп в листе ожидания
    await client.query(`UPDATE waitlist SET status = 'claimed' WHERE id = $1`, [entry.id]);

    if (entry.seat_id) {
      await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [entry.seat_id]);
    }

    await client.query('COMMIT');
    return { registrationId };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Отказ от предложенного места из листа ожидания. */
export async function rejectWaitlistSpot(
  eventId: string,
  userId: string,
  waitlistId: string,
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const entryRes = await client.query<{ id: string; seat_id: string | null }>(
      `SELECT id, seat_id FROM waitlist
       WHERE id = $1 AND event_id = $2 AND user_id = $3 AND status = 'offered'
       FOR UPDATE`,
      [waitlistId, eventId, userId],
    );
    const entry = entryRes.rows[0];
    if (entry) {
      await client.query(`UPDATE waitlist SET status = 'cancelled' WHERE id = $1`, [entry.id]);
      if (entry.seat_id) {
        await client.query('DELETE FROM seat_holds WHERE seat_id = $1', [entry.seat_id]);
      }
      await dispatchWaitlistOfferWithClient(client, eventId, entry.seat_id);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Статус участия текущего пользователя в листе ожидания конкретного мероприятия. */
export async function getWaitlistStatusForUser(
  eventId: string,
  userId: string | null,
): Promise<WaitlistUserStatus> {
  // Ленивая очистка истёкших офферов
  await cleanExpiredOffers(eventId).catch(() => 0);

  const [queueCount] = await db
    .select({ value: count() })
    .from(waitlist)
    .where(and(eq(waitlist.eventId, eventId), eq(waitlist.status, 'waiting')));
  const totalWaiting = queueCount?.value ?? 0;

  if (!userId) {
    return {
      isInWaitlist: false,
      status: null,
      position: null,
      totalWaiting,
      offeredSeatId: null,
      offeredSeatLabel: null,
      expiresAt: null,
      waitlistId: null,
    };
  }

  const [myEntry] = await db
    .select({
      id: waitlist.id,
      status: waitlist.status,
      priority: waitlist.priority,
      createdAt: waitlist.createdAt,
      expiresAt: waitlist.expiresAt,
      seatId: waitlist.seatId,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
    })
    .from(waitlist)
    .leftJoin(seats, eq(seats.id, waitlist.seatId))
    .where(
      and(
        eq(waitlist.eventId, eventId),
        eq(waitlist.userId, userId),
        or(eq(waitlist.status, 'waiting'), eq(waitlist.status, 'offered')),
      ),
    )
    .limit(1);

  if (!myEntry) {
    return {
      isInWaitlist: false,
      status: null,
      position: null,
      totalWaiting,
      offeredSeatId: null,
      offeredSeatLabel: null,
      expiresAt: null,
      waitlistId: null,
    };
  }

  let position: number | null = null;
  if (myEntry.status === 'waiting') {
    const [aheadCount] = await db
      .select({ value: count() })
      .from(waitlist)
      .where(
        and(
          eq(waitlist.eventId, eventId),
          eq(waitlist.status, 'waiting'),
          or(
            lt(waitlist.priority, myEntry.priority),
            and(eq(waitlist.priority, myEntry.priority), lt(waitlist.createdAt, myEntry.createdAt)),
          ),
        ),
      );
    position = (aheadCount?.value ?? 0) + 1;
  }

  const seatLabel = myEntry.rowLabel && myEntry.seatNumber !== null
    ? `Ряд ${myEntry.rowLabel}, место ${myEntry.seatNumber}`
    : null;

  return {
    isInWaitlist: true,
    status: myEntry.status,
    position,
    totalWaiting,
    offeredSeatId: myEntry.seatId,
    offeredSeatLabel: seatLabel,
    expiresAt: myEntry.expiresAt ? myEntry.expiresAt.toISOString() : null,
    waitlistId: myEntry.id,
  };
}

/** Все активные предложения из листа ожидания для пользователя (для показа уведомления в ЛК). */
export async function getUserActiveOffers(userId: string) {
  const rows = await db
    .select({
      waitlistId: waitlist.id,
      eventId: events.id,
      eventTitle: events.title,
      eventStartDate: events.startDate,
      expiresAt: waitlist.expiresAt,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
    })
    .from(waitlist)
    .innerJoin(events, eq(events.id, waitlist.eventId))
    .leftJoin(seats, eq(seats.id, waitlist.seatId))
    .where(
      and(
        eq(waitlist.userId, userId),
        eq(waitlist.status, 'offered'),
        gt(waitlist.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(waitlist.expiresAt));

  return rows;
}

/** Статистика листа ожидания мероприятия для дашборда организатора. */
export async function getEventWaitlistStats(eventId: string) {
  await cleanExpiredOffers(eventId).catch(() => 0);

  const [waitingRow] = await db
    .select({ value: count() })
    .from(waitlist)
    .where(and(eq(waitlist.eventId, eventId), eq(waitlist.status, 'waiting')));

  const [offeredRow] = await db
    .select({ value: count() })
    .from(waitlist)
    .where(and(eq(waitlist.eventId, eventId), eq(waitlist.status, 'offered')));

  const [claimedRow] = await db
    .select({ value: count() })
    .from(waitlist)
    .where(and(eq(waitlist.eventId, eventId), eq(waitlist.status, 'claimed')));

  const [expiredRow] = await db
    .select({ value: count() })
    .from(waitlist)
    .where(and(eq(waitlist.eventId, eventId), eq(waitlist.status, 'expired')));

  const waiting = waitingRow?.value ?? 0;
  const offered = offeredRow?.value ?? 0;
  const claimed = claimedRow?.value ?? 0;
  const expired = expiredRow?.value ?? 0;
  const totalOffers = claimed + expired;
  const conversionPercent = totalOffers > 0 ? Math.round((claimed / totalOffers) * 100) : 0;

  return {
    waiting,
    offered,
    claimed,
    expired,
    conversionPercent,
  };
}

export type WaitlistAdminEntry = {
  id: string;
  status: WaitlistStatus;
  priority: number;
  createdAt: Date;
  offeredAt: Date | null;
  expiresAt: Date | null;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  rowLabel: string | null;
  seatNumber: number | null;
};

/** Полный список участников очереди для панели организатора. */
export async function getEventWaitlistEntries(eventId: string): Promise<WaitlistAdminEntry[]> {
  await cleanExpiredOffers(eventId).catch(() => 0);

  const rows = await db
    .select({
      id: waitlist.id,
      status: waitlist.status,
      priority: waitlist.priority,
      createdAt: waitlist.createdAt,
      offeredAt: waitlist.offeredAt,
      expiresAt: waitlist.expiresAt,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
    })
    .from(waitlist)
    .innerJoin(users, eq(users.id, waitlist.userId))
    .leftJoin(seats, eq(seats.id, waitlist.seatId))
    .where(eq(waitlist.eventId, eventId))
    .orderBy(
      // Сначала предложенные, затем ожидающие по приоритету и времени, затем история
      sql`CASE
        WHEN ${waitlist.status} = 'offered' THEN 1
        WHEN ${waitlist.status} = 'waiting' THEN 2
        WHEN ${waitlist.status} = 'claimed' THEN 3
        WHEN ${waitlist.status} = 'expired' THEN 4
        ELSE 5 END`,
      asc(waitlist.priority),
      asc(waitlist.createdAt),
    );

  return rows;
}
