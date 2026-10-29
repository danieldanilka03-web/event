import { and, asc, count, desc, eq, gte, ilike, lt, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { events, registrations, seats, users, type EventRow } from '@/server/db/schema';
import { PAGE_SIZE } from '@/shared/constants';
import { escapeIlike } from '@/shared/utils';
import type { CatalogQuery } from '@/shared/validators';

export type EventWithMeta = EventRow & { organizerName: string | null };

export type EventWithParticipants = EventWithMeta & {
  /** Число активных регистраций — нужно для подтверждения удаления. */
  activeParticipants: number;
};

function parseDay(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (!endOfDay) d.setHours(0, 0, 0, 0);
  else d.setHours(23, 59, 59, 999);
  return d;
}

function buildCatalogConditions(query: CatalogQuery) {
  const conditions = [eq(events.status, 'published'), gte(events.startDate, new Date())];
  if (query.q) {
    conditions.push(ilike(events.title, `%${escapeIlike(query.q)}%`));
  }
  if (query.category) {
    conditions.push(eq(events.category, query.category));
  }
  const from = parseDay(query.from, false);
  const to = parseDay(query.to, true);
  if (from) conditions.push(gte(events.startDate, from));
  if (to) conditions.push(lte(events.startDate, to));
  return conditions;
}

export async function getCatalog(query: CatalogQuery): Promise<{
  items: EventWithMeta[];
  total: number;
  totalPages: number;
}> {
  const conditions = buildCatalogConditions(query);

  const rows = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      title: events.title,
      description: events.description,
      category: events.category,
      location: events.location,
      startDate: events.startDate,
      maxSeats: events.maxSeats,
      occupiedSeats: events.occupiedSeats,
      layoutRows: events.layoutRows,
      seatsPerRow: events.seatsPerRow,
      status: events.status,
      createdAt: events.createdAt,
      organizerName: users.fullName,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.organizerId))
    .where(and(...conditions))
    .orderBy(asc(events.startDate))
    .limit(PAGE_SIZE)
    .offset((query.page - 1) * PAGE_SIZE);

  const [totalRow] = await db
    .select({ value: count() })
    .from(events)
    .where(and(...conditions));

  const total = totalRow?.value ?? 0;
  return { items: rows, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getEventById(id: string) {
  const [row] = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      title: events.title,
      description: events.description,
      category: events.category,
      location: events.location,
      startDate: events.startDate,
      maxSeats: events.maxSeats,
      occupiedSeats: events.occupiedSeats,
      layoutRows: events.layoutRows,
      seatsPerRow: events.seatsPerRow,
      status: events.status,
      createdAt: events.createdAt,
      organizerName: users.fullName,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.organizerId))
    .where(eq(events.id, id))
    .limit(1);
  return row ?? null;
}

export async function getRegistrationForUser(eventId: string, userId: string) {
  const [row] = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getUserRegistrationsForEvent(eventId: string, userId: string) {
  return await db
    .select({
      id: registrations.id,
      status: registrations.status,
      seatId: registrations.seatId,
      createdAt: registrations.createdAt,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
    })
    .from(registrations)
    .leftJoin(seats, eq(seats.id, registrations.seatId))
    .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, userId)));
}

export type TicketRow = {
  id: string;
  status: 'active' | 'cancelled';
  createdAt: Date;
  rowLabel: string | null;
  seatNumber: number | null;
  eventId: string;
  title: string;
  category: string;
  location: string;
  startDate: Date;
  eventStatus: 'draft' | 'published' | 'cancelled';
  maxSeats: number;
  occupiedSeats: number;
  organizerName: string | null;
};

