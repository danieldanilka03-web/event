import { requireRoleOrThrow, AuthError } from '@/server/auth/guards';
import { getHall, getActiveHold } from '@/server/db/halls';
import { fail, isUuid, ok } from '@/server/api/helpers';

/**
 * GET  /api/events/[id]/seats — схема зала (статусы кресел).
 * POST /api/events/[id]/seats — забронировать кресло на 10 минут.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Некорректный идентификатор', 400);

  try {
    const user = await requireRoleOrThrow('participant', 'organizer', 'admin');
    const [hall, hold] = await Promise.all([getHall(id, user.id), getActiveHold(id, user.id)]);
    return ok({
      seats: hall.map((s) => ({
        id: s.id,
        row: s.rowLabel,
        number: s.number,
        category: s.category,
        status: s.status,
        holdExpiresAt: s.holdExpiresAt,
      })),
      hold: hold ? { seatId: hold.seatId, expiresAt: hold.expiresAt.toISOString() } : null,
    });
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 401 : 500);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Некорректный идентификатор', 400);

  try {
    await requireRoleOrThrow('participant', 'organizer', 'admin');
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 401 : 500);
  }

  let body: { seatId?: string };
  try {
    body = (await request.json()) as { seatId?: string };
  } catch {
    return fail('Ожидался JSON', 400);
  }
  if (!body.seatId || !isUuid(body.seatId)) return fail('Некорректное место', 400);

  const { holdSeatAction } = await import('@/server/actions/registrations');
  const result = await holdSeatAction(null, { eventId: id, seatId: body.seatId });
  if (!result.ok) return fail(result.error, 409);
  return ok(result.data, 201);
}

/** DELETE /api/events/[id]/seats — досрочно снять свою бронь. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return fail('Некорректный идентификатор', 400);

  try {
    await requireRoleOrThrow('participant', 'organizer', 'admin');
    const { releaseHoldAction } = await import('@/server/actions/registrations');
    const result = await releaseHoldAction(null, { eventId: id });
    if (!result.ok) return fail(result.error, 400);
    return ok({ released: true });
  } catch (e) {
    return fail((e as Error).message, e instanceof AuthError ? 401 : 500);
  }
}