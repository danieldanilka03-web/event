/**
 * Автоматический запуск миграций и сида базы данных при сборке на Vercel (или при запуске npm run build).
 *
 * Если DATABASE_URL задан:
 *  1. Применяет все SQL-миграции из db/migrations/, которые ещё не применены.
 *  2. Если таблица пользователей users пуста — автоматически запускает db/seed.ts,
 *     чтобы развёрнутый сайт сразу открылся с готовыми тестовыми данными.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import pg from 'pg';

// Читаем локальный .env.local, если есть (при локальном npm run build)
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* используем переменные окружения Vercel */
  }
}

const dbUrl = process.env.DATABASE_URL;

async function run() {
  if (!dbUrl) {
    console.log('[build-migrate] DATABASE_URL не задан, пропускаем авто-миграции.');
    return;
  }

  console.log('[build-migrate] Проверяем состояние базы данных...');
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = join(process.cwd(), 'db', 'migrations');
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[build-migrate] - ${file} уже применена`);
        continue;
      }
      console.log(`[build-migrate] Применяем миграцию: ${file}...`);
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[build-migrate] ✓ ${file} успешно применена`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[build-migrate] Ошибка в миграции ${file}:`, err);
        throw err;
      }
    }

    // Проверяем, нужно ли наполнить пустую базу сидом
    const usersCountRes = await client.query('SELECT count(*) as count FROM users');
    const userCount = parseInt(usersCountRes.rows[0]?.count ?? '0', 10);
    if (userCount === 0) {
      console.log('[build-migrate] База данных пуста. Запускаем наполнение тестовыми данными (db/seed.ts)...');
      try {
        execSync('npx tsx db/seed.ts', { stdio: 'inherit', env: process.env });
        console.log('[build-migrate] ✓ Тестовые данные успешно созданы!');
      } catch (seedErr) {
        console.warn('[build-migrate] Предупреждение при выполнении сида:', seedErr);
      }
    } else {
      console.log(`[build-migrate] База данных уже содержит пользователей (${userCount} чел.), сид не требуется.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error('[build-migrate] Ошибка:', e);
  // Не роняем билд, если база временно недоступна во время preview-сборки
});