export async function getUserTickets(userId: string): Promise<TicketRow[]> {
  const rows = await db
    .select({
      id: registrations.id,
      status: registrations.status,
      createdAt: registrations.createdAt,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
      eventId: events.id,
      title: events.title,
      category: events.category,
      location: events.location,
      startDate: events.startDate,
      eventStatus: events.status,
      maxSeats: events.maxSeats,
      occupiedSeats: events.occupiedSeats,
      organizerName: users.fullName,
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .innerJoin(users, eq(users.id, events.organizerId))
    .leftJoin(seats, eq(seats.id, registrations.seatId))
    .where(eq(registrations.userId, userId))
    .orderBy(asc(events.startDate));

  return rows;
}

export async function getTicketById(registrationId: string): Promise<
  (TicketRow & { organizerId: string; userId: string; userFullName: string; userEmail: string }) | null
> {
  const [row] = await db
    .select({
      id: registrations.id,
      status: registrations.status,
      createdAt: registrations.createdAt,
      userId: registrations.userId,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
      eventId: events.id,
      organizerId: events.organizerId,
      title: events.title,
      category: events.category,
      location: events.location,
      startDate: events.startDate,
      eventStatus: events.status,
      maxSeats: events.maxSeats,
      occupiedSeats: events.occupiedSeats,
      organizerName: users.fullName,
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .innerJoin(users, eq(users.id, events.organizerId))
    .leftJoin(seats, eq(seats.id, registrations.seatId))
    .where(eq(registrations.id, registrationId))
    .limit(1);

  if (!row) return null;
  const [owner] = await db
    .select({ fullName: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  return { ...row, userFullName: owner?.fullName ?? '', userEmail: owner?.email ?? '' };
}

export async function getOrganizerEvents(
  organizerId: string,
  page: number,
  search: string,
): Promise<{ items: EventWithParticipants[]; total: number; totalPages: number }> {
  const conditions = [eq(events.organizerId, organizerId)];
  if (search) conditions.push(ilike(events.title, `%${escapeIlike(search)}%`));

  const rows = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      title: events.title,
      description: events.description,
      category: events.category,
      location: events.location,
      startDate: events.startDate,
      maxSeats: events.maxSeats,
      occupiedSeats: events.occupiedSeats,
      layoutRows: events.layoutRows,
      seatsPerRow: events.seatsPerRow,
      status: events.status,
      createdAt: events.createdAt,
      organizerName: users.fullName,
      activeParticipants: sql<number>`(
        select count(*)::int from registrations r
        where r.event_id = ${events.id} and r.status = 'active'
      )`,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.organizerId))
    .where(and(...conditions))
    .orderBy(desc(events.startDate))
    .limit(10)
    .offset((page - 1) * 10);

  const [totalRow] = await db.select({ value: count() }).from(events).where(and(...conditions));
  const total = totalRow?.value ?? 0;
  return { items: rows, total, totalPages: Math.max(1, Math.ceil(total / 10)) };
}

export async function getOrganizerMetrics(organizerId: string) {
  const [totals] = await db
    .select({
      registrations: count(),
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(and(eq(events.organizerId, organizerId), eq(registrations.status, 'active')));

  const [seats] = await db
    .select({
      free: sql<number>`coalesce(sum(max_seats - occupied_seats), 0)::int`,
      fill: sql<number>`coalesce(round(avg(case when max_seats > 0 then (occupied_seats::numeric / max_seats) * 100 end)), 0)::int`,
    })
    .from(events)
    .where(eq(events.organizerId, organizerId));

  return {
    registrations: totals?.registrations ?? 0,
    freeSeats: seats?.free ?? 0,
    fillPercent: seats?.fill ?? 0,
  };
}

export async function getEventParticipants(eventId: string) {
  return db
    .select({
      id: registrations.id,
      status: registrations.status,
      createdAt: registrations.createdAt,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      rowLabel: seats.rowLabel,
      seatNumber: seats.number,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .leftJoin(seats, eq(seats.id, registrations.seatId))
    .where(eq(registrations.eventId, eventId))
    .orderBy(desc(registrations.createdAt));
}

export async function getAdminMetrics() {
  const [usersRow] = await db.select({ value: count() }).from(users);
  const [publishedRow] = await db
    .select({ value: count() })
    .from(events)
    .where(eq(events.status, 'published'));
  const [regsRow] = await db
    .select({ value: count() })
    .from(registrations)
    .where(eq(registrations.status, 'active'));
  const [upcomingRow] = await db
    .select({ value: count() })
    .from(events)
    .where(and(eq(events.status, 'published'), gte(events.startDate, new Date())));

  return {
    users: usersRow?.value ?? 0,
    publishedEvents: publishedRow?.value ?? 0,
    registrations: regsRow?.value ?? 0,
    upcomingEvents: upcomingRow?.value ?? 0,
  };
}

export async function getAdminUsers(page: number, search: string) {
  const conditions = search ? [ilike(users.fullName, `%${escapeIlike(search)}%`)] : [];
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isBlocked: users.isBlocked,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(users.createdAt))
    .limit(10)
    .offset((page - 1) * 10);

  const [totalRow] = await db
    .select({ value: count() })
    .from(users)
    .where(conditions.length ? and(...conditions) : undefined);

  const total = totalRow?.value ?? 0;
  return { items: rows, total, totalPages: Math.max(1, Math.ceil(total / 10)) };
}

export async function getAdminEvents(page: number) {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      category: events.category,
      startDate: events.startDate,
      status: events.status,
      maxSeats: events.maxSeats,
      occupiedSeats: events.occupiedSeats,
      organizerName: users.fullName,
      organizerId: events.organizerId,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.organizerId))
    .orderBy(desc(events.startDate))
    .limit(10)
    .offset((page - 1) * 10);

  const [totalRow] = await db.select({ value: count() }).from(events);
  const total = totalRow?.value ?? 0;
  return { items: rows, total, totalPages: Math.max(1, Math.ceil(total / 10)) };
}

export async function countActiveParticipants(eventId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'active')));
  return row?.value ?? 0;
}

export async function countAdmins(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.role, 'admin'));
  return row?.value ?? 0;
}

export { or, ne, lt, sql };
