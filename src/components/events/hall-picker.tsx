'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck, Check, X } from 'lucide-react';
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

function pluralSeats(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} мест`;
  if (mod10 === 1) return `${count} место`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} места`;
  return `${count} мест`;
}

function pluralTickets(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} билетов`;
  if (mod10 === 1) return `${count} билет`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} билета`;
  return `${count} билетов`;
}

type CategoryHallTheme = {
  focusLabel: string;
  subTitle: string;
  lineColor: string;
  gradStart: string;
  gradEnd: string;
  textColor: string;
};

const CATEGORY_HALL_THEMES: Record<string, CategoryHallTheme> = {
  'Спорт': {
    focusLabel: 'ПОЛЕ / АРЕНА СТАДИОНА',
    subTitle: 'Схема трибуны (выберите до 5 мест)',
    lineColor: '#10B981',
    gradStart: 'rgba(16, 185, 129, 0.18)',
    gradEnd: 'rgba(241, 245, 249, 0.9)',
    textColor: 'fill-emerald-950',
  },
  'Конференции': {
    focusLabel: 'ПРЕЗИДИУМ / ЭКРАН ДОКЛАДЧИКА',
    subTitle: 'Схема конференц-зала (выберите до 5 мест)',
    lineColor: '#6366F1',
    gradStart: 'rgba(79, 70, 229, 0.18)',
    gradEnd: 'rgba(241, 245, 249, 0.9)',
    textColor: 'fill-indigo-950',
  },
  'Концерты': {
    focusLabel: 'ГЛАВНАЯ СЦЕНА / МУЗЫКАНТЫ',
    subTitle: 'Схема концертного зала (выберите до 5 мест)',
    lineColor: '#EC4899',
    gradStart: 'rgba(236, 72, 153, 0.18)',
    gradEnd: 'rgba(241, 245, 249, 0.9)',
    textColor: 'fill-pink-950',
  },
  'Мастер-классы': {
    focusLabel: 'СТОЛ ВЕДУЩЕГО / ДЕМО-ЗОНА',
    subTitle: 'Схема мест на воркшопе (выберите до 5 мест)',
    lineColor: '#14B8A6',
    gradStart: 'rgba(20, 184, 166, 0.18)',
    gradEnd: 'rgba(241, 245, 249, 0.9)',
    textColor: 'fill-teal-950',
  },
  'Выставки': {
    focusLabel: 'ЦЕНТРАЛЬНАЯ ЭКСПОЗИЦИЯ',
    subTitle: 'Схема выставочного пространства (выберите до 5 мест)',
    lineColor: '#0EA5E9',
    gradStart: 'rgba(14, 165, 233, 0.18)',
    gradEnd: 'rgba(241, 245, 249, 0.9)',
    textColor: 'fill-sky-950',
  },
  'Образование': {
    focusLabel: 'ДОСКА / КАФЕДРА ПРЕПОДАВАТЕЛЯ',
    subTitle: 'Схема учебной аудитории (выберите до 5 мест)',
    lineColor: '#8B5CF6',
    gradStart: 'rgba(139, 92, 246, 0.18)',
    gradEnd: 'rgba(241, 245, 249, 0.9)',
    textColor: 'fill-purple-950',
  },
  'Другое': {
    focusLabel: 'ГЛАВНАЯ СЦЕНА / ЦЕНТР СОБЫТИЯ',
    subTitle: 'Схема зала (выберите до 5 мест)',
    lineColor: '#6366F1',
    gradStart: 'rgba(79, 70, 229, 0.18)',
    gradEnd: 'rgba(241, 245, 249, 0.9)',
    textColor: 'fill-slate-900',
  },
};

