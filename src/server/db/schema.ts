import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  uniqueIndex,
  check,
  index,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['participant', 'organizer', 'admin']);
export const eventStatus = pgEnum('event_status', ['draft', 'published', 'cancelled']);
export const regStatus = pgEnum('reg_status', ['active', 'cancelled']);
export const seatCategory = pgEnum('seat_category', ['standard', 'vip']);
export const waitlistStatus = pgEnum('waitlist_status', [
  'waiting',
  'offered',
  'claimed',
  'expired',
  'cancelled',
]);
export type WaitlistStatus = 'waiting' | 'offered' | 'claimed' | 'expired' | 'cancelled';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  role: userRole('role').notNull().default('participant'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizerId: uuid('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    location: text('location').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    maxSeats: integer('max_seats').notNull(),
    occupiedSeats: integer('occupied_seats').notNull().default(0),
    status: eventStatus('status').notNull().default('draft'),
    // Раскладка зала. Если null — фиксированной рассадки нет, работает только счётчик мест.
    layoutRows: integer('layout_rows'),
    seatsPerRow: integer('seats_per_row'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('events_max_seats_positive', sql`${t.maxSeats} > 0`),
    check(
      'events_occupied_range',
      sql`${t.occupiedSeats} >= 0 AND ${t.occupiedSeats} <= ${t.maxSeats}`,
    ),
    index('idx_events_status_date').on(t.status, t.startDate),
    index('idx_events_category').on(t.category),
  ],
);

export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: regStatus('status').notNull().default('active'),
    // Выбранное кресло; null для мероприятий без фиксированной рассадки.
    seatId: uuid('seat_id').references(() => seats.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_reg_user').on(t.userId),
    index('idx_reg_event').on(t.eventId),
  ],
);

export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, 'passwordHash'>;
export type EventRow = typeof events.$inferSelect;
export type RegistrationRow = typeof registrations.$inferSelect;
export type SeatRow = typeof seats.$inferSelect;
export type SeatCategory = 'standard' | 'vip';

/**
 * Схема фиксированной рассадки: конкретное кресло мероприятия.
 * Ряд и номер — вместе однозначно идентифицируют место внутри события.
 */
export const seats = pgTable(
  'seats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    rowLabel: text('row_label').notNull(),
    number: integer('number').notNull(),
    category: seatCategory('category').notNull().default('standard'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('seats_event_row_number_uq').on(t.eventId, t.rowLabel, t.number),
    index('idx_seats_event').on(t.eventId),
  ],
);

/**
 * Временная бронь кресла на 10 минут.
 *
 * Действующая бронь (expires_at > now()) блокирует место для всех, включая
 * повторный клик по нему. Истёкшая бронь освобождает место: срабатывает либо
 * ленивая очистка при следующем обращении к залу, либо периодический проход.
 */
export const seatHolds = pgTable(
  'seat_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seatId: uuid('seat_id')
      .notNull()
      .references(() => seats.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Одновременно у кресла может быть только одна незавершённая бронь.
    uniqueIndex('seat_holds_active_uq').on(t.seatId),
    index('idx_holds_event').on(t.eventId),
    index('idx_holds_expiry').on(t.expiresAt),
  ],
);

export type SeatHoldRow = typeof seatHolds.$inferSelect;

/**
 * Лист ожидания (Waitlist) для мероприятий при солдауте.
 *
 * Когда заняты все места, участник может встать в очередь ожидания.
 * При отмене билета освободившееся место автоматически резервируется
 * для следующего участника в очереди со статусом 'offered' на 30 минут.
 */
export const waitlist = pgTable(
  'waitlist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seatId: uuid('seat_id').references(() => seats.id, { onDelete: 'set null' }),
    status: waitlistStatus('status').notNull().default('waiting'),
    priority: integer('priority').notNull().default(0),
    offeredAt: timestamp('offered_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_waitlist_event_queue').on(t.eventId, t.status, t.priority, t.createdAt),
    index('idx_waitlist_user').on(t.userId),
    index('idx_waitlist_expiry').on(t.expiresAt),
  ],
);

export type WaitlistRow = typeof waitlist.$inferSelect;
