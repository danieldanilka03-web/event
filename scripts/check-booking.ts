/**
 * Проверка критичной части бизнес-логики (раздел 5.1–5.2 ТЗ) на реальной БД.
 * Повторяет ровно те SQL-запросы, что выполняет Server Action регистрации.
 *
 * Запуск: DATABASE_URL=... npx tsx scripts/check-booking.ts
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

/** Точная копия логики registerForEventAction. */
async function register(eventId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = await client.query(
      `SELECT id, status, start_date FROM events WHERE id = $1 FOR UPDATE`,
      [eventId],
    );
    const event = ev.rows[0];
    if (!event) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Мероприятие не найдено' };
    }
    if (event.status !== 'published') {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Мероприятие недоступно' };
    }
    if (new Date(event.start_date).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Мероприятие уже началось' };
    }
    const dup = await client.query(
      'SELECT id, status FROM registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, userId],
    );
    const duplicate = dup.rows[0];
    if (duplicate?.status === 'active') {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Вы уже зарегистрированы' };
    }
    const seat = await client.query(
      `UPDATE events SET occupied_seats = occupied_seats + 1
       WHERE id = $1 AND status = 'published' AND occupied_seats < max_seats
       RETURNING id`,
      [eventId],
    );
    if (seat.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Свободных мест нет' };
    }
    let registrationId: string;
    if (duplicate) {
      const upd = await client.query(
        `UPDATE registrations SET status = 'active', created_at = now() WHERE id = $1 RETURNING id`,
        [duplicate.id],
      );
      registrationId = upd.rows[0].id;
    } else {
      const ins = await client.query(
        'INSERT INTO registrations (event_id, user_id) VALUES ($1, $2) RETURNING id',
        [eventId, userId],
      );
      registrationId = ins.rows[0].id;
    }
    await client.query('COMMIT');
    return { ok: true, data: { registrationId } };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    return { ok: false, error: (e as Error).message };
  } finally {
    client.release();
  }
}

/** Точная копия логики cancelRegistrationAction. */
async function cancel(registrationId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reg = await client.query(
      `SELECT r.id, r.event_id, r.status, e.start_date
       FROM registrations r JOIN events e ON e.id = r.event_id
       WHERE r.id = $1 AND r.user_id = $2 FOR UPDATE OF r`,
      [registrationId, userId],
    );
    const row = reg.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Запись не найдена' };
    }
    if (new Date(row.start_date).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Прошедшее мероприятие' };
    }
    if (row.status === 'cancelled') {
      await client.query('COMMIT');
      return { ok: true, data: null };
    }
    await client.query(`UPDATE registrations SET status = 'cancelled', seat_id = NULL WHERE id = $1`, [
      registrationId,
    ]);
    await client.query(
      `UPDATE events SET occupied_seats = greatest(0, occupied_seats - 1)
       WHERE id = $1 AND occupied_seats > 0`,
      [row.event_id],
    );
    await client.query('COMMIT');
    return { ok: true, data: null };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    return { ok: false, error: (e as Error).message };
  } finally {
    client.release();
  }
}

async function seats(eventId: string) {
  const r = await pool.query('SELECT occupied_seats, max_seats FROM events WHERE id = $1', [
    eventId,
  ]);
  return r.rows[0] as { occupied_seats: number; max_seats: number };
}

async function main() {
  console.log('Проверка логики бронирования\n');

  // Готовим событие с одним свободным местом.
  const org = await pool.query(`SELECT id FROM users WHERE role = 'organizer' LIMIT 1`);
  const organizerId = org.rows[0].id;
  const users = await pool.query(`SELECT id FROM users WHERE role = 'participant' ORDER BY email`);
  const [u1, u2] = [users.rows[0].id, users.rows[1].id];

  await pool.query('DELETE FROM events WHERE title = $1', ['TEST: последнее место']);
  const ev = await pool.query(
    `INSERT INTO events (organizer_id, title, description, category, location, start_date, max_seats, status)
     VALUES ($1, 'TEST: последнее место', 'Тестовое мероприятие для проверки гонки', 'Другое', 'Тест',
             now() + interval '10 days', 1, 'published') RETURNING id`,
    [organizerId],
  );
  const eventId = ev.rows[0].id as string;

  // 1. Две одновременные регистрации на последнее место.
  const [r1, r2] = await Promise.all([register(eventId, u1), register(eventId, u2)]);
  const successes = [r1, r2].filter((r) => r.ok).length;
  const failures = [r1, r2].filter((r) => !r.ok);
  check('ровно одна регистрация прошла', successes === 1, `успешно: ${successes}`);
  check('вторая получила «Свободных мест нет»', failures[0]?.error === 'Свободных мест нет', failures[0]?.error);

  const s1 = await seats(eventId);
  check('occupied_seats не превышает max_seats', s1.occupied_seats <= s1.max_seats, JSON.stringify(s1));
  check('occupied_seats равен 1', s1.occupied_seats === 1, JSON.stringify(s1));

  // 2. Повторная запись тем же пользователем.
  const winner = r1.ok ? u1 : u2;
  const again = await register(eventId, winner);
  check('повторная запись отклонена', !again.ok && again.error === 'Вы уже зарегистрированы', again.ok ? 'прошла' : again.error);
  const s2 = await seats(eventId);
  check('счётчик не вырос при повторной записи', s2.occupied_seats === 1, JSON.stringify(s2));

  // 3. Отмена уменьшает счётчик ровно на 1.
  const reg = await pool.query(
    'SELECT id FROM registrations WHERE event_id = $1 AND user_id = $2',
    [eventId, winner],
  );
  const regId = reg.rows[0].id as string;
  const c1 = await cancel(regId, winner);
  check('отмена успешна', c1.ok);
  const s3 = await seats(eventId);
  check('счётчик уменьшился на 1', s3.occupied_seats === 0, JSON.stringify(s3));

  // 4. Повторная отмена ничего не меняет.
  const c2 = await cancel(regId, winner);
  check('повторная отмена не падает', c2.ok);
  const s4 = await seats(eventId);
  check('счётчик не изменился', s4.occupied_seats === 0, JSON.stringify(s4));

  // 5. После отмены можно записаться снова.
  const r3 = await register(eventId, winner);
  check('повторная запись после отмены работает', r3.ok, r3.ok ? '' : r3.error);
  const s5 = await seats(eventId);
  check('счётчик снова 1', s5.occupied_seats === 1, JSON.stringify(s5));

  // 6. Проверка ограничения на уровне БД.
  let dbGuard = false;
  try {
    await pool.query('UPDATE events SET occupied_seats = max_seats + 1 WHERE id = $1', [eventId]);
  } catch (e) {
    dbGuard = String((e as { code?: string }).code) === '23514';
  }
  check('CHECK-запрещает превышение max_seats', dbGuard);

  // 7. Проверка уникальности (event_id, user_id).
  let uniqGuard = false;
  try {
    await pool.query('INSERT INTO registrations (event_id, user_id) VALUES ($1, $2)', [
      eventId,
      winner,
    ]);
  } catch (e) {
    uniqGuard = String((e as { code?: string }).code) === '23505';
  }
  check('UNIQUE запрещает дубли регистрации', uniqGuard);

  await pool.query('DELETE FROM events WHERE id = $1', [eventId]);

  console.log(`\nИтог: успешно ${passed}, провалено ${failed}`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
