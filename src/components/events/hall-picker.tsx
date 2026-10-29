'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck, Check } from 'lucide-react';
import type { SeatView } from '@/server/db/halls';
import { HOLD_TTL_MINUTES } from '@/shared/hall';
import { holdSeatAction, registerForEventAction, releaseHoldAction } from '@/server/actions/registrations';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/shared/utils';

const SEAT_W = 24;
const SEAT_H = 22;
const GAP_X = 7;
const GAP_Y = 9;
const ROW_LABEL_W = 28;
const SCREEN_H = 44;

const FILLS: Record<SeatView['status'], string> = {
  free: '#FFFFFF',
  mine: '#4F46E5',
  taken: '#E2E8F0',
  held: '#FEF3C7',
};

const STROKES: Record<SeatView['status'], string> = {
  free: '#CBD5E1',
  mine: '#4338CA',
  taken: '#CBD5E1',
  held: '#F59E0B',
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

  const rows = Array.from(rowsMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const maxSeatsInRow = rows.reduce((acc, [, list]) => Math.max(acc, list.length), 0);

  const width = Math.max(340, ROW_LABEL_W + maxSeatsInRow * (SEAT_W + GAP_X) + 16);
  const height = SCREEN_H + rows.length * (SEAT_H + GAP_Y) + 16;

  async function handleSeatClick(seat: SeatView) {
    if (disabled || busy) return;

    if (!isAuthenticated) {
      router.push(`/login?next=/events/${eventId}`);
      return;
    }

    if (isRegistered) {
      toast('Вы уже зарегистрированы на это мероприятие', 'warning');
      return;
    }

    if (seat.status === 'taken') {
      toast('Это место уже занято', 'neutral');
      return;
    }

    if (seat.status === 'held' && seat.id !== selected) {
      toast('Место временно забронировано другим участником', 'warning');
      return;
    }

    if (seat.id === selected) return;

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
    toast(`Место ${seat.rowLabel}-${seat.number} забронировано на ${HOLD_TTL_MINUTES} минут`);
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
    toast(`Место ${seat.rowLabel}-${seat.number} забронировано за вами!`);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Схема зрительного зала
        </p>
        <Legend />
      </div>

      {expiresAt && selectedSeat && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-xs transition-colors',
            remaining < 60000
              ? 'border-rose-300 bg-rose-50 text-rose-900'
              : 'border-amber-300 bg-amber-50/90 text-amber-950',
          )}
          role="status"
        >
          <div className="flex items-center gap-2.5">
            <Clock
              className={cn('h-5 w-5 shrink-0', remaining < 60000 ? 'text-rose-600' : 'text-amber-600')}
              aria-hidden
            />
            <p className="text-sm">
              Выбрано: <strong>Ряд {selectedSeat.rowLabel}, место {selectedSeat.number}</strong>. Бронь держится{' '}
              <strong className="tabular-nums font-mono text-base font-bold underline decoration-amber-400">
                {formatRemaining(remaining)}
              </strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" onClick={release} disabled={busy}>
              Отпустить
            </Button>
            <Button
              size="xs"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
              onClick={() => confirm(selectedSeat)}
              disabled={busy}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {busy ? 'Оформляем…' : 'Подтвердить место'}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-slate-200/90 bg-slate-50/70 p-6 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto h-auto w-full max-w-[560px]"
          role="group"
          aria-label="Схема зала и выбор места"
        >
          <defs>
            <linearGradient id="stageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Сцена */}
          <rect
            x={ROW_LABEL_W - 8}
            y={2}
            width={width - ROW_LABEL_W - 8}
            height={SCREEN_H - 12}
            rx={8}
            fill="url(#stageGrad)"
            stroke="#CBD5E1"
            strokeWidth="1"
          />
          <line
            x1={ROW_LABEL_W + 4}
            y1={4}
            x2={width - 20}
            y2={4}
            stroke="#6366F1"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text
            x={width / 2}
            y={SCREEN_H / 2 + 5}
            textAnchor="middle"
            className="fill-indigo-950 font-bold"
            style={{ fontSize: 10, letterSpacing: '0.12em' }}
          >
            СЦЕНА / ЭКРАН
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
                  className="fill-slate-500 font-semibold"
                  style={{ fontSize: 11 }}
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
                        rx={6}
                        fill={FILLS[seat.status]}
                        stroke={isSelected ? '#4F46E5' : STROKES[seat.status]}
                        strokeWidth={isSelected ? 2.5 : 1}
                        className={cn(clickable && !busy && 'cursor-pointer hover:opacity-85 transition-opacity')}
                        onClick={() => handleSeatClick(seat)}
                      />
                      {seat.category === 'vip' && seat.status === 'free' && (
                        <circle
                          cx={x + SEAT_W / 2}
                          cy={y + SEAT_H / 2 - 4}
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
                          seat.status === 'mine'
                            ? 'fill-white font-bold'
                            : seat.status === 'taken'
                              ? 'fill-slate-400 font-medium'
                              : seat.status === 'held'
                                ? 'fill-amber-900 font-bold'
                                : 'fill-slate-700 font-medium'
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

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        После выбора места оно бронируется за вами на 10 минут. Если не подтвердить регистрацию, бронь автоматически освободится.
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-slate-300 bg-white shadow-2xs" />
        Свободно
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-indigo-600 shadow-2xs" />
        Ваше место
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-amber-100 border border-amber-300 shadow-2xs" />
        В брони
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-slate-200 border border-slate-300 shadow-2xs" />
        Занято
      </span>
    </div>
  );
}
