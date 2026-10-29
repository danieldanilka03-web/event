'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Armchair } from 'lucide-react';
import type { SeatView } from '@/server/db/halls';
import { HOLD_TTL_MINUTES } from '@/shared/hall';
import { holdSeatAction, registerForEventAction, releaseHoldAction } from '@/server/actions/registrations';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/shared/utils';

const SEAT_W = 22;
const SEAT_H = 20;
const GAP_X = 6;
const GAP_Y = 8;
const ROW_LABEL_W = 26;
const SCREEN_H = 40;

const FILLS: Record<SeatView['status'], string> = {
  free: '#FFFFFF',
  mine: '#4F46E5',
  taken: '#CBD5E1',
  held: '#F59E0B',
};

const STROKES: Record<SeatView['status'], string> = {
  free: '#94A3B8',
  mine: '#4338CA',
  taken: '#94A3B8',
  held: '#B45309',
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Интерактивная схема зала: кресла рисуются SVG, клик по свободному креслу
 * создаёт временную бронь на 10 минут с обратным отсчётом.
 */
export function HallPicker({
  eventId,
  seats,
  isAuthenticated,
  isRegistered,
  isPast,
  isUnavailable,
}: {
  eventId: string;
  seats: SeatView[];
  isAuthenticated: boolean;
  isRegistered: boolean;
  isPast: boolean;
  isUnavailable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const initialMineSeat = React.useMemo(() => seats.find((s) => s.status === 'mine'), [seats]);
  const [selected, setSelected] = React.useState<string | null>(() => initialMineSeat?.id ?? null);
  const [expiresAt, setExpiresAt] = React.useState<number | null>(() =>
    initialMineSeat?.holdExpiresAt ? new Date(initialMineSeat.holdExpiresAt).getTime() : null,
  );
  const [now, setNow] = React.useState<number>(() => Date.now());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (initialMineSeat && !selected) {
      setSelected(initialMineSeat.id);
      if (initialMineSeat.holdExpiresAt) {
        setExpiresAt(new Date(initialMineSeat.holdExpiresAt).getTime());
      }
    }
  }, [initialMineSeat, selected]);

  const disabled = isPast || isUnavailable;

  // Обратный отсчёт: раз в секунду. На нуле бронь снимается, место снова свободно.
  React.useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresAt) {
        setExpiresAt(null);
        setSelected(null);
        toast('Время брони истекло, место снова свободно', 'danger');
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, router, toast]);

  const rowsMap = new Map<string, SeatView[]>();
  for (const seat of seats) {
    const arr = rowsMap.get(seat.rowLabel) ?? [];
    arr.push(seat);
    rowsMap.set(seat.rowLabel, arr);
  }
  const rows = [...rowsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const perRow = Math.max(...rows.map(([, list]) => list.length));

  const width = ROW_LABEL_W + perRow * (SEAT_W + GAP_X) + 16;
  const height = SCREEN_H + rows.length * (SEAT_H + GAP_Y) + 12;

  async function handleSeatClick(seat: SeatView) {
    if (disabled || busy) return;
    if (!isAuthenticated) {
      toast('Войдите в систему, чтобы забронировать место', 'danger');
      router.push(`/login?next=/events/${eventId}`);
      return;
    }
    if (isRegistered) {
      toast('Вы уже зарегистрированы на это мероприятие');
      return;
    }
    if (seat.status === 'taken') {
      toast('Это место уже занято', 'danger');
      return;
    }
    if (seat.status === 'held') {
      toast('Это место сейчас забронировано другим участником', 'danger');
      return;
    }

    if (seat.status === 'mine') {
      // Повторный клик по своей брони — подтверждаем регистрацию.
      await confirm(seat);
      return;
    }

    setBusy(true);
    const result = await holdSeatAction(null, { eventId, seatId: seat.id });
    setBusy(false);
    if (!result.ok) {
      toast(result.error, 'danger');
      router.refresh();
      return;
    }
    setSelected(seat.id);
    setExpiresAt(new Date(result.data.expiresAt).getTime());
    setNow(Date.now());
    router.refresh();
  }

  async function confirm(seat: SeatView) {
    setBusy(true);
    const result = await registerForEventAction(null, { eventId, seatId: seat.id });
    setBusy(false);
    if (!result.ok) {
      toast(result.error, 'danger');
      setSelected(null);
      setExpiresAt(null);
      router.refresh();
      return;
    }
    toast(`Место ${seat.rowLabel}-${seat.number} забронировано за вами`);
    setSelected(null);
    setExpiresAt(null);
    router.push(`/tickets/${result.data.registrationId}`);
    router.refresh();
  }

  async function release() {
    setBusy(true);
    await releaseHoldAction(null, { eventId });
    setBusy(false);
    setSelected(null);
    setExpiresAt(null);
    toast('Бронь снята');
    router.refresh();
  }

  const selectedSeat = seats.find((s) => s.id === selected) ?? null;
  const remaining = expiresAt ? expiresAt - now : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted-fg)]">
          Выберите место в зале
        </p>
        <Legend />
      </div>

      {expiresAt && selectedSeat && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-xl border p-3',
            remaining < 60000
              ? 'border-red-200 bg-red-50'
              : 'border-amber-200 bg-amber-50',
          )}
          role="status"
        >
          <Clock
            className={cn('h-5 w-5', remaining < 60000 ? 'text-red-600' : 'text-amber-600')}
            aria-hidden
          />
          <p className="text-sm">
            Место <strong>{selectedSeat.rowLabel}-{selectedSeat.number}</strong> забронировано за вами
            на <strong className="tabular-nums">{formatRemaining(remaining)}</strong>
          </p>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={release} disabled={busy}>
              Отпустить
            </Button>
            <Button size="sm" onClick={() => confirm(selectedSeat)} disabled={busy}>
              {busy ? 'Оформляем…' : 'Подтвердить'}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border-ui)] bg-white p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto h-auto w-full max-w-[560px]"
          role="group"
          aria-label="Схема зала и выбор места"
        >
          {/* Сцена */}
          <rect
            x={ROW_LABEL_W - 8}
            y={2}
            width={width - ROW_LABEL_W - 8}
            height={SCREEN_H - 10}
            rx={6}
            fill="#E2E8F0"
          />
          <text
            x={width / 2}
            y={SCREEN_H / 2 + 8}
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            СЦЕНА
          </text>

          {rows.map(([label, list], rIndex) => {
            const y = SCREEN_H + rIndex * (SEAT_H + GAP_Y);
            const sorted = [...list].sort((a, b) => a.number - b.number);
            return (
              <g key={label}>
                <text
                  x={ROW_LABEL_W - 14}
                  y={y + SEAT_H / 2 + 4}
                  textAnchor="end"
                  className="fill-slate-500"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {label}
                </text>
                {sorted.map((seat, seatIndex) => {
                  const x = ROW_LABEL_W + seatIndex * (SEAT_W + GAP_X);
                  const isSelected = selected === seat.id;
                  const clickable = !disabled && (seat.status === 'free' || seat.status === 'mine');
                  return (
                    <g key={seat.id}>
                      <rect
                        x={x}
                        y={y}
                        width={SEAT_W}
                        height={SEAT_H}
                        rx={5}
                        fill={FILLS[seat.status]}
                        stroke={isSelected ? '#4F46E5' : STROKES[seat.status]}
                        strokeWidth={isSelected ? 2.5 : 1}
                        className={cn(clickable && !busy && 'cursor-pointer hover:opacity-80')}
                        onClick={() => handleSeatClick(seat)}
                      />
                      {seat.category === 'vip' && seat.status === 'free' && (
                        // Декоративный маркер VIP не должен перехватывать клик по креслу.
                        <circle
                          cx={x + SEAT_W / 2}
                          cy={y + SEAT_H / 2}
                          r={2}
                          fill="#F59E0B"
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                      <text
                        x={x + SEAT_W / 2}
                        y={y + SEAT_H / 2 + 4}
                        textAnchor="middle"
                        style={{ fontSize: 9, pointerEvents: 'none' }}
                        className={
                          seat.status === 'taken'
                            ? 'fill-slate-400'
                            : seat.status === 'held'
                              ? 'fill-amber-800'
                              : 'fill-slate-600'
                        }
                      >
                        {seat.number}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="flex items-start gap-2 text-sm text-[var(--muted-fg)]">
        <Armchair className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        После выбора место бронируется на {HOLD_TTL_MINUTES} минут. Если не подтвердить
        регистрацию за это время, бронь аннулируется и место вернётся в свободные.
      </p>
    </div>
  );
}

function Legend() {
  const items: Array<{ color: string; label: string }> = [
    { color: '#FFFFFF', label: 'Свободно' },
    { color: '#4F46E5', label: 'Ваше место' },
    { color: '#F59E0B', label: 'В брони' },
    { color: '#CBD5E1', label: 'Занято' },
  ];
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-[var(--muted-fg)]">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded border border-slate-400"
            style={{ background: i.color }}
            aria-hidden
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}