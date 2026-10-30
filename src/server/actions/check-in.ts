'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { events, registrations, seats, users } from '@/server/db/schema';
import { requireUser } from '@/server/auth/guards';
import { formatEventTime } from '@/shared/format';
import type { ActionResult } from './auth';

export type CheckInResultData = {
  id: string;
  fullName: string;
  email: string;
  rowLabel: string | null;
  seatNumber: number | null;
  seatCategory: string | null;
  checkedInAt: Date;
  alreadyCheckedIn?: boolean;
};

export async function validateAndCheckInTicketAction(
  _prev: ActionResult<CheckInResultData> | null,
  input: { eventId: string; ticketCode: string },
): Promise<ActionResult<CheckInResultData>> {
  const user = await requireUser();
  if (user.role !== 'organizer' && user.role !== 'admin') {
    return { ok: false, error: 'Доступ запрещён' };
  }

  const code = (input.ticketCode ?? '').trim();
  if (!code) {
    return { ok: false, error: 'Введите или отсканируйте код билета' };
  }

  // Проверяем права на мероприятие
  const [event] = await db
    .select({ id: events.id, organizerId: events.organizerId, title: events.title })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);

  if (!event || (user.role !== 'admin' && event.organizerId !== user.id)) {
    return { ok: false, error: 'Мероприятие не найдено или нет прав организатора' };
  }

  // Ищем регистрацию по полному UUID или по первым символам (shortId, например 8 знаков)
  const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
  const cleanPrefix = code.replace(/[^a-f0-9]/gi, '').toLowerCase();

  const [ticket] = await db
    .select({
      id: registrations.id,
      status: registrations.status,
      checkedInAt: registrations.checkedInAt,
      userId: registrations.userId,
      fullName: users.fullName,
      email: users.email,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
      seatCategory: seats.category,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .leftJoin(seats, eq(seats.id, registrations.seatId))
    .where(
      and(
        eq(registrations.eventId, input.eventId),
        isFullUuid
          ? eq(registrations.id, code)
          : sql`lower(replace(${registrations.id}::text, '-', '')) LIKE ${cleanPrefix + '%'}`,
      ),
    )
    .limit(1);

  if (!ticket) {
    return { ok: false, error: `Билет с кодом «${code}» не найден на это мероприятие` };
  }

  if (ticket.status === 'cancelled') {
    return {
      ok: false,
      error: `Билет аннулирован (регистрация участника ${ticket.fullName} была отменена)`,
    };
  }

  // Если билет уже был погашен ранее — предупреждаем о повторном проходе!
  if (ticket.checkedInAt) {
    return {
      ok: false,
      error: `Внимание! Билет уже был использован ранее (вход зафиксирован в ${formatEventTime(ticket.checkedInAt)}). Повторный проход запрещён.`,
    };
  }

  // Фиксируем успешный вход
  const now = new Date();
  await db
    .update(registrations)
    .set({ checkedInAt: now })
    .where(eq(registrations.id, ticket.id));

  revalidatePath(`/organizer/events/${input.eventId}/participants`);
  revalidatePath(`/organizer/events/${input.eventId}/check-in`);

  return {
    ok: true,
    data: {
      id: ticket.id,
      fullName: ticket.fullName,
      email: ticket.email,
      rowLabel: ticket.rowLabel,
      seatNumber: ticket.seatNumber,
      seatCategory: ticket.seatCategory,
      checkedInAt: now,
    },
  };
}

export async function toggleCheckInStatusAction(
  _prev: ActionResult<{ checkedIn: boolean }> | null,
  input: { registrationId: string; eventId: string },
): Promise<ActionResult<{ checkedIn: boolean }>> {
  const user = await requireUser();
  if (user.role !== 'organizer' && user.role !== 'admin') {
    return { ok: false, error: 'Доступ запрещён' };
  }

  const [event] = await db
    .select({ organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);

  if (!event || (user.role !== 'admin' && event.organizerId !== user.id)) {
    return { ok: false, error: 'Мероприятие не найдено или нет прав организатора' };
  }

  const [reg] = await db
    .select({ id: registrations.id, checkedInAt: registrations.checkedInAt })
    .from(registrations)
    .where(and(eq(registrations.id, input.registrationId), eq(registrations.eventId, input.eventId)))
    .limit(1);

  if (!reg) return { ok: false, error: 'Запись не найдена' };

  const nextCheckIn = reg.checkedInAt ? null : new Date();

  await db
    .update(registrations)
    .set({ checkedInAt: nextCheckIn })
    .where(eq(registrations.id, reg.id));

  revalidatePath(`/organizer/events/${input.eventId}/participants`);
  revalidatePath(`/organizer/events/${input.eventId}/check-in`);

  return { ok: true, data: { checkedIn: Boolean(nextCheckIn) } };
}
