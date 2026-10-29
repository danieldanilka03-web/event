export type SeatCategory = 'standard' | 'vip';

/**
 * Раскладка зала по умолчанию. Кресла нумеруются подряд в каждом ряду,
 * ряды подписываются буквами (A, B, C … Z, AA, AB …), как в кинотеатре.
 */
export function rowLabel(index: number): string {
  let label = '';
  let num = index;
  while (num >= 0) {
    label = String.fromCharCode(65 + (num % 26)) + label;
    num = Math.floor(num / 26) - 1;
  }
  return label;
}

export type SeatPosition = { rowLabel: string; number: number; category: SeatCategory };

export type Layout = { rows: number; seatsPerRow: number };

/**
 * Строит список кресел по раскладке.
 *
 * Последний ряд может быть неполным: всего кресел ровно maxSeats, чтобы
 * счётчик мест в БД и фактическое количество кресел в зале совпадали.
 */
export function buildSeats(layout: Layout, maxSeats?: number): SeatPosition[] {
  const seats: SeatPosition[] = [];
  for (let r = 0; r < layout.rows; r++) {
    // Первые два ряда — VIP, остальные стандарт.
    const category: SeatCategory = r < 2 ? 'vip' : 'standard';
    for (let n = 1; n <= layout.seatsPerRow; n++) {
      if (maxSeats !== undefined && seats.length >= maxSeats) return seats;
      seats.push({ rowLabel: rowLabel(r), number: n, category });
    }
  }
  return seats;
}

/** Подбирает раскладку под требуемое число мест (ряды по 10 кресел). */
export function layoutForSeats(maxSeats: number): Layout | null {
  if (maxSeats < 1) return null;
  const rows = Math.max(1, Math.ceil(maxSeats / 10));
  const seatsPerRow = Math.ceil(maxSeats / rows);
  return { rows, seatsPerRow };
}

export const HOLD_TTL_MINUTES = 10;