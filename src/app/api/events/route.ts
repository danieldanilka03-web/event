import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleOrThrow, AuthError } from '@/server/auth/guards';
import { db } from '@/server/db';
import { events as eventsTable } from '@/server/db/schema';
import { eventSchema } from '@/shared/validators';
import { buildSeats, layoutForSeats } from '@/shared/hall';
import { fromLocalInputValue } from '@/shared/format';
import { seats as seatsTable } from '@/server/db/schema';

/**
 * REST API мероприятий.
 *
 * GET    /api/events        — публичный каталог
 * POST   /api/events        — создать (organizer, admin)
 * GET    /api/events/[id]   — одно мероприятие со схемой зала
 * PATCH  /api/events/[id]   — изменить (владелец или admin)
 * DELETE /api/events/[id]   — удалить (владелец или admin)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? undefined;
  const category = url.searchParams.get('category') ?? undefined;
  const page = Number(url.searchParams.get('page') ?? 1) || 1;

  const { getCatalog } = await import('@/server/db/queries');
  const parsed = z
    .object({
      q: z.string().max(100).optional(),
      category: z.enum(['Конференции', 'Концерты', 'Мастер-классы', 'Спорт', 'Выставки', 'Образование', 'Другое']).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.number().int().min(1),
    })
    .safeParse({ q, category, page });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Некорректные параметры запроса' }, { status: 400 });
  }

  try {
    const catalog = await getCatalog(parsed.data);
    return NextResponse.json({
      ok: true,
      data: {
        page: parsed.data.page,
        total: catalog.total,
        totalPages: catalog.totalPages,
        items: catalog.items.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          location: e.location,
          startDate: e.startDate.toISOString(),
          maxSeats: e.maxSeats,
          occupiedSeats: e.occupiedSeats,
          hasHall: e.layoutRows !== null,
          organizer: e.organizerName,
        })),
      },
    });
  } catch (e) {
    console.error('GET /api/events failed', e);
    return NextResponse.json({ ok: false, error: 'Не удалось получить мероприятия' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRoleOrThrow('organizer', 'admin');
  } catch (e) {
    const status = e instanceof AuthError ? 403 : 500;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }

  const body = await readJson(request);
  if (!body) return NextResponse.json({ ok: false, error: 'Ожидался JSON' }, { status: 400 });

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Проверьте заполнение полей', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const layout = data.fixedSeating ? layoutForSeats(data.maxSeats) : null;

  try {
    const [row] = await db
      .insert(eventsTable)
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
      .returning({ id: eventsTable.id });

    if (layout) {
      await db.insert(seatsTable).values(
        buildSeats(layout, data.maxSeats).map((s) => ({
          eventId: row.id,
          rowLabel: s.rowLabel,
          number: s.number,
          category: s.category,
        })),
      );
    }

    return NextResponse.json({ ok: true, data: { id: row.id } }, { status: 201 });
  } catch (e) {
    console.error('POST /api/events failed', e);
    return NextResponse.json({ ok: false, error: 'Не удалось создать мероприятие' }, { status: 500 });
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}