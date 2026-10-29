import { TIMEZONE } from '@/shared/constants';

/**
 * Все даты отображаются в Europe/Moscow независимо от таймзоны процесса и браузера.
 * В БД время хранится в UTC. Используем Intl с явным timeZone, иначе серверные
 * компоненты (UTC в песочнице/Vercel) и клиентские (Europe/Moscow) показывали бы
 * разное время для одной и той же записи.
 */

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toDate(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

export function formatEventDate(date: Date | string): string {
  return dateFormatter.format(toDate(date));
}

export function formatEventTime(date: Date | string): string {
  return timeFormatter.format(toDate(date));
}

export function formatEventDateTime(date: Date | string): string {
  return dateTimeFormatter.format(toDate(date));
}

export function isPast(date: Date | string): boolean {
  return toDate(date).getTime() <= Date.now();
}

export function seatsInfo(maxSeats: number, occupiedSeats: number) {
  const free = Math.max(0, maxSeats - occupiedSeats);
  if (free === 0) {
    return { free, label: 'Мест нет', tone: 'danger' as const };
  }
  const ratio = free / maxSeats;
  if (ratio <= 0.1) {
    return { free, label: `Осталось ${free} из ${maxSeats}`, tone: 'warning' as const };
  }
  return { free, label: `Осталось ${free} из ${maxSeats}`, tone: 'success' as const };
}

export function fillPercent(maxSeats: number, occupiedSeats: number): number {
  if (maxSeats <= 0) return 0;
  return Math.min(100, Math.round((occupiedSeats / maxSeats) * 100));
}

const MSK_OFFSET_MS = 180 * 60 * 1000; // Europe/Moscow — UTC+3 круглый год

function shiftToMoscow(date: Date): Date {
  return new Date(date.getTime() + MSK_OFFSET_MS);
}

/** Значение для <input type="datetime-local"> в московской таймзоне: yyyy-MM-ddTHH:mm. */
export function toLocalInputValue(date: Date): string {
  return shiftToMoscow(date).toISOString().slice(0, 16);
}

/**
 * Значение из datetime-local приходит без таймзоны. Интерфейс работает в
 * Europe/Moscow, поэтому вход трактуется как московское время и переводится в UTC.
 */
export function fromLocalInputValue(value: string): Date {
  const iso = value.length === 16 ? `${value}:00` : value;
  const asUtc = new Date(`${iso}Z`);
  if (Number.isNaN(asUtc.getTime())) return new Date(NaN);
  return new Date(asUtc.getTime() - MSK_OFFSET_MS);
}

