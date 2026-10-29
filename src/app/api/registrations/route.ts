import { requireUserOrThrow, AuthError } from '@/server/auth/guards';
import { getUserTickets } from '@/server/db/queries';
import { registerForEventAction, cancelRegistrationAction } from '@/server/actions/registrations';
import { fail, isUuid, ok } from '@/server/api/helpers';

/** GET /api/registrations — регистрации текущего пользователя. */
export async function GET() {
  let user;
  try {
    user = await requireUserOrThrow();
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 401 : 500);
  }

  const tickets = await getUserTickets(user.id);
  return ok(
    tickets.map((t) => ({
      id: t.id,
      status: t.status,
      eventStatus: t.eventStatus,
      eventId: t.eventId,
      title: t.title,
      location: t.location,
      startDate: t.startDate.toISOString(),
      seat: t.rowLabel && t.seatNumber !== null ? { row: t.rowLabel, number: t.seatNumber } : null,
    })),
  );
}

/** POST /api/registrations — зарегистрироваться (eventId и, при рассадке, seatId). */
export async function POST(request: Request) {
  try {
    await requireUserOrThrow();
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 401 : 500);
  }

  let body: { eventId?: string; seatId?: string };
  try {
    body = (await request.json()) as { eventId?: string; seatId?: string };
  } catch {
    return fail('Ожидался JSON', 400);
  }
  if (!body.eventId || !isUuid(body.eventId)) return fail('Некорректное мероприятие', 400);
  if (body.seatId && !isUuid(body.seatId)) return fail('Некорректное место', 400);

  const result = await registerForEventAction(null, { eventId: body.eventId, seatId: body.seatId ?? null });
  if (!result.ok) return fail(result.error, 409);
  return ok(result.data, 201);
}

/** DELETE /api/registrations?registrationId=… — отменить регистрацию. */
export async function DELETE(request: Request) {
  try {
    await requireUserOrThrow();
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 401 : 500);
  }

  const id = new URL(request.url).searchParams.get('registrationId');
  if (!id || !isUuid(id)) return fail('Некорректная запись', 400);

  const result = await cancelRegistrationAction(null, { registrationId: id });
  if (!result.ok) return fail(result.error, 400);
  return ok({ cancelled: true });
}