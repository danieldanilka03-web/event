import { readFileSync } from 'node:fs';
import { hash } from 'bcryptjs';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { events, registrations, seats, seatHolds, users, type EventRow } from '@/server/db/schema';
import { buildSeats, layoutForSeats } from '@/shared/hall';
import { getEventImageUrl } from '@/shared/event-images';

// Скрипт запускается через tsx, поэтому .env.local читаем вручную.
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // файла нет — используем переменные окружения процесса
  }
}

const password = process.env.SEED_PASSWORD ?? 'Password123!';

// Сид идёт через обычный node-postgres: он работает и с Neon, и с локальным Postgres.
const isLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
const db = drizzle(pool);

const CATEGORIES = [
  'Конференции',
  'Концерты',
  'Мастер-классы',
  'Спорт',
  'Выставки',
  'Образование',
  'Другое',
];

/**
 * Дата/время задаётся в Europe/Moscow (UTC+3), а в БД уходит в UTC.
 * Иначе демо-мероприятия «на 12:00» показывались бы как 15:00.
 */
const MSK_OFFSET_MS = 180 * 60 * 1000;

function at(daysFromNow: number, hour: number): Date {
  const nowMsk = new Date(Date.now() + MSK_OFFSET_MS);
  const target = new Date(
    Date.UTC(nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate() + daysFromNow, hour, 0, 0),
  );
  return new Date(target.getTime() - MSK_OFFSET_MS);
}

