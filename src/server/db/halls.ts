import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { seatHolds, seats, registrations, type SeatCategory } from '@/server/db/schema';
import { HOLD_TTL_MINUTES } from '@/shared/hall';

export type SeatView = {
  id: string;
  rowLabel: string;
  number: number;
  category: SeatCategory;
  status: 'free' | 'taken' | 'held' | 'mine';
  /** Чей холд: id пользователя-залоговавца (для подсветки «занято мной»). */
  heldBy: string | null;
  /** Когда истекает бронь (ISO), если статус held. */
  holdExpiresAt: string | null;
};

/**
 * Схема зала для мероприятия.
 *
 * Перед выдачей удаляются истёкшие брони — это и есть ленивая очистка:
 * истёкшая бронь автоматически возвращает место в категорию свободных.
 * Отдельная задача не нужна.
 */
export async function getHall(eventId: string, userId: string | null): Promise<SeatView[]> {
  await releaseExpiredHolds(eventId);

  const seatRows = await db.select().from(seats).where(eq(seats.eventId, eventId));
  if (seatRows.length === 0) return [];

  const seatIds = seatRows.map((s) => s.id);
  const taken = await db
    .select({ seatId: registrations.seatId })
    .from(registrations)
    .where(
      and(
        eq(registrations.eventId, eventId),
        eq(registrations.status, 'active'),
        inArray(registrations.seatId, seatIds),
      ),
    );
  const takenSet = new Set(taken.map((r) => r.seatId));

  const holds = await db
    .select({ seatId: seatHolds.seatId, userId: seatHolds.userId, expiresAt: seatHolds.expiresAt })
    .from(seatHolds)
    .where(and(eq(seatHolds.eventId, eventId), gt(seatHolds.expiresAt, new Date())));
  const holdMap = new Map(holds.map((h) => [h.seatId, h]));

  return seatRows.map((s) => {
    const hold = holdMap.get(s.id);
    if (takenSet.has(s.id)) {
      return { ...base(s), status: 'taken' as const, heldBy: null, holdExpiresAt: null };
    }
    if (hold) {
      const mine = userId !== null && hold.userId === userId;
      return {
        ...base(s),
        status: mine ? ('mine' as const) : ('held' as const),
        heldBy: hold.userId,
        holdExpiresAt: hold.expiresAt.toISOString(),
      };
    }
    return { ...base(s), status: 'free' as const, heldBy: null, holdExpiresAt: null };
  });
}

function base(s: { id: string; rowLabel: string; number: number; category: SeatCategory }) {
  return { id: s.id, rowLabel: s.rowLabel, number: s.number, category: s.category };
}

/** Удаляет истёкшие брони мероприятия (ленивая очистка). */
export async function releaseExpiredHolds(eventId: string): Promise<number> {
  const res = await db
    .delete(seatHolds)
    .where(and(eq(seatHolds.eventId, eventId), lt(seatHolds.expiresAt, new Date())));
  return res.rowCount ?? 0;
}

/** Глобальная очистка истёкших броней — используется в фоновом вызове и сиде. */
export async function releaseAllExpiredHolds(): Promise<number> {
  const res = await db.delete(seatHolds).where(lt(seatHolds.expiresAt, new Date()));
  return res.rowCount ?? 0;
}

export type HoldResult =
  | { ok: true; data: { seatId: string; expiresAt: string } }
  | { ok: false; error: string };

/**
 * Бронирует кресло на 10 минут.
 *
 * Одна транзакция:
 *  1. блокируем строку кресла FOR UPDATE — два клика по одному креслу
 *     выстраиваются в очередь, а не проходят одновременно;
 *  2. проверяем, что место не занято активной регистрацией;
 *  3. снимаем истёкшую бронь этого кресла, если она была;
 *  4. если кресло держит другой живой холд — «Место уже забронировано другим участником»;
 *  5. пересоздаём бронь на текущего пользователя.
 */
export async function holdSeat(eventId: string, seatId: string, userId: string): Promise<HoldResult> {
  return await db.transaction(async (tx) => {
    const seatRes = await tx.execute(sql`
      SELECT s.id, e.status, e.start_date, e.max_seats, e.occupied_seats
      FROM seats s JOIN events e ON e.id = s.event_id
      WHERE s.id = ${seatId} AND s.event_id = ${eventId}
      FOR UPDATE OF s
    `);
    const seat = seatRes.rows[0] as
      | { id: string; status: string; start_date: Date; max_seats: number; occupied_seats: number }
      | undefined;

    if (!seat) throw new HoldError('Кресло не найдено');
    if (seat.status !== 'published') throw new HoldError('Мероприятие недоступно для бронирования');
    if (new Date(seat.start_date).getTime() <= Date.now()) {
      throw new HoldError('Мероприятие уже началось');
    }

    const existingReg = await tx.execute(sql`
      SELECT id FROM registrations
      WHERE event_id = ${eventId} AND seat_id = ${seatId} AND status = 'active'
    `);
    if (existingReg.rows.length > 0) throw new HoldError('Это место уже занято');

    // Повторная регистрация на это мероприятие — если уже есть активная запись, место бронировать нельзя.
    const dup = await tx.execute(sql`
      SELECT id FROM registrations WHERE event_id = ${eventId} AND user_id = ${userId} AND status = 'active'
    `);
    if (dup.rows.length > 0) throw new HoldError('Вы уже зарегистрированы на это мероприятие');

    // Снимаем только ИСТЁКШУЮ бронь этого кресла: безусловный DELETE здесь
    // сносил бы чужую живую бронь и позволял «украсть» занятое место.
    await tx.execute(sql`
      DELETE FROM seat_holds WHERE seat_id = ${seatId} AND expires_at <= now()
    `);

    const currentHold = await tx.execute(sql`
      SELECT id FROM seat_holds WHERE seat_id = ${seatId} AND expires_at > now()
    `);
    if (currentHold.rows.length > 0) {
      throw new HoldError('Это место сейчас забронировано другим участником');
    }

    // У пользователя может быть только одна активная бронь на мероприятие:
    // выбрал другое место — предыдущее освобождается.
    await tx.execute(sql`
      DELETE FROM seat_holds
      WHERE event_id = ${eventId} AND user_id = ${userId} AND seat_id <> ${seatId}
    `);

    const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);
    await tx.execute(sql`
      INSERT INTO seat_holds (seat_id, event_id, user_id, expires_at)
      VALUES (${seatId}, ${eventId}, ${userId}, ${expiresAt})
    `);

    return { ok: true as const, data: { seatId, expiresAt: expiresAt.toISOString() } };
  });
}

export class HoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HoldError';
  }
}

/** Снимает бронь пользователя на мероприятие (кнопка «Отпустить место»). */
export async function releaseHold(eventId: string, userId: string): Promise<void> {
  await db
    .delete(seatHolds)
    .where(and(eq(seatHolds.eventId, eventId), eq(seatHolds.userId, userId)));
}

/** Активная бронь пользователя на мероприятие. */
export async function getActiveHold(eventId: string, userId: string) {
  const [row] = await db
    .select()
    .from(seatHolds)
    .where(
      and(
        eq(seatHolds.eventId, eventId),
        eq(seatHolds.userId, userId),
        gt(seatHolds.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}