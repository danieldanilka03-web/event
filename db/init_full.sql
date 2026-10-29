-- ====================================================================
-- Полный SQL-скрипт инициализации проекта «Управление мероприятиями»
-- Можно скопировать и запустить прямо в Neon SQL Editor!
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Типы данных (Enums)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('participant', 'organizer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reg_status AS ENUM ('active', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE seat_category AS ENUM ('standard', 'vip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM ('waiting', 'offered', 'claimed', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Таблицы
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  phone         text,
  role          user_role NOT NULL DEFAULT 'participant',
  is_blocked    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text NOT NULL,
  category        text NOT NULL,
  location        text NOT NULL,
  start_date      timestamptz NOT NULL,
  max_seats       integer NOT NULL CHECK (max_seats > 0),
  occupied_seats  integer NOT NULL DEFAULT 0,
  status          event_status NOT NULL DEFAULT 'draft',
  layout_rows     integer,
  seats_per_row   integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_occupied_range CHECK (occupied_seats >= 0 AND occupied_seats <= max_seats)
);

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, start_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

CREATE TABLE IF NOT EXISTS seats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  row_label  text NOT NULL,
  number     integer NOT NULL CHECK (number > 0),
  category   seat_category NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seats_event_row_number_uq UNIQUE (event_id, row_label, number)
);

CREATE INDEX IF NOT EXISTS idx_seats_event ON seats(event_id);

CREATE TABLE IF NOT EXISTS registrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_id     uuid REFERENCES seats(id) ON DELETE SET NULL,
  status      reg_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registrations_event_user_uq UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);

CREATE TABLE IF NOT EXISTS seat_holds (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id    uuid NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seat_holds_active_uq UNIQUE (seat_id)
);

CREATE INDEX IF NOT EXISTS idx_holds_event ON seat_holds(event_id);
CREATE INDEX IF NOT EXISTS idx_holds_expiry ON seat_holds(expires_at);

CREATE TABLE IF NOT EXISTS waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_id     uuid REFERENCES seats(id) ON DELETE SET NULL,
  status      waitlist_status NOT NULL DEFAULT 'waiting',
  priority    integer NOT NULL DEFAULT 0,
  offered_at  timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_event_queue ON waitlist(event_id, status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_expiry ON waitlist(expires_at);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (name) VALUES
  ('0000_init.sql'),
  ('0001_seats_and_holds.sql'),
  ('0002_waitlist.sql')
ON CONFLICT (name) DO NOTHING;