async function main() {
  console.log('Сид стартует...');

  await db.execute(
    sql`TRUNCATE seat_holds, seats, registrations, events, users RESTART IDENTITY CASCADE`,
  );

  const passwordHash = await hash(password, 10);

  const [, org1, org2] = await db
    .insert(users)
    .values([
      {
        email: 'admin@example.com',
        passwordHash,
        fullName: 'Администратор Системы',
        phone: '+7 900 000-00-01',
        role: 'admin',
      },
      {
        email: 'organizer1@example.com',
        passwordHash,
        fullName: 'Иван Организаторов',
        phone: '+7 900 000-00-02',
        role: 'organizer',
      },
      {
        email: 'organizer2@example.com',
        passwordHash,
        fullName: 'Мария Мероприятий',
        phone: '+7 900 000-00-03',
        role: 'organizer',
      },
    ])
    .returning();

  const participants = await db
    .insert(users)
    .values(
      Array.from({ length: 5 }, (_, i) => ({
        email: `participant${i + 1}@example.com`,
        passwordHash,
        fullName: [
          'Анна Петрова',
          'Борис Соколов',
          'Вера Кузнецова',
          'Глеб Волков',
          'Дарья Смирнова',
        ][i],
        phone: `+7 900 000-01-0${i + 1}`,
        role: 'participant' as const,
        // Третий участник создаётся заблокированным: под это настроены
        // e2e-проверки (scripts/e2e.mjs, сценарий «заблокированный не входит»)
        // и демонстрация блокировки в админ-панели.
        isBlocked: i === 2,
      })),
    )
    .returning();

  const eventSeeds: Array<Omit<EventRow, 'id' | 'occupiedSeats' | 'createdAt'>> = [];
  // Мероприятия с индексами 0,1,3 получают фиксированную рассадку — на них
  // демонстрируется выбор места, бронь и зал.
  const layoutByIndex = new Map<number, { rows: number; seatsPerRow: number; maxSeats: number }>();
  for (let i = 0; i < 15; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const past = i >= 12;
    const status: 'draft' | 'published' | 'cancelled' = past
      ? i === 14
        ? 'cancelled'
        : 'published'
      : i === 10
        ? 'draft'
        : i === 11
          ? 'cancelled'
          : 'published';
    // №10 — полностью заполненное, №9 — почти заполненное (3 из 4).
    const maxSeats = i === 9 ? 3 : i === 8 ? 4 : 20 + i * 3;
    const withLayout = [0, 1, 3].includes(i);
    const layout = withLayout ? layoutForSeats(maxSeats) : null;
    if (layout) layoutByIndex.set(i, { ...layout, maxSeats });
    eventSeeds.push({
      layoutRows: layout?.rows ?? null,
      seatsPerRow: layout?.seatsPerRow ?? null,
      organizerId: (i % 2 === 0 ? org1 : org2).id,
      title: `${category}: событие №${i + 1}`,
      description:
        'Официальное мероприятие платформы. Подробная программа выступлений, ' +
        'ведущие эксперты и интерактивное расписание. Бронируйте места заранее — количество билетов ограничено.',
      category,
      location: `г. Москва, ул. Тестовая, д. ${i + 1}`,
      startDate: past ? at(-(30 - i), 12) : at(i + 1, 12),
      maxSeats,
      status,
      imageUrl: getEventImageUrl({ category, id: String(i) }),
    });
  }

  const insertedEvents = await db
    .insert(events)
    .values(eventSeeds.map((e) => ({ ...e, occupiedSeats: 0 })))
    .returning();

  // Кресла для мероприятий с фиксированной рассадкой.
  const seatRowsByEvent = new Map<string, string[]>();
  for (const [index, layout] of layoutByIndex) {
    const event = insertedEvents[index];
    if (!event) continue;
    const created = await db
      .insert(seats)
      .values(
        buildSeats({ rows: layout.rows, seatsPerRow: layout.seatsPerRow }, layout.maxSeats).map((s) => ({
          eventId: event.id,
          rowLabel: s.rowLabel,
          number: s.number,
          category: s.category,
        })),
      )
      .returning({ id: seats.id });
    seatRowsByEvent.set(event.id, created.map((c) => c.id));
  }

  // Активные регистрации на будущие опубликованные события.
  const bookable = insertedEvents.filter(
    (e) => e.status === 'published' && e.startDate.getTime() > Date.now(),
  );

  const regValues: Array<{
    eventId: string;
    userId: string;
    status: 'active' | 'cancelled';
    seatId: string | null;
  }> = [];
  for (const ev of bookable) {
    // Для мероприятий с залом каждое место получает отдельного участника.
    const seatIds = seatRowsByEvent.get(ev.id) ?? null;
    for (let p = 0; p < Math.min(participants.length, 3); p++) {
      regValues.push({
        eventId: ev.id,
        userId: participants[p].id,
        status: 'active',
        seatId: seatIds && seatIds.length > p ? seatIds[p] : null,
      });
    }
  }
  // Добиваем одно полностью и одно почти заполненное мероприятие.
  for (const ev of bookable.slice(0, 2)) {
    const seatIds = seatRowsByEvent.get(ev.id) ?? null;
    for (let p = 3; p < 5; p++) {
      regValues.push({
        eventId: ev.id,
        userId: participants[p].id,
        status: 'active',
        seatId: seatIds && seatIds.length > p ? seatIds[p] : null,
      });
    }
  }
  // Пара отменённых регистраций.
  if (bookable[5]) {
    regValues.push({
      eventId: bookable[5].id,
      userId: participants[0].id,
      status: 'cancelled',
      seatId: null,
    });
  }

  // Считаем занятые места так же, как в приложении.
  const counts = new Map<string, number>();
  for (const r of regValues) {
    if (r.status !== 'active') continue;
    counts.set(r.eventId, (counts.get(r.eventId) ?? 0) + 1);
  }
  for (const [eventId, count] of counts) {
    await db
      .update(events)
      .set({ occupiedSeats: count })
      .where(eq(events.id, eventId));
  }

  // Отменённые регистрации вставляем отдельно (уникальный индекс не даёт дубль).
  const activeOnly = regValues.filter((r) => r.status === 'active');
  if (activeOnly.length) await db.insert(registrations).values(activeOnly);

  // Одна «живая» бронь на 7 минут — чтобы таймер в интерфейсе было видно сразу.
  const holdEvent = insertedEvents[3];
  if (holdEvent) {
    const freeSeatIds = seatRowsByEvent.get(holdEvent.id) ?? [];
    const free = freeSeatIds[3] ?? freeSeatIds[0];
    if (free) {
      await db.insert(seatHolds).values({
        seatId: free,
        eventId: holdEvent.id,
        userId: participants[4].id,
        expiresAt: new Date(Date.now() + 7 * 60 * 1000),
      });
    }
  }
  const cancelledOnly = regValues.filter((r) => r.status === 'cancelled');
  for (const r of cancelledOnly) {
    const existing = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(
        sql`${registrations.eventId} = ${r.eventId} AND ${registrations.userId} = ${r.userId}`,
      );
    if (existing.length) {
      await db
        .update(registrations)
        .set({ status: 'cancelled' })
        .where(eq(registrations.id, existing[0].id));
    }
  }

  console.log(`Готово. Пользователей: ${3 + participants.length}, событий: ${insertedEvents.length}`);
  console.log(`Пароль всех тестовых аккаунтов: ${password}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
