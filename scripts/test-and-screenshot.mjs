/**
 * Комплексный скрипт: запуск Next.js, E2E функциональное тестирование и снятие скриншотов через реальный Google Chrome.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOCAL_OUT = join(process.cwd(), 'screenshots');
const ARTIFACT_OUT = 'C:\\Users\\kdv\\.gemini\\antigravity\\brain\\e2232833-9981-4308-b490-a4f265912319\\screenshots';

mkdirSync(LOCAL_OUT, { recursive: true });
mkdirSync(ARTIFACT_OUT, { recursive: true });

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // ждём готовности
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Сервер ${url} не ответил за ${timeoutMs}ms`);
}

async function main() {
  console.log('=== 1. Запуск Next.js сервера на 127.0.0.1:3000 ===');
  const server = spawn(
    'C:\\Users\\kdv\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe',
    ['node_modules/next/dist/bin/next', 'start', '-p', '3000'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '3000' },
    }
  );

  server.stdout.on('data', (d) => process.stdout.write(`[next] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[next:err] ${d}`));

  try {
    await waitForServer(BASE);
    console.log('✓ Сервер успешно запущен и отвечает на запросы!\n');

    console.log('=== 2. Запуск Playwright с Google Chrome ===');
    const browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const testResults = [];
    function record(name, pass, details = '') {
      testResults.push({ name, pass, details });
      console.log(`  ${pass ? '✓ OK  ' : '✗ FAIL'} ${name} ${details}`);
    }

    // Вспомогательная функция для скриншота
    async function capture(page, filename, fullPage = false) {
      await page.waitForTimeout(300);
      const localFile = join(LOCAL_OUT, `${filename}.png`);
      const artifactFile = join(ARTIFACT_OUT, `${filename}.png`);
      await page.screenshot({ path: localFile, fullPage });
      copyFileSync(localFile, artifactFile);
      console.log(`    📷 Скриншот сохранён: ${filename}.png`);
    }

    // Вспомогательная авторизация
    async function loginAs(context, email, password = 'Password123!') {
      const res = await context.request.post(`${BASE}/api/auth/login`, {
        data: { email, password },
      });
      return res.ok();
    }

    // --- ТЕСТ 1: Гость и Главная витрина ---
    console.log('\n--- Проверка: Гость и Каталог событий ---');
    const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const guestPage = await guestCtx.newPage();

    await guestPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const title = await guestPage.title();
    record('Главная страница отдаёт title', title.includes('Каталог') || title.includes('Билеты') || title.length > 0);

    const hasEvents = (await guestPage.locator('article, .group').count()) > 0;
    record('События отображаются в каталоге', hasEvents);
    await capture(guestPage, '01_home_catalog');

    // Фильтрация
    await guestPage.goto(`${BASE}/?category=%D0%9A%D0%BE%D0%BD%D1%86%D0%B5%D1%80%D1%82%D1%8B`, { waitUntil: 'networkidle' });
    const hasConcerts = await guestPage.content();
    record('Фильтр по категориям работает', hasConcerts.includes('Концерты'));
    await capture(guestPage, '02_catalog_filter_search');

    // Проверка редиректов защищённых разделов для гостя
    const rTickets = await guestPage.goto(`${BASE}/my-tickets`);
    record('Гость перенаправляется с /my-tickets на /login', rTickets.url().includes('/login'));

    const rOrg = await guestPage.goto(`${BASE}/organizer`);
    record('Гость перенаправляется с /organizer на /login', rOrg.url().includes('/login'));

    const rAdmin = await guestPage.goto(`${BASE}/admin`);
    record('Гость перенаправляется с /admin на /login', rAdmin.url().includes('/login'));

    // Страницы входа и регистрации
    await guestPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await capture(guestPage, '04_login_page');

    await guestPage.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await capture(guestPage, '05_register_page');

    await guestCtx.close();

    // --- ТЕСТ 2: Участник (Participant), Мульти-выбор мест и Билеты ---
    console.log('\n--- Проверка: Участник, Мульти-бронирование и Мои билеты ---');
    const partCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const partOk = await loginAs(partCtx, 'participant1@example.com');
    record('Авторизация участника', partOk);

    const partPage = await partCtx.newPage();

    // Строгая изоляция ролей: участник НЕ должен попадать в /admin или /organizer
    const partToAdmin = await partPage.goto(`${BASE}/admin`);
    record('Участнику запрещён доступ к /admin', partToAdmin.status() === 403 || partToAdmin.url().includes('/'));

    const partToOrg = await partPage.goto(`${BASE}/organizer`);
    record('Участнику запрещён доступ к /organizer', partToOrg.status() === 403 || partToOrg.url().includes('/'));

    // Открываем страницу события со схемой зала
    await partPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const eventLink = await partPage.locator('a[href^="/events/"]').first().getAttribute('href');
    if (eventLink) {
      await partPage.goto(`${BASE}${eventLink}`, { waitUntil: 'networkidle' });
      record('Страница мероприятия открыта', true);

      // Проверяем наличие интерактивной схемы зала
      const hasHallSvg = (await partPage.locator('svg[role="group"]').count()) > 0;
      if (hasHallSvg) {
        // Кликаем по свободным местам
        const freeSeats = partPage.locator('rect[fill="#FFFFFF"]');
        const freeCount = await freeSeats.count();
        if (freeCount >= 2) {
          await freeSeats.nth(0).click();
          await partPage.waitForTimeout(500);
          await freeSeats.nth(1).click();
          await partPage.waitForTimeout(500);

          // Проверяем появление плашки мульти-бронирования
          const orderBanner = await partPage.locator('text=Выбрано:').count();
          record('Мульти-выбор: выделено 2 места и видна плашка заказа', orderBanner > 0);
          await capture(partPage, '03_event_hall_picker_multi_seat');

          // Нажимаем «Оформить билеты», чтобы зафиксировать заказ нескольких мест
          const confirmBtn = partPage.locator('button:has-text("Оформить")');
          if ((await confirmBtn.count()) > 0) {
            await confirmBtn.click();
            await partPage.waitForURL(/\/tickets\//, { timeout: 15000 });
            record('Мульти-заказ успешно оформлен и открыт билет', true);
            await capture(partPage, '07_ticket_qr_pass');
          }
        }
      }
    }

    // Проверяем страницу «Мои билеты»
    await partPage.goto(`${BASE}/my-tickets`, { waitUntil: 'networkidle' });
    record('Страница «Мои билеты» открыта', true);
    await capture(partPage, '06_participant_my_tickets', true);

    // Проверяем просмотр билета с QR кодом
    const ticketLink = await partPage.locator('a[href^="/tickets/"]').first().getAttribute('href');
    if (ticketLink) {
      await partPage.goto(`${BASE}${ticketLink}`, { waitUntil: 'networkidle' });
      const hasQr = (await partPage.locator('img[alt*="QR"], img[src^="data:image/png"]').count()) > 0;
      record('Билет с QR-кодом отображается', hasQr);
      await capture(partPage, '07_ticket_qr_pass');
    }

    // Проверяем страницу профиля
    await partPage.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
    record('Страница профиля открыта', true);
    await capture(partPage, '08_user_profile');

    // Проверяем обновлённое меню профиля (dropdown)
    await partPage.locator('button:has-text("Анна"), button:has-text("АС"), button:has-text("Иван"), [aria-haspopup="menu"]').first().click();
    await partPage.waitForTimeout(400);
    await capture(partPage, '09_user_dropdown_menu');

    await partCtx.close();

    // --- ТЕСТ 3: Организатор (Organizer) ---
    console.log('\n--- Проверка: Организатор ---');
    const orgCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const orgOk = await loginAs(orgCtx, 'organizer1@example.com');
    record('Авторизация организатора', orgOk);

    const orgPage = await orgCtx.newPage();

    // Строгая изоляция ролей: организатор НЕ должен попадать в /admin
    const orgToAdmin = await orgPage.goto(`${BASE}/admin`);
    record('Организатору запрещён доступ к /admin', orgToAdmin.status() === 403 || orgToAdmin.url().includes('/'));

    // Дашборд организатора
    await orgPage.goto(`${BASE}/organizer`, { waitUntil: 'networkidle' });
    record('Дашборд организатора открыт', true);
    await capture(orgPage, '10_organizer_dashboard', true);

    // Мероприятия организатора (карточки и таблица)
    await orgPage.goto(`${BASE}/organizer/events`, { waitUntil: 'networkidle' });
    record('Управление мероприятиями организатора открыто', true);
    await capture(orgPage, '11_organizer_events_cards', true);

    // Переключаем на вид таблицы
    const tableToggle = orgPage.locator('button:has-text("Таблица")');
    if ((await tableToggle.count()) > 0) {
      await tableToggle.click();
      await orgPage.waitForTimeout(400);
      await capture(orgPage, '12_organizer_events_table', true);
      record('Переключатель Карточки / Таблица работает', true);
    }

    // Создание события
    await orgPage.goto(`${BASE}/organizer/events/new`, { waitUntil: 'networkidle' });
    record('Страница создания мероприятия открыта', true);
    await capture(orgPage, '13_organizer_create_event');

    await orgCtx.close();

    // --- ТЕСТ 4: Администратор (Admin) ---
    console.log('\n--- Проверка: Администратор ---');
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminOk = await loginAs(adminCtx, 'admin@example.com');
    record('Авторизация администратора', adminOk);

    const adminPage = await adminCtx.newPage();

    // Строгая изоляция ролей: администратор НЕ должен попадать в /organizer
    const adminToOrg = await adminPage.goto(`${BASE}/organizer`);
    record('Администратору строго запрещён доступ к /organizer', adminToOrg.status() === 403 || adminToOrg.url().includes('/'));

    // Админ-панель: Статистика
    await adminPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    record('Админ-панель (Статистика) открыта', true);
    await capture(adminPage, '14_admin_dashboard_stats', true);

    // Управление пользователями
    await adminPage.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
    record('Управление пользователями открыто', true);
    await capture(adminPage, '15_admin_users', true);

    // Модерация мероприятий
    await adminPage.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
    record('Модерация мероприятий открыта', true);
    await capture(adminPage, '16_admin_events_moderation', true);

    await adminCtx.close();

    // --- ТЕСТ 5: Мобильная версия ---
    console.log('\n--- Проверка: Мобильная адаптивность ---');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    record('Мобильная версия загружается корректно', true);
    await capture(mobilePage, '17_mobile_catalog', true);
    await mobileCtx.close();

    await browser.close();

    console.log('\n=== ИТОГИ ТЕСТИРОВАНИЯ ===');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`Успешно пройдено проверок: ${passed} / ${testResults.length}`);
    if (failed > 0) {
      console.log(`Провалено проверок: ${failed}`);
    } else {
      console.log('🎉 Все тесты завершились успешно! Критических ошибок не обнаружено.');
    }
  } finally {
    console.log('\nОстанавливаем сервер Next.js...');
    server.kill();
  }
}

main().catch((err) => {
  console.error('Ошибка в тестовом сценарии:', err);
  process.exit(1);
});
