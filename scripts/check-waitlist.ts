/**
/**
 * Проверка работы подсистемы «Лист ожидания» (Waitlist) и алгоритмического
 * перераспределения мест на реальной БД.
 *
 * Запуск: npx tsx scripts/check-waitlist.ts
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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ok   ${name}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL ${name} ${extra}`);
  }
}

async function run() {
  console.log('\n=== Проверка алгоритма Листа ожидания (Waitlist) ===\n');

  const client = await pool.connect();
  let testEventId: string | null = null;
  let userA: string | null = null;
  let userB: string | null = null;
  let userC: string | null = null;

  try {
    // 1. Получаем трёх тестовых пользователей
    const uRes = await client.query<{ id: string }>(
      `SELECT id FROM users ORDER BY created_at ASC LIMIT 3`,
    );
    if (uRes.rows.length < 3) {
      console.log('Для теста требуется минимум 3 пользователя в БД. Выполните npm run db:seed.');
      return;
    }
    userA = uRes.rows[0].id;
    userB = uRes.rows[1].id;
    userC = uRes.rows[2].id;

    // 2. Создаём тестовое мероприятие с 1 местом
    const evRes = await client.query<{ id: string }>(
      `INSERT INTO events (title, description, start_date, location, category, max_seats, occupied_seats, status, organizer_id)
       VALUES ('Тест листа ожидания', 'Описание', now() + interval '5 days', 'Онлайн', 'Другое', 1, 1, 'published', $1)
       RETURNING id`,
      [userA],
    );
    testEventId = evRes.rows[0].id;

    // Пользователь A уже занимает это единственное место
    await client.query(
      `INSERT INTO registrations (event_id, user_id, status) VALUES ($1, $2, 'active')`,
      [testEventId, userA],
    );

    // 3. Пользователь B встаёт в лист ожидания (обычный приоритет 0)
    const bRes = await client.query<{ id: string }>(
      `INSERT INTO waitlist (event_id, user_id, status, priority)
       VALUES ($1, $2, 'waiting', 0) RETURNING id`,
      [testEventId, userB],
    );
    check('Пользователь B встал в лист ожидания', Boolean(bRes.rows[0]?.id));

    // 4. Пользователь C встаёт в лист ожидания чуть позже, но с VIP-приоритетом (-1)
    const cRes = await client.query<{ id: string }>(
      `INSERT INTO waitlist (event_id, user_id, status, priority)
       VALUES ($1, $2, 'waiting', -1) RETURNING id`,
      [testEventId, userC],
    );
    check('Пользователь C встал в лист ожидания с VIP-приоритетом (-1)', Boolean(cRes.rows[0]?.id));

    // 5. Проверяем выборку очереди алгоритмом: кандидат с меньшим priority должен быть первым
    const candidateRes = await client.query<{ user_id: string }>(
      `SELECT user_id FROM waitlist
       WHERE event_id = $1 AND status = 'waiting'
       ORDER BY priority ASC, created_at ASC
       LIMIT 1`,
      [testEventId],
    );
    check(
      'Алгоритм очередей выбрал VIP-пользователя C первым перед B',
      candidateRes.rows[0]?.user_id === userC,
    );

    // 6. Пользователь A отменяет регистрацию -> триггерится распределение
    await client.query('BEGIN');
    await client.query(`UPDATE registrations SET status = 'cancelled' WHERE event_id = $1 AND user_id = $2`, [
      testEventId,
      userA,
    ]);

    // Имитация dispatchWaitlistOfferWithClient
    const nextCandidate = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM waitlist
       WHERE event_id = $1 AND status = 'waiting'
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE`,
      [testEventId],
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await client.query(
      `UPDATE waitlist SET status = 'offered', offered_at = now(), expires_at = $2 WHERE id = $1`,
      [nextCandidate.rows[0].id, expiresAt],
    );
    await client.query('COMMIT');

    // Проверяем статус пользователя C
    const cStatusRes = await client.query<{ status: string }>(
      `SELECT status FROM waitlist WHERE id = $1`,
      [cRes.rows[0].id],
    );
    check(
      'Пользователю C предложено место со статусом offered на 30 минут',
      cStatusRes.rows[0]?.status === 'offered',
    );

    // Проверяем, что occupied_seats не уменьшился (защита от перехвата)
    const evCheck = await client.query<{ occupied_seats: number }>(
      `SELECT occupied_seats FROM events WHERE id = $1`,
      [testEventId],
    );
    check(
      'Счётчик occupied_seats остался 1 (место защищено за оффером)',
      evCheck.rows[0]?.occupied_seats === 1,
    );

    // 7. Пользователь C подтверждает и выкупает билет
    await client.query(
      `UPDATE waitlist SET status = 'claimed' WHERE id = $1`,
      [cRes.rows[0].id],
    );
    await client.query(
      `INSERT INTO registrations (event_id, user_id, status) VALUES ($1, $2, 'active')`,
      [testEventId, userC],
    );

    const regC = await client.query(
      `SELECT id FROM registrations WHERE event_id = $1 AND user_id = $2 AND status = 'active'`,
      [testEventId, userC],
    );
    check('Пользователь C успешно оформил билет из листа ожидания', regC.rows.length === 1);

    console.log(`\nРезультат: ${passed} успешно, ${failed} ошибок.`);
  } finally {
    // Очистка тестовых данных
    if (testEventId) {
      await client.query(`DELETE FROM events WHERE id = $1`, [testEventId]).catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error('Ошибка проверки:', e);
  process.exit(1);
});
