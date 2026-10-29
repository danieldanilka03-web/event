# Развёртывание на Vercel + Supabase

Инструкция для текущей версии проекта. Основной путь — **Supabase**: в отличие от Neon
не требует WebSocket-транспорта, поэтому работает через обычный `node-postgres`.

> Если всё же используешь Neon — бери **pooled** строку (с `-pooler` в имени хоста),
> иначе драйвер выберет serverless-ветку и соединение будет подниматься по WebSocket.

## Что нужно

Аккаунты: **GitHub**, **Supabase**, **Vercel**. Больше ничего — ни сервера, ни Docker.

## Шаг 1. Создать проект в Supabase

1. Зарегистрироваться на [supabase.com](https://supabase.com), создать проект
   (free-тариф хватает).
2. Открыть **Project Settings → Database**.
3. Найти **Connection string → URI** и **сбросить пароль** базы
   (**Database → Reset password**, если ещё не задан).

### Какой порт брать — это важно

Бери **сессионный пулер, порт 5432**:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

**Не бери транзакционный пулер (порт 6543).** На нём каждое соединение обслуживается
транзакционно: ломаются prepared statements и `FOR UPDATE`. А на `FOR UPDATE` держится
вся логика брони мест — два клика по одному креслу перестанут выстраиваться в очередь,
и начнут проходить одновременно.

**Не бери и прямой URL** `db.<ref>.supabase.co:5432`. С февраля 2024 он доступен
только по IPv6, а Vercel до IPv6 не подключается. Локально работать будет, на деплое — нет.

## Шаг 2. Применить миграции и заполнить базу

Локально, с `.env.local`:

```bash
cp .env.example .env.local     # вставь свою строку подключения
npm install
npm run db:migrate             # создаст таблицы
npm run db:seed                # тестовые данные
```

Миграции применяются один раз локально — на Vercel их запускать не нужно.

## Шаг 3. Залить код в GitHub

```bash
git init
git add .
git commit -m "event-tickets"
git branch -M main
git remote add origin https://github.com/<твой-логин>/event-tickets.git
git push -u origin main
```

`.env.local` в репозиторий не попадёт — он в `.gitignore`.

## Шаг 4. Импортировать в Vercel

1. [vercel.com/new](https://vercel.com/new) → **Add New → Project**.
2. Выбрать репозиторий `event-tickets`.
3. Framework Preset определится сам как **Next.js**, детектировать вручную ничего не нужно.
4. Перед деплоем нажать **Environment Variables** и задать:

| Переменная | Значение |
| --- | --- |
| `DATABASE_URL` | строка подключения из шага 1 (сессионный пулер, 5432) |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | `https://<твой-домен>.vercel.app` |

Сгенерировать секрет:

```bash
openssl rand -base64 48
```

5. **Deploy**.

## Шаг 5. Обновить домен в QR-кодах

`NEXT_PUBLIC_APP_URL` встраивается в бандл на этапе сборки. Если задал его заранее
как `https://<проект>.vercel.app`, а Vercel выдал другой адрес — нужно передеплоить:

**Settings → Domains** или просто **Redeploy** с обновлённой переменной.

Иначе QR-код на билетах будет вести на несуществующий домен.

## Шаг 6. Проверка

- Зайти на боевой домен, залогиниться тестовым пользователем из README.
- **Обновить страницу зала** — истёкшие брони должны очиститься (ленивая очистка).
- Нажать «Отмена записи» и убедиться, что `occupied_seats` уменьшился
  (`SELECT occupied_seats FROM events LIMIT 1`).
- Проверить, что в Vercel → **Logs** нет ошибок `ECONNREFUSED` / `SSL`
  и `prepared statement "s0" already exists`.

## Возможные проблемы

| Симптом | Причина | Решение |
| --- | --- | --- |
| `ENOTFOUND` / таймаут подключения | взят прямой URL вместо пулера | переключись на `aws-0-...pooler.supabase.com:5432` |
| `prepared statement already exists` | взят транзакционный пулер 6543 | переключись на порт 5432 |
| `too many connections` | слишком много соединений на free-тарифе | это ожидаемо при `max: 5` на локальной машине; на Vercel соединения недолгоживущие |
| QR ведёт не туда | не совпал `NEXT_PUBLIC_APP_URL` | обновить переменную и redeploy |
| Логины не работают, ошибка 500 | не применены миграции | выполнить `npm run db:migrate` локально |
