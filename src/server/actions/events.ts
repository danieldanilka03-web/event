'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { events } from '@/server/db/schema';
import { requireUser, requireRoleOrThrow } from '@/server/auth/guards';
import { countActiveParticipants } from '@/server/db/queries';
import { eventSchema, idSchema, type EventInput } from '@/shared/validators';
import { fromLocalInputValue } from '@/shared/format';
import { buildSeats, layoutForSeats } from '@/shared/hall';
import { seats } from '@/server/db/schema';
import type { ActionResult } from './auth';

function fieldErrorsOf(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten().fieldErrors;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value && value.length) out[key] = value[0] as string;
  }
  return out;
}

function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    category: formData.get('category'),
    location: formData.get('location'),
    startDate: formData.get('startDate'),
    maxSeats: formData.get('maxSeats'),
    fixedSeating: formData.get('fixedSeating') ?? 'off',
  });
}

export async function createEventAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRoleOrThrow('organizer', 'admin');
  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { ok: false, error: 'Проверьте заполнение полей', fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const data: EventInput = parsed.data;

  // Фиксированная рассадка: подбираем раскладку под число мест.
  const layout = data.fixedSeating ? layoutForSeats(data.maxSeats) : null;

  const eventId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(events)
      .values({
        organizerId: user.id,
        title: data.title,
        description: data.description,
        category: data.category,
        location: data.location,
        startDate: fromLocalInputValue(data.startDate),
        maxSeats: data.maxSeats,
        status: 'draft',
        layoutRows: layout?.rows ?? null,
        seatsPerRow: layout?.seatsPerRow ?? null,
      })
      .returning({ id: events.id });

    if (layout) {
      await tx.insert(seats).values(
        buildSeats(layout, data.maxSeats).map((s) => ({
          eventId: row.id,
          rowLabel: s.rowLabel,
          number: s.number,
          category: s.category,
        })),
      );
    }
    return row.id;
  });

  revalidatePath('/organizer/events');
  revalidatePath('/organizer');
  return { ok: true, data: { id: eventId } };
}

async function loadOwnEvent(id: string, userId: string, isAdmin: boolean) {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!row) return null;
  // Организатор правит только свои события, администратор — любые.
  if (!isAdmin && row.organizerId !== userId) return null;
  return row;
}

export async function updateEventAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRoleOrThrow('organizer', 'admin');
  const idParsed = idSchema.safeParse(formData.get('id'));
  if (!idParsed.success) return { ok: false, error: 'Некорректное мероприятие' };

  const existing = await loadOwnEvent(idParsed.data, user.id, user.role === 'admin');
  if (!existing) return { ok: false, error: 'Мероприятие не найдено или нет доступа' };

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { ok: false, error: 'Проверьте заполнение полей', fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const data: EventInput = parsed.data;

  if (existing.layoutRows !== null && data.maxSeats !== existing.maxSeats) {
    return {
      ok: false,
      error: 'Количество мест у мероприятия с фиксированной рассадкой изменить нельзя',
      fieldErrors: { maxSeats: 'Схема зала уже сформирована. Для изменения количества мест создайте новое мероприятие.' },
    };
  }

  if (data.maxSeats < existing.occupiedSeats) {
    return {
      ok: false,
      error: `Нельзя уменьшить количество мест ниже числа занятых (${existing.occupiedSeats})`,
      fieldErrors: { maxSeats: `Минимум ${existing.occupiedSeats} (сейчас занято ${existing.occupiedSeats})` },
    };
  }

  const newStartDate = fromLocalInputValue(data.startDate);
  if (existing.status === 'published' && newStartDate.getTime() <= Date.now()) {
    return {
      ok: false,
      error: 'Нельзя установить прошедшую дату для опубликованного мероприятия',
      fieldErrors: { startDate: 'Дата опубликованного мероприятия должна быть в будущем' },
    };
  }

  await db
    .update(events)
    .set({
      title: data.title,
      description: data.description,
      category: data.category,
      location: data.location,
      startDate: newStartDate,
      maxSeats: data.maxSeats,
    })
    .where(eq(events.id, existing.id));

  revalidatePath('/organizer/events');
  revalidatePath(`/organizer/events/${existing.id}/edit`);
  revalidatePath(`/events/${existing.id}`);
  return { ok: true, data: { id: existing.id } };
}

export async function setEventStatusAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string; status: 'draft' | 'published' | 'cancelled' },
): Promise<ActionResult<null>> {
  const user = await requireRoleOrThrow('organizer', 'admin');
  const idParsed = idSchema.safeParse(input.eventId);
  const status = input.status;
  if (!idParsed.success) return { ok: false, error: 'Некорректное мероприятие' };
  if (status !== 'draft' && status !== 'published' && status !== 'cancelled') {
    return { ok: false, error: 'Некорректный статус' };
  }

  const existing = await loadOwnEvent(idParsed.data, user.id, user.role === 'admin');
  if (!existing) return { ok: false, error: 'Мероприятие не найдено или нет доступа' };

  if (status === 'published' && new Date(existing.startDate).getTime() <= Date.now()) {
    return { ok: false, error: 'Нельзя опубликовать уже прошедшее мероприятие' };
  }

  await db.update(events).set({ status }).where(eq(events.id, existing.id));
  revalidatePath('/organizer/events');
  revalidatePath(`/events/${existing.id}`);
  revalidatePath('/');
  return { ok: true, data: null };
}

export async function deleteEventAction(
  _prev: ActionResult<null> | null,
  input: { eventId: string; confirmParticipants: string },
): Promise<ActionResult<null>> {
  const user = await requireRoleOrThrow('organizer', 'admin');
  const idParsed = idSchema.safeParse(input.eventId);
  if (!idParsed.success) return { ok: false, error: 'Некорректное мероприятие' };

  const existing = await loadOwnEvent(idParsed.data, user.id, user.role === 'admin');
  if (!existing) return { ok: false, error: 'Мероприятие не найдено или нет доступа' };

  const activeCount = await countActiveParticipants(existing.id);
  const confirmed = input.confirmParticipants === String(activeCount);
  if (activeCount > 0 && !confirmed) {
    return {
      ok: false,
      error: `У мероприятия ${activeCount} активных участн. Подтвердите удаление числом участников.`,
    };
  }

  await db.delete(events).where(eq(events.id, existing.id));
  revalidatePath('/organizer/events');
  revalidatePath('/organizer');
  revalidatePath('/');
  return { ok: true, data: null };
}

export async function getOwnedEventForEdit(id: string) {
  const user = await requireUser();
  return loadOwnEvent(id, user.id, user.role === 'admin');
}

export async function redirectToEvents() {
  redirect('/organizer/events');
}
