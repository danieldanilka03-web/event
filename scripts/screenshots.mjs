/**
 * Снимает скриншоты ключевых экранов работающего приложения.
 * Запуск: node scripts/screenshots.mjs [http://localhost:3000]
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = '/workspace/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(name, path, { width = 1440, height = 900, login = null, full = false, prepare, resolvePath } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const page = await context.newPage();

  if (login) {
    await page.goto(`${BASE}/api/auth/login`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const res = await context.request.post(`${BASE}/api/auth/login`, {
      data: { email: login.email, password: login.password ?? 'Password123!' },
    });
    if (!res.ok()) console.warn(`  ! не удалось войти ${login.email}: ${res.status()}`);
  }

  // Некоторые экраны удобнее снимать по вычисленному URL (например, страница билета).
  let target = path;
  if (resolvePath) target = await resolvePath(context);

  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (resolvePath) {
    await page.goto(`${BASE}${target}`, { waitUntil: 'networkidle', timeout: 30000 });
  } else {
    await page.waitForLoadState('networkidle');
  }
  if (prepare) await prepare(page);
  await page.waitForTimeout(600);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: full });
  console.log(`  ok ${name} — ${path}`);
  await context.close();
}

console.log('Снимаю экраны\n');

// Гость
await shot('01-glavnaya', '/');
await shot('02-katalog-filtr', '/?category=%D0%9A%D0%BE%D0%BD%D1%86%D0%B5%D1%80%D1%82%D1%8B', {
  full: true,
});
await shot('03-meropriyatie', '/', {
  resolvePath: async (context) => {
    const html = await (await context.request.get(`${BASE}/`)).text();
    const id = html.match(/\/events\/([0-9a-f-]{36})/)?.[1];
    if (!id) throw new Error('не нашли мероприятие в каталоге');
    return `/events/${id}`;
  },
});
await shot('04-vhod', '/login');
await shot('04b-registraciya', '/register');

// Участник
await shot('05-moi-bilety', '/my-tickets', { login: { email: 'participant1@example.com' } });
await shot('06-bilet-s-qr', '/my-tickets', {
  login: { email: 'participant1@example.com' },
  resolvePath: async (context) => {
    const html = await (await context.request.get(`${BASE}/my-tickets`)).text();
    const id = html.match(/\/tickets\/([0-9a-f-]{36})/)?.[1];
    if (!id) throw new Error('не нашли билет в кабинете');
    return `/tickets/${id}`;
  },
});
await shot('07-profil', '/profile', { login: { email: 'participant1@example.com' } });

// Организатор
await shot('08-organizer-dashboard', '/organizer', {
  login: { email: 'organizer1@example.com' },
  full: true,
});
await shot('09-organizer-sozdanie', '/organizer/events/new', {
  login: { email: 'organizer1@example.com' },
});
await shot('10-organizer-meropriyatiya', '/organizer/events', {
  login: { email: 'organizer1@example.com' },
  full: true,
});

// Админ
await shot('11-admin', '/admin', { login: { email: 'admin@example.com' }, full: true });
await shot('12-admin-polzovateli', '/admin/users', {
  login: { email: 'admin@example.com' },
  full: true,
});
await shot('13-admin-moderaciya', '/admin/events', {
  login: { email: 'admin@example.com' },
  full: true,
});

// Мобильная версия каталога
await shot('14-mobile-katalog', '/', { width: 360, height: 780, full: true });

await browser.close();
console.log('\nГотово. Скриншоты в', OUT);