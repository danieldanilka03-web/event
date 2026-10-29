-- Фиксированная рассадка: кресла мероприятия и временные брони с TTL.
-- Дополнение к 0000_init.sql.

DO $$ BEGIN
  CREATE TYPE seat_category AS ENUM ('standard', 'vip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Раскладка зала. NULL в обоих полях = фиксированной рассадки нет.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS layout_rows integer,
  ADD COLUMN IF NOT EXISTS seats_per_row integer;

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

-- Выбранное кресло в регистрации. NULL для мероприятий без рассадки.
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS seat_id uuid REFERENCES seats(id) ON DELETE SET NULL;

-- Временная бронь на 10 минут. UNIQUE(seat_id) не даёт двум пользователям
-- одновременно забронировать одно кресло.
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