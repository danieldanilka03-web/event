# Event Tickets — карта проекта

Next.js 15 (App Router) + TypeScript + Drizzle ORM (Neon) + Tailwind 4.
Модуль: продажа билетов на мероприятия с выбором мест в зале, QR-билетами и админкой.

## Структура

```
event-tickets/
├── src/
│   ├── app/                 # Роутинг Next.js. Правило: только page.tsx / route.ts / layout
│   │   ├── (public)/        #   публичная часть: главная, каталог, логин, регистрация
│   │   ├── (participant)/   #   личный кабинет: мои билеты, профиль, билет по QR
│   │   ├── (organizer)/     #   кабинет организатора: свои события, участники, лист ожидания
│   │   ├── (admin)/         #   админка: события, пользователи
│   │   └── api/             #   REST-роуты (/auth, /events, /registrations)
│   │
│   ├── components/          # Клиентские компоненты по доменам
│   │   ├── ui/              #   примитивы: Button, Card, Dialog, Table, Toast, Badge, Input
│   │   ├── layout/          #   Header, Footer, DashboardShell, UserMenu, MobileMenu
│   │   ├── events/          #   EventCard, EventForm, EventFilters, HallPicker, RegisterButton, WaitlistSection, ActiveOffersBanner
│   │   ├── tickets/         #   PrintButton, генератор QR
│   │   └── tables/          #   Pagination
│   │
│   ├── server/              # ТОЛЬКО серверный код. Никогда не импортировать в клиент
│   │   ├── db/              #   schema.ts, queries.ts, halls.ts, waitlist.ts, index.ts (подключение)
│   │   ├── auth/            #   jwt.ts, session.ts, guards.ts (проверка ролей)
│   │   ├── actions/         #   Server Actions: auth, events, registrations, waitlist, admin
│   │   └── api/             #   helpers.ts (ответы API)
│   │
│   ├── shared/              # Изоморфный код — можно и в клиент, и в сервер
│   │   ├── validators/      #   Zod-схемы форм
│   │   ├── format/          #   форматирование дат, цен, статусов
│   │   ├── hall.ts          #   логика залов и мест
│   │   ├── waitlist.ts      #   типы и константы листа ожидания
│   │   ├── constants.ts     #   константы
│   │   └── utils.ts         #   cn() и утилиты
│   │
│   └── middleware.ts        # защита маршрутов по роли
│
├── db/
│   ├── migrations/          # SQL-миграции
│   └── seed.ts              # наполнение тестовыми данными
│
├── scripts/                 # утилиты: миграции, e2e, скриншоты, проверки
├── public/                  # статика
└── drizzle.config.ts        # конфиг Drizzle ORM
```

## Правило разделения слоёв

| Слой | Что можно импортировать |
|---|---|
| `app/` | `components/`, `server/`, `shared/` |
| `components/` | только `components/`, `shared/` |
| `server/` | `server/`, `shared/` |
| `shared/` | ничего |

Ключевое правило: **`components/` никогда не импортирует `server/`** — иначе `server-only` уронит клиентский билд.

## Алиасы импортов

Всё через алиас `@/*` → `src/*`. Относительные пути — только внутри одной папки.

```ts
import { Button }        from '@/components/ui/button';
import { requireAdmin }  from '@/server/auth/guards';
import { cn }            from '@/shared/utils';
```

## Команды

```bash
npm run dev            # dev-сервер
npm run build          # продакшн-сборка
npm run typecheck      # проверка типов
npm run lint           # ESLint
npm run db:migrate     # применить миграции
npm run db:seed        # заполнить БД
npm run check:e2e      # e2e-проверки
```

## Окружение

Скопируйте `.env.example` → `.env` и заполните:

- `DATABASE_URL` — строка подключения Neon
- `JWT_SECRET` — секрет для подписи токенов
