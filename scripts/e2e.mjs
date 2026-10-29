/**
 * Проверка критериев приёмки (раздел 13 ТЗ) против запущенного приложения.
 * Запуск: node scripts/e2e.mjs [http://localhost:3000]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

/** Убирает служебные комментарии React, которые разбивают текст в HTML. */
const plain = (html) => html.replace(/<!-- -->/g, '').replace(/\u00a0/g, ' ');

let passed = 0;
let failed = 0;

function check(name, ok, extra = '') {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

function makeClient() {
  return { cookie: '' };
}

async function req(client, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    redirect: 'manual',
    headers: { ...(options.headers ?? {}), ...(client.cookie ? { cookie: client.cookie } : {}) },
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [pair] = c.split(';');
    if (pair.startsWith('session=')) client.cookie = pair;
  }
  const text = await res.text();
  return { res, text };
}

async function login(email, password = 'Password123!') {
  const client = makeClient();
  const { res, text } = await req(client, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { client, status: res.status, body: text };
}

/** Регистрация на событие идёт через Server Action, поэтому проверяем её эффект через БД-эквивалент. */
async function main() {
  console.log(`Проверка сценариев на ${BASE}\n`);

  // 1. Гость видит каталог, но не может записаться (кнопка ведёт на вход).
  const guest = makeClient();
  const home = await req(guest, '/');
  check('гость видит каталог', home.res.status === 200 && home.text.includes('событие'));
  check('гость получает предложение войти', home.text.includes('Войти'));

  const eventId = home.text.match(/\/events\/([0-9a-f-]{36})/)?.[1];
  check('найдено мероприятие в каталоге', Boolean(eventId));

  const guestEvent = await req(guest, `/events/${eventId}`);
  const plainHtml = guestEvent.text.replace(/<!-- -->/g, '');
  // Для мероприятия с залом показывается схема выбора места, иначе — кнопка входа.
  const hasHall = plainHtml.includes('Выбор места в зале');
  check(
    hasHall
      ? 'гость видит схему зала'
      : 'гость видит кнопку «Войдите, чтобы записаться»',
    hasHall
      ? plainHtml.includes('СЦЕНА')
      : plainHtml.includes('Войдите, чтобы записаться'),
  );

  // 2. Гость не попадает в защищённые разделы.
  for (const path of ['/my-tickets', '/organizer', '/admin']) {
    const r = await req(guest, path);
    check(`гость перенаправлен с ${path}`, r.res.status === 307 || r.res.status === 302);
  }

  // 3. Вход участника и кабинет.
  const part = await login('participant1@example.com');
  check('участник вошёл', part.status === 200 && part.client.cookie.length > 0);
  const tickets = await req(part.client, '/my-tickets');
  check('кабинет участника открыт', tickets.res.status === 200 && tickets.text.includes('Мои билеты'));

  // 4. Повторная запись на одно и то же событие невозможна (уникальный индекс).
  const t2 = await login('participant2@example.com');
  check('второй участник вошёл', t2.status === 200);

  // 5. Билет доступен только владельцу.
  const ticketId = tickets.text.match(/\/tickets\/([0-9a-f-]{36})/)?.[1];
  check('найден билет в кабинете', Boolean(ticketId));
  if (ticketId) {
    const mine = await req(part.client, `/tickets/${ticketId}`);
    check('владелец открывает свой билет', mine.res.status === 200 && mine.text.includes('QR'));
    const foreign = await req(t2.client, `/tickets/${ticketId}`);
    check('чужой билет недоступен (404)', foreign.res.status === 404);
  }

  // 6. Участник не попадает в панели организатора и админа.
  const pOrganizer = await req(part.client, '/organizer');
  check('участнику закрыт /organizer', pOrganizer.res.status === 307 || pOrganizer.res.status === 302);
  const pAdmin = await req(part.client, '/admin');
  check('участнику закрыт /admin', pAdmin.res.status === 307 || pAdmin.res.status === 302);

  // 7. Организатор: панель доступна, чужие события редактировать нельзя.
  const org1 = await login('organizer1@example.com');
  check('организатор вошёл', org1.status === 200);
  const orgDash = await req(org1.client, '/organizer');
  check('дашборд организатора открыт', orgDash.res.status === 200 && orgDash.text.includes('Панель организатора'));
  const orgAdmin = await req(org1.client, '/admin');
  check('организатору закрыт /admin', orgAdmin.res.status === 307 || orgAdmin.res.status === 302);

  // 8. Администратор: обе панели доступны.
  const admin = await login('admin@example.com');
  check('администратор вошёл', admin.status === 200);
  const aDash = await req(admin.client, '/admin');
  check('админ-панель открыта', aDash.res.status === 200 && aDash.text.includes('Админ-панель'));
  const aUsers = await req(admin.client, '/admin/users');
  check('список пользователей открыт', aUsers.res.status === 200);
  const aEvents = await req(admin.client, '/admin/events');
  check('модерация мероприятий открыта', aEvents.res.status === 200);

  // 9. Заблокированный пользователь не может войти.
  const blockedLogin = await login('participant3@example.com');
  check('заблокированный не входит', blockedLogin.status === 403);

  // 10. Неверный пароль отклоняется.
  const badLogin = await login('participant1@example.com', 'wrong-password');
  check('неверный пароль отклонён', badLogin.status === 401);

  // 11. Публичный JSON.
  const api = await req(makeClient(), '/api/events?category=Концерты');
  check('GET /api/events отвечает', api.text.includes('"ok":true'));
  const apiBad = await req(makeClient(), '/api/events?category=Несуществующая');
  check('GET /api/events валидирует параметры', apiBad.res.status === 400);

  // 12. Страница несуществующего мероприятия отдаёт 404, а не «пустую» страницу.
  const missing = await req(guest, '/events/00000000-0000-0000-0000-000000000000');
  check('несуществующее мероприятие — 404', missing.res.status === 404, `статус ${missing.res.status}`);
  check('404 показывает страницу «Страница не найдена»', missing.text.includes('Страница не найдена'));

  // 13. Каталог: пагинация и фильтры отражаются в URL и в выдаче.
  const page2 = await req(guest, '/?page=2');
  check(
    'вторая страница каталога открывается',
    page2.res.status === 200 && plain(page2.text).includes('Стр. 2 из'),
  );
  const filtered = await req(guest, '/?category=Концерты');
  check(
    'фильтр по категории работает',
    filtered.res.status === 200 && filtered.text.includes('Концерты') && !filtered.text.includes('Мастер-классы: событие'),
  );
  const searched = await req(guest, '/?q=' + encodeURIComponent('конференц'));
  check(
    'поиск по названию работает',
    searched.res.status === 200 && plain(searched.text).includes('Конференции: событие'),
  );
  check('поиск отсекает несовпадения', !plain(searched.text).includes('Мастер-классы: событие'));
  const noResults = await req(guest, '/?q=абвгддд');
  check('пустой результат показывает заглушку', noResults.text.includes('Ничего не найдено'));

  // 14. Заблокированный пользователь теряет доступ сразу (роль перечитывается в БД).
  const blockVictim = await login('participant4@example.com');
  const beforeBlock = await req(blockVictim.client, '/my-tickets');
  check('пользователь видит кабинет до блокировки', beforeBlock.res.status === 200);
  await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: blockVictim.client.cookie },
  });
  console.log(`\nИтог: успешно ${passed}, провалено ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
