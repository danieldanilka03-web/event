import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { events as eventsTable } from '@/server/db/schema';
import { getEventById } from '@/server/db/queries';
import { getHall } from '@/server/db/halls';
import { requireRoleOrThrow, AuthError } from '@/server/auth/guards';
import { eventSchema, eventStatusSchema } from '@/shared/validators';
import { formatEventDateTime, seatsInfo } from '@/shared/format';
import { fail, isUuid, ok } from '@/server/api/helpers';
import { countActiveParticipants } from '@/server/db/queries';
import { revalidatePath } from 'next/cache';

/** GET /api/events/[id] — мероприятие вместе со схемой зала. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Некорректный идентификатор', 400);

  const event = await getEventById(id);
  if (!event) return fail('Мероприятие не найдено', 404);

  const user = await getCurrentUser();
  const hall = event.layoutRows ? await getHall(id, user?.id ?? null) : [];

  return ok({
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    location: event.location,
    startDate: event.startDate.toISOString(),
    startDateFormatted: formatEventDateTime(event.startDate),
    status: event.status,
    maxSeats: event.maxSeats,
    occupiedSeats: event.occupiedSeats,
    seatsLabel: seatsInfo(event.maxSeats, event.occupiedSeats).label,
    hasHall: event.layoutRows !== null,
    hall: hall.map((s) => ({
      id: s.id,
      row: s.rowLabel,
      number: s.number,
      category: s.category,
      status: s.status,
      holdExpiresAt: s.holdExpiresAt,
    })),
    organizer: event.organizerName,
  });
}

/** PATCH /api/events/[id] — частичное изменение (владелец или админ). */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Некорректный идентификатор', 400);

  let user;
  try {
    user = await requireRoleOrThrow('organizer', 'admin');
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 403 : 500);
  }

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!existing) return fail('Мероприятие не найдено', 404);
  if (user.role !== 'admin' && existing.organizerId !== user.id) {
    return fail('Недостаточно прав для этого мероприятия', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail('Ожидался JSON', 400);
  }

  // Статус меняется отдельной операцией и не требует заполнения всех полей.
  if (typeof body.status === 'string' && Object.keys(body).length === 1) {
    const status = eventStatusSchema.safeParse(body.status);
    if (!status.success) return fail('Некорректный статус', 400);
    if (status.data === 'published' && new Date(existing.startDate).getTime() <= Date.now()) {
      return fail('Нельзя опубликовать уже прошедшее мероприятие', 400);
    }
    await db.update(eventsTable).set({ status: status.data }).where(eq(eventsTable.id, id));
    revalidatePath(`/events/${id}`);
    return ok({ id, status: status.data });
  }

  const merged = {
    title: body.title ?? existing.title,
    description: body.description ?? existing.description,
    category: body.category ?? existing.category,
    location: body.location ?? existing.location,
    startDate: body.startDate ?? existing.startDate.toISOString(),
    maxSeats: body.maxSeats ?? existing.maxSeats,
    // Раскладку через API не меняем: она связана с созданными креслами.
    fixedSeating: existing.layoutRows !== null,
  };

  const parsed = eventSchema.safeParse(merged);
  if (!parsed.success) {
    return fail('Проверьте заполнение полей', 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }
  const data = parsed.data;

  if (existing.layoutRows !== null && data.maxSeats !== existing.maxSeats) {
    return fail('Количество мест у мероприятия с фиксированной рассадкой изменить нельзя', 400, {
      maxSeats: 'Схема зала уже сформирована. Для изменения количества мест создайте новое мероприятие.',
    });
  }

  if (data.maxSeats < existing.occupiedSeats) {
    return fail(`Нельзя уменьшить количество мест ниже числа занятых (${existing.occupiedSeats})`, 400, {
      maxSeats: `Минимум ${existing.occupiedSeats}`,
    });
  }

  const { fromLocalInputValue } = await import('@/shared/format');
  const newStartDate = fromLocalInputValue(data.startDate);
  if (existing.status === 'published' && newStartDate.getTime() <= Date.now()) {
    return fail('Нельзя установить прошедшую дату для опубликованного мероприятия', 400, {
      startDate: 'Дата опубликованного мероприятия должна быть в будущем',
    });
  }

  await db
    .update(eventsTable)
    .set({
      title: data.title,
      description: data.description,
      category: data.category,
      location: data.location,
      startDate: newStartDate,
      maxSeats: data.maxSeats,
    })
    .where(eq(eventsTable.id, id));

  revalidatePath(`/events/${id}`);
  revalidatePath('/organizer/events');
  return ok({ id });
}

/** DELETE /api/events/[id] — удаление (владелец или админ). */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Некорректный идентификатор', 400);

  let user;
  try {
    user = await requireRoleOrThrow('organizer', 'admin');
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 403 : 500);
  }

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!existing) return fail('Мероприятие не найдено', 404);
  if (user.role !== 'admin' && existing.organizerId !== user.id) {
    return fail('Недостаточно прав для этого мероприятия', 403);
  }

  const participants = await countActiveParticipants(id);
  const url = new URL(request.url);
  const confirmed = url.searchParams.get('confirmParticipants') === String(participants);
  if (participants > 0 && user.role !== 'admin' && !confirmed) {
    return fail(
      `У мероприятия ${participants} активных участников. Передайте ?confirmParticipants=${participants} для подтверждения.`,
      409,
    );
  }

  await db.delete(eventsTable).where(eq(eventsTable.id, id));

  revalidatePath('/organizer/events');
  revalidatePath('/');
  return ok({ id, deletedParticipants: participants });
}