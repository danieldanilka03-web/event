-- Лист ожидания (Waitlist) с автоматическим перераспределением освободившихся мест
-- Дополнение к 0000_init.sql и 0001_seats_and_holds.sql.

DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM ('waiting', 'offered', 'claimed', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
