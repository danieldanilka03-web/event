/**
 * Собирает статический снимок работающего приложения для превью.
 *
 * Обходит страницы с реальной базой (в том числе закрытые — с авторизацией),
 * сохраняет отрендеренный HTML и локальные ассеты (CSS, шрифты, картинки).
 * Все внутренние ссылки переводятся в абсолютные пути с расширением .html,
 * чтобы навигация работала офлайн на любом хостинге.
 *
 * Клиентские скрипты вырезаются: в статике формы всё равно не работают,
 * а страница остаётся чистой и без ошибок в консоли.
 *
 * Запуск: node scripts/build-preview.mjs http://localhost:3000 /workspace/preview
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? '/workspace/preview';

async function login(email, password = 'Password123!') {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
  if (!cookie) throw new Error(`не удалось войти: ${email} (${res.status})`);
  return cookie;
}

async function get(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  return { status: res.status, text: await res.text() };
}

/** Маршрут → путь файла в снимке. */
function routeToFile(route) {
  const clean = route.split('?')[0].split('#')[0];
  if (clean === '' || clean === '/') return '/index.html';
  if (clean.endsWith('/')) return `${clean}index.html`;
  return `${clean}.html`;
}

/** Собирает внутренние ссылки из HTML: только пути сайта, без внешних URL и якорей. */
function internalLinks(html) {
  const found = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (/^[a-z]+:\/\//i.test(href)) continue;
    found.add(href);
  }
  return found;
}

const participant = await login('participant1@example.com');
const organizer = await login('organizer1@example.com');
const admin = await login('admin@example.com');

// Стартовые страницы: гость, участник, организатор, админ.
const SEED_ROUTES = [
  ['/', null],
  ['/login', null],
  ['/register', null],
  ['/my-tickets', participant],
  ['/profile', participant],
  ['/organizer', organizer],
  ['/organizer/events', organizer],
  ['/organizer/events/new', organizer],
  ['/admin', admin],
  ['/admin/users', admin],
  ['/admin/events', admin],
];

/** Какой cookie использовать для маршрута: подбираем по префиксу. */
function cookieFor(route) {
  if (route.startsWith('/admin')) return admin;
  if (route.startsWith('/organizer')) return organizer;
  if (route.startsWith('/my-tickets') || route.startsWith('/tickets') || route.startsWith('/profile')) {
    return participant;
  }
  return null;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const queue = SEED_ROUTES.map(([route, cookie]) => ({ route, cookie }));
const visited = new Set();
const assets = new Set();
const pages = [];

while (queue.length) {
  const { route, cookie } = queue.shift();
  const file = routeToFile(route);
  if (visited.has(file)) continue;
  visited.add(file);

  const { status, text } = await get(route, cookie);
  if (status !== 200) {
    console.log(`  пропущен ${route} — статус ${status}`);
    continue;
  }

  let html = text;

  // Вырезаем клиентские скрипты: в статическом снимке они не работают.
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  // Переписываем внутренние ссылки на абсолютные .html-пути.
  const links = internalLinks(html);
  for (const href of links) {
    if (href.startsWith('/_next/') || href.startsWith('/favicon')) continue;
    const target = href.startsWith('/') ? href : `/${href}`;
    const targetFile = routeToFile(target);
    html = html.split(`href="${href}"`).join(`href="${targetFile}"`);
    // Планируем обход найденных страниц.
    if (!visited.has(targetFile) && !href.startsWith('/api/')) {
      queue.push({ route: target.split('?')[0], cookie: cookieFor(target) });
    }
  }

  // Собираем локальные ассеты.
  for (const m of html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)) {
    assets.add(m[1]);
  }

  const dest = join(OUT, file);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, html, 'utf8');
  pages.push({ file, route });
  console.log(`  ok ${file} ← ${route}`);
}

// Скачиваем ассеты, сохраняя структуру путей.
let downloaded = 0;
for (const asset of assets) {
  const res = await fetch(`${BASE}${asset}`);
  if (!res.ok) continue;
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = join(OUT, asset);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  downloaded++;
}
console.log(`  ассетов скачано: ${downloaded}`);

// Шрифты и картинки, на которые ссылается CSS, лежат в /_next/static/media.
const cssFiles = [...assets].filter((a) => a.endsWith('.css'));
const media = new Set();
for (const css of cssFiles) {
  const res = await fetch(`${BASE}${css}`);
  if (!res.ok) continue;
  const text = await res.text();
  for (const m of text.matchAll(/url\(\s*['"]?(\/_next\/static\/[^)'"]+)['"]?\s*\)/g)) {
    media.add(m[1]);
  }
}
let mediaCount = 0;
for (const file of media) {
  if (assets.has(file)) continue;
  const res = await fetch(`${BASE}${file}`);
  if (!res.ok) continue;
  const dest = join(OUT, file);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  mediaCount++;
}
console.log(`  файлов из CSS (шрифты, картинки): ${mediaCount}`);

// Favicon из public/.
try {
  const res = await fetch(`${BASE}/favicon.ico`);
  if (res.ok) {
    await writeFile(join(OUT, 'favicon.ico'), Buffer.from(await res.arrayBuffer()));
  }
} catch {
  /* не критично */
}

await writeFile(
  join(OUT, 'preview.json'),
  JSON.stringify({ base: BASE, pages, assets: downloaded }, null, 2),
  'utf8',
);

console.log(`\nГотово: ${pages.length} страниц, ${downloaded} ассетов → ${OUT}`);
