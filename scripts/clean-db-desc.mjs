import pg from 'pg';
import { readFileSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const res = await pool.query(`
    UPDATE events 
    SET description = 'Официальное мероприятие платформы. Подробная программа выступлений, ведущие эксперты и интерактивное расписание. Бронируйте места заранее — количество билетов ограничено.'
    WHERE description LIKE '%курсов%'
  `);
  console.log('Обновлено описаний событий в живой базе данных:', res.rowCount);
  await pool.end();
}

run().catch(console.error);