export function HallPicker({
  eventId,
  seats,
  isAuthenticated,
  isPast,
  isUnavailable,
  category,
}: {
  eventId: string;
  seats: SeatView[];
  isAuthenticated: boolean;
  isRegistered?: boolean;
  isPast: boolean;
  isUnavailable: boolean;
  category?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const theme = CATEGORY_HALL_THEMES[category ?? ''] ?? CATEGORY_HALL_THEMES['Другое'];

  // Оптимистичные статусы кресел для мгновенного отклика (0ms latency)
  const [optimisticMine, setOptimisticMine] = React.useState<Record<string, { expiresAt: string }>>({});
  const [optimisticReleased, setOptimisticReleased] = React.useState<Set<string>>(new Set());

  // Синхронизируем с props от сервера
  const effectiveSeats = React.useMemo(() => {
    return seats.map((s) => {
      if (optimisticReleased.has(s.id)) {
        return { ...s, status: 'free' as const, holdExpiresAt: null };
      }
      if (optimisticMine[s.id]) {
        return {
          ...s,
          status: 'mine' as const,
          holdExpiresAt: optimisticMine[s.id].expiresAt,
        };
      }
      return s;
    });
  }, [seats, optimisticMine, optimisticReleased]);

  const mineSeats = React.useMemo(() => effectiveSeats.filter((s) => s.status === 'mine'), [effectiveSeats]);
  const [now, setNow] = React.useState<number>(() => Date.now());
  const [busy, setBusy] = React.useState(false);

  // Вычисляем ближайшее время окончания брони среди выбранных мест
  const earliestExpiry = React.useMemo(() => {
    if (mineSeats.length === 0) return null;
    const timestamps = mineSeats
      .map((s) => (s.holdExpiresAt ? new Date(s.holdExpiresAt).getTime() : null))
      .filter((t): t is number => t !== null);
    return timestamps.length > 0 ? Math.min(...timestamps) : Date.now() + HOLD_TTL_MINUTES * 60 * 1000;
  }, [mineSeats]);

  const disabled = isPast || isUnavailable;

  React.useEffect(() => {
    if (!earliestExpiry) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= earliestExpiry) {
        toast('Время брони части мест истекло', 'danger');
        setOptimisticMine({});
        setOptimisticReleased(new Set());
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [earliestExpiry, router, toast]);

  const rowsMap = new Map<string, SeatView[]>();
  for (const seat of effectiveSeats) {
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

    // Если место уже забронировано мной — повторный клик снимает с него бронь (toggle off)
    if (seat.status === 'mine') {
      // Оптимистично освобождаем
      setOptimisticReleased((prev) => new Set(prev).add(seat.id));
      setOptimisticMine((prev) => {
        const copy = { ...prev };
        delete copy[seat.id];
        return copy;
      });

      setBusy(true);
      await releaseHoldAction(null, { eventId, seatId: seat.id });
      setBusy(false);
      toast(`Место ${seat.rowLabel}-${seat.number} убрано из заказа`);
      router.refresh();
      return;
    }

    if (seat.status === 'taken') {
      toast('Это место уже занято', 'neutral');
      return;
    }

    if (seat.status === 'held') {
      toast('Место временно забронировано другим участником', 'warning');
      return;
    }

    if (mineSeats.length >= 5) {
      toast('Вы можете выбрать максимум 5 мест в одном заказе', 'warning');
      return;
    }

    // Оптимистично бронируем на клиенте сразу
    const expiry = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000).toISOString();
    setOptimisticMine((prev) => ({ ...prev, [seat.id]: { expiresAt: expiry } }));
    setOptimisticReleased((prev) => {
      const copy = new Set(prev);
      copy.delete(seat.id);
      return copy;
    });

    setBusy(true);
    const result = await holdSeatAction(null, { eventId, seatId: seat.id });
    setBusy(false);

    if (!result.ok) {
      // Откатываем оптимистичный статус при ошибке
      setOptimisticMine((prev) => {
        const copy = { ...prev };
        delete copy[seat.id];
        return copy;
      });
      toast(result.error, 'danger');
      router.refresh();
      return;
    }

    toast(`Место ${seat.rowLabel}-${seat.number} забронировано на ${HOLD_TTL_MINUTES} минут`);
    router.refresh();
  }

  async function confirmAll() {
    if (mineSeats.length === 0) return;
    setBusy(true);
    const seatIds = mineSeats.map((s) => s.id);
    const result = await registerForEventAction(null, { eventId, seatIds });
    setBusy(false);
    if (!result.ok) {
      toast(result.error, 'danger');
      router.refresh();
      return;
    }
    toast(`Успешно оформлено: ${pluralTickets(mineSeats.length)}!`);
    setOptimisticMine({});
    setOptimisticReleased(new Set());
    router.push(`/tickets/${result.data.registrationId}`);
    router.refresh();
  }

  async function releaseAll() {
    setOptimisticMine({});
    setOptimisticReleased(new Set(mineSeats.map((s) => s.id)));
    setBusy(true);
    await releaseHoldAction(null, { eventId });
    setBusy(false);
    toast('Все выбранные места освобождены');
    router.refresh();
  }

  const remaining = earliestExpiry ? Math.max(0, earliestExpiry - now) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {theme.subTitle}
        </p>
        <Legend />
      </div>

      {mineSeats.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-4 shadow-md transition-all animate-in fade-in zoom-in-95 duration-200',
            remaining < 60000
              ? 'border-rose-300 bg-rose-50 text-rose-900 shadow-rose-100'
              : 'border-indigo-200/90 bg-indigo-50/90 text-indigo-950 shadow-indigo-100/50',
          )}
          role="status"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs">
                {mineSeats.length}
              </span>
              <div>
                <p className="text-sm font-bold leading-tight">
                  Выбрано: {pluralSeats(mineSeats.length)}
                </p>
                <p className="text-xs text-slate-600 leading-tight mt-0.5">
                  {mineSeats.map((s) => `Ряд ${s.rowLabel}, м.${s.number}`).join(' · ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-xl border border-amber-200">
              <Clock className="h-3.5 w-3.5 text-amber-700" aria-hidden />
              <span>
                Бронь:{' '}
                <strong className="font-mono tabular-nums text-sm font-bold text-amber-950">
                  {formatRemaining(remaining)}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={releaseAll}
              disabled={busy}
              className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Отпустить всё
            </Button>
            <Button
              size="sm"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-bold rounded-xl"
              onClick={confirmAll}
              disabled={busy}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {busy ? 'Оформляем…' : `Оформить ${pluralTickets(mineSeats.length)}`}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-slate-200/90 bg-slate-50/70 p-6 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto h-auto w-full max-w-[560px]"
          role="group"
          aria-label={`Схема рассадки: ${theme.focusLabel}`}
        >
          <defs>
            <linearGradient id="focusGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={theme.gradStart} />
              <stop offset="100%" stopColor={theme.gradEnd} />
            </linearGradient>
          </defs>

          {/* Центральный фокус схемы (Поле / Сцена / Президиум / Экспозиция) */}
          <rect
            x={ROW_LABEL_W - 8}
            y={2}
            width={width - ROW_LABEL_W - 8}
            height={SCREEN_H - 12}
            rx={8}
            fill="url(#focusGrad)"
            stroke="#CBD5E1"
            strokeWidth="1"
          />
          <line
            x1={ROW_LABEL_W + 4}
            y1={4}
            x2={width - 20}
            y2={4}
            stroke={theme.lineColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <text
            x={width / 2}
            y={SCREEN_H / 2 + 5}
            textAnchor="middle"
            className={`${theme.textColor} font-bold`}
            style={{ fontSize: 10, letterSpacing: '0.12em' }}
          >
            {theme.focusLabel}
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
                  const isMine = seat.status === 'mine';
                  const clickable = !disabled && (seat.status === 'free' || isMine);
                  return (
                    <g key={seat.id}>
                      <rect
                        x={x}
                        y={y}
                        width={SEAT_W}
                        height={SEAT_H}
                        rx={6}
                        fill={FILLS[seat.status]}
                        stroke={isMine ? '#4338CA' : STROKES[seat.status]}
                        strokeWidth={isMine ? 2.5 : 1}
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
                          isMine
                            ? 'fill-white font-black'
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

      <p className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        Вы можете выбрать до 5 мест одновременно. Выбранные места бронируются за вами на 10 минут. Повторный клик по выбранному месту убирает его из брони.
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
        <span className="relative flex h-3 w-3 items-center justify-center rounded border border-slate-300 bg-white shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        VIP-место
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-indigo-600 shadow-2xs" />
        Выбрано вами
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
