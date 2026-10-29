-- Разрешаем одному пользователю регистрировать несколько билетов/мест на мероприятие.
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_event_user_uq;

-- Предотвращаем двойную запись на ОДНО И ТО ЖЕ место:
CREATE UNIQUE INDEX IF NOT EXISTS registrations_active_seat_uq
  ON registrations (event_id, seat_id)
  WHERE status = 'active' AND seat_id IS NOT NULL;
