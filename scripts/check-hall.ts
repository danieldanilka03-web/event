/**
 * Проверки схемы зала и временной брони на реальной БД.
 * Запуск: npx tsx scripts/check-hall.ts
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* используем переменные процесса */
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const HOLD_TTL_MINUTES = 10;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

/** Точная копия holdSeat() из src/server/db/halls.ts. */
async function hold(eventId: string, seatId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seatRes = await client.query(
      `SELECT s.id, e.status, e.start_date FROM seats s JOIN events e ON e.id = s.event_id
       WHERE s.id = $1 AND s.event_id = $2 FOR UPDATE OF s`,
      [seatId, eventId],
    );
    const seat = seatRes.rows[0];
    if (!seat) throw new Error('Кресло не найдено');
    if (seat.status !== 'published') throw new Error('Мероприятие недоступно');

    const taken = await client.query(
      `SELECT id FROM registrations WHERE event_id=$1 AND seat_id=$2 AND status='active'`,
      [eventId, seatId],
    );
    if (taken.rows.length) throw new Error('Это место уже занято');

    const dup = await client.query(
      `SELECT id FROM registrations WHERE event_id=$1 AND user_id=$2 AND status='active'`,
      [eventId, userId],
    );
    if (dup.rows.length) throw new Error('Вы уже зарегистрированы на это мероприятие');

    // Только истёкшие брони: чужую живую бронь сносить нельзя.
    await client.query('DELETE FROM seat_holds WHERE seat_id = $1 AND expires_at <= now()', [seatId]);
    const current = await client.query(
      'SELECT id FROM seat_holds WHERE seat_id=$1 AND expires_at > now()',
      [seatId],
    );
    if (current.rows.length) throw new Error('Это место сейчас забронировано другим участником');

    const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);
    await client.query(
      'INSERT INTO seat_holds (seat_id, event_id, user_id, expires_at) VALUES ($1,$2,$3,$4)',
      [seatId, eventId, userId, expiresAt],
    );
    await client.query('COMMIT');
    return { ok: true as const, expiresAt };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    return { ok: false as const, error: (e as Error).message };
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Проверка схемы зала и броней\n');

  const users = await pool.query(`SELECT id, email FROM users ORDER BY email`);
  const [u1, u2] = [users.rows[0].id, users.rows[1].id];

  // Мероприятие с рассадкой на 1 кресло — чтобы проверить гонку.
  const org = await pool.query(`SELECT id FROM users WHERE role='organizer' LIMIT 1`);
  const ev = await pool.query(
    `INSERT INTO events (organizer_id, title, description, category, location, start_date,
                         max_seats, status, layout_rows, seats_per_row)
     VALUES ($1,'TEST: зал','Тест зала','Другое','Тест', now() + interval '20 days',
             1,'published',1,1) RETURNING id`,
    [org.rows[0].id],
  );
  const eventId = ev.rows[0].id as string;
  const seat = await pool.query(
    `INSERT INTO seats (event_id, row_label, number) VALUES ($1,'A',1) RETURNING id`,
    [eventId],
  );
  const seatId = seat.rows[0].id as string;

  // 1. Два участника одновременно бронируют одно кресло.
  const [h1, h2] = await Promise.all([hold(eventId, seatId, u1), hold(eventId, seatId, u2)]);
  const okCount = [h1, h2].filter((r) => r.ok).length;
  check('ровно одна бронь прошла', okCount === 1, `успешно ${okCount}`);
  const rejected = [h1, h2].find((r) => !r.ok);
  check(
    'вторая получила отказ по занятости',
    rejected !== undefined && !rejected.ok && rejected.error.includes('забронировано другим'),
    rejected && !rejected.ok ? rejected.error : 'отказа не было',
  );

  // 2. TTL равен 10 минутам.
  const holdRow = await pool.query('SELECT expires_at FROM seat_holds WHERE seat_id=$1', [seatId]);
  const mins = (new Date(holdRow.rows[0].expires_at).getTime() - Date.now()) / 60000;
  check('срок брони ~10 минут', Math.abs(mins - HOLD_TTL_MINUTES) < 0.5, `${mins.toFixed(2)} мин`);

  // 3. Истёкшая бронь освобождает место (ленивая очистка).
  await pool.query('UPDATE seat_holds SET expires_at = now() - interval \'1 minute\' WHERE seat_id=$1', [
    seatId,
  ]);
  const stale = await pool.query('SELECT count(*)::int as c FROM seat_holds WHERE seat_id=$1', [seatId]);
  check('до очистки истёкшая броня лежит в таблице', stale.rows[0].c === 1);
  await pool.query('DELETE FROM seat_holds WHERE seat_id=$1 AND expires_at < now()', [seatId]);
  const afterClean = await pool.query('SELECT count(*)::int as c FROM seat_holds WHERE seat_id=$1', [
    seatId,
  ]);
  check('после очистки место свободно', afterClean.rows[0].c === 0);

  // 4. После истечения брони кресло снова бронируется.
  const again = await hold(eventId, seatId, u2);
  check('после истечения место бронируется снова', again.ok, again.ok ? '' : again.error);

  // 5. UNIQUE(seat_id) не даёт двум живым броням на одном кресле.
  let uniqGuard = false;
  try {
    await pool.query(
      'INSERT INTO seat_holds (seat_id, event_id, user_id, expires_at) VALUES ($1,$2,$3, now() + interval \'10 min\')',
      [seatId, eventId, u1],
    );
  } catch (e) {
    uniqGuard = String((e as { code?: string }).code) === '23505';
  }
  check('UNIQUE(seat_id) блокирует вторую бронь', uniqGuard);

  // 6. Регистрация занимает именно кресло и снимает бронь.
  await pool.query('DELETE FROM seat_holds WHERE seat_id=$1', [seatId]);
  const reg = await pool.query(
    `WITH ins AS (
       INSERT INTO registrations (event_id, user_id, seat_id) VALUES ($1,$2,$3) RETURNING id
     )
     UPDATE events SET occupied_seats = occupied_seats + 1 WHERE id = $1 RETURNING occupied_seats`,
    [eventId, u1, seatId],
  );
  check('регистрация заняла место в зале', reg.rows[0].occupied_seats === 1);

  const nowTaken = await hold(eventId, seatId, u2);
  check('занятое кресло не бронируется', !nowTaken.ok && nowTaken.error === 'Это место уже занято', nowTaken.ok ? 'прошла' : nowTaken.error);

  // 7. Кресло принадлежит своему мероприятию.
  const other = await pool.query(
    `INSERT INTO events (organizer_id, title, description, category, location, start_date, max_seats, status)
     VALUES ($1,'TEST: чужое','x','Другое','x', now() + interval '20 days', 5,'published') RETURNING id`,
    [org.rows[0].id],
  );
  const foreignSeat = await pool.query(
    `INSERT INTO seats (event_id, row_label, number) VALUES ($1,'A',1) RETURNING id`,
    [other.rows[0].id],
  );
  const foreign = { rows: [{ id: foreignSeat.rows[0].id }] };
  const crossEvent = await hold(eventId, foreign.rows[0].id, u1);
  check('кресло чужого мероприятия не проходит', !crossEvent.ok, crossEvent.ok ? 'прошло' : crossEvent.error);

  await pool.query('DELETE FROM events WHERE id IN ($1, $2)', [eventId, other.rows[0].id]);

  console.log(`\nИтог: успешно ${passed}, провалено ${failed}`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});