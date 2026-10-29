/** Скриншоты схемы зала и билета с местом. */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = '/workspace/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function withUser(fn, email) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const res = await context.request.post(`${BASE}/api/auth/login`, {
    data: { email, password: 'Password123!' },
  });
  if (!res.ok()) throw new Error(`не удалось войти ${email}`);
  await fn(context);
  await context.close();
}

const api = await fetch(`${BASE}/api/events`);
const catalog = (await api.json()).data.items;
const hallEvents = catalog.filter((e) => e.hasHall);
console.log('Мероприятия с залом:', hallEvents.length);

// 1. Схема зала для гостя
await withUser(async (context) => {
  const page = await context.newPage();
  await page.goto(`${BASE}/events/${hallEvents[2].id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/20-zal-gost.png`, fullPage: true });
  console.log('  ok 20-zal-gost');
}, 'participant5@example.com');

// 2. Схема зала + выбор кресла (участник)
await withUser(async (context) => {
  const page = await context.newPage();
  await page.goto(`${BASE}/events/${hallEvents[2].id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  // Кликаем первое свободное кресло
  const seat = page.locator('svg rect[fill="#FFFFFF"]').first();
  await seat.click({ force: true });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/21-zal-bron.png`, fullPage: true });
  console.log('  ok 21-zal-bron');
}, 'participant4@example.com');

// 3. Билет с местом
await withUser(async (context) => {
  const regs = await (await context.request.get(`${BASE}/api/registrations`)).json();
  const withSeat = regs.data.find((r) => r.seat);
  if (!withSeat) {
    console.log('  ! нет регистрации с местом');
    return;
  }
  const page = await context.newPage();
  await page.goto(`${BASE}/tickets/${withSeat.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/22-bilet-s-mestom.png`, fullPage: true });
  console.log('  ok 22-bilet-s-mestom — место', withSeat.seat.row, withSeat.seat.number);
}, 'participant5@example.com');

// 4. Мобильная схема зала
await withUser(async (context) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${BASE}/events/${hallEvents[2].id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/23-zal-mobile.png`, fullPage: true });
  console.log('  ok 23-zal-mobile');
}, 'participant4@example.com');

await browser.close();
console.log('Готово');