'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Users,
  Armchair,
  Download,
  ArrowLeft,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { formatEventDateTime, formatEventTime } from '@/shared/format';
import { shortId } from '@/shared/utils';
import {
  validateAndCheckInTicketAction,
  toggleCheckInStatusAction,
  type CheckInResultData,
} from '@/server/actions/check-in';

export type CheckInParticipant = {
  id: string;
  status: 'active' | 'cancelled';
  checkedInAt: Date | null;
  userId: string;
  fullName: string;
  email: string;
  rowLabel: string | null;
  seatNumber: number | null;
  seatCategory: string | null;
};

type CheckInStatus = 'idle' | 'success' | 'warning' | 'error';

type RecentEntry = {
  id: string;
  fullName: string;
  email: string;
  seatText: string;
  seatCategory: string | null;
  checkedInAt: Date;
};

// Web Audio API синтезатор звуковых сигналов подтверждения/ошибки
function playAudioFeedback(type: 'success' | 'warning' | 'error') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Приятный двухтональный аккорд успеха
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      osc2.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1); // D6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } else if (type === 'warning') {
      // Предупреждение о повторе
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(370, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Ошибка / запрет прохода (низкий гудок)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Аудио контекст не поддерживается или заблокирован политикой браузера
  }
}

export function CheckInClient({
  eventId,
  eventTitle,
  eventDate,
  eventLocation,
  initialParticipants,
}: {
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  eventLocation: string;
  initialParticipants: CheckInParticipant[];
}) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [ticketInput, setTicketInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  // Список участников в памяти для быстрого пересчета и отмены
  const [participants, setParticipants] = React.useState<CheckInParticipant[]>(initialParticipants);

  // Последний результат валидации
  const [feedback, setFeedback] = React.useState<{
    status: CheckInStatus;
    title: string;
    description: string;
    data?: CheckInResultData;
  }>({
    status: 'idle',
    title: 'Готов к сканированию',
    description: 'Наведите сканер на QR-код билета или введите 8-значный код вручную',
  });

  // Расчёт статистики
  const activeParticipants = React.useMemo(
    () => participants.filter((p) => p.status === 'active'),
    [participants],
  );
  const checkedInCount = React.useMemo(
    () => activeParticipants.filter((p) => p.checkedInAt !== null).length,
    [activeParticipants],
  );
  const remainingCount = activeParticipants.length - checkedInCount;
  const progressPercent =
    activeParticipants.length > 0 ? Math.round((checkedInCount / activeParticipants.length) * 100) : 0;

  // Лента недавних проходов (сортировка по времени входа от свежих)
  const recentEntries = React.useMemo(() => {
    return participants
      .filter((p) => p.status === 'active' && p.checkedInAt !== null)
      .sort((a, b) => new Date(b.checkedInAt!).getTime() - new Date(a.checkedInAt!).getTime());
  }, [participants]);

  // Фокусируем поле ввода при загрузке
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleCheckInSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const raw = ticketInput.trim();
    if (!raw) {
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await validateAndCheckInTicketAction(null, {
        eventId,
        ticketCode: raw,
      });

      if (res.ok) {
        if (soundEnabled) playAudioFeedback('success');
        setFeedback({
          status: 'success',
          title: 'ДОСТУП РАЗРЕШЁН',
          description: `Билет успешно зарегистрирован на входе в ${formatEventTime(new Date(res.data.checkedInAt))}`,
          data: res.data,
        });

        // Обновляем локальное состояние
        setParticipants((prev) =>
          prev.map((p) => (p.id === res.data.id ? { ...p, checkedInAt: res.data.checkedInAt } : p)),
        );

        toast(`Вход подтверждён: ${res.data.fullName}`, 'success');
        setTicketInput('');
      } else {
        const errorMsg = res.error || 'Ошибка проверки билета';
        const isDuplicate = errorMsg.includes('уже был использован ранее');

        if (soundEnabled) playAudioFeedback(isDuplicate ? 'warning' : 'error');

        setFeedback({
          status: isDuplicate ? 'warning' : 'error',
          title: isDuplicate ? 'ПОВТОРНЫЙ ПРОХОД!' : 'ПРОХОД ЗАПРЕЩЁН',
          description: errorMsg,
        });

        toast(errorMsg, isDuplicate ? 'warning' : 'danger');
        setTicketInput('');
      }
    } catch (err) {
      if (soundEnabled) playAudioFeedback('error');
      setFeedback({
        status: 'error',
        title: 'СБОЙ СВЯЗИ',
        description: err instanceof Error ? err.message : 'Не удалось связаться с сервером',
      });
    } finally {
      setIsSubmitting(false);
      // Автофокус обратно в поле для непрерывного сканирования потока гостей
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }

  async function handleUndoCheckIn(registrationId: string, guestName: string) {
    try {
      const res = await toggleCheckInStatusAction(null, {
        eventId,
        registrationId,
      });

      if (res.ok) {
        setParticipants((prev) =>
          prev.map((p) => (p.id === registrationId ? { ...p, checkedInAt: null } : p)),
        );
        toast(`Отметка входа для ${guestName} отменена`, 'info');
        if (feedback.data?.id === registrationId) {
          setFeedback({
            status: 'idle',
            title: 'Отметка отменена',
            description: `Вход участника ${guestName} аннулирован. Можно сканировать следующий билет.`,
          });
        }
      } else {
        toast(res.error || 'Не удалось отменить вход', 'danger');
      }
    } catch {
      toast('Ошибка сети при отмене входа', 'danger');
    }
  }

  return (
    <div className="space-y-6">
      {/* Навигационная плашка и звуковой тумблер */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <ButtonLink
            href={`/organizer/events/${eventId}/participants`}
            variant="outline"
            size="sm"
            className="text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> К списку участников
          </ButtonLink>
          <div className="hidden sm:block h-5 w-px bg-slate-200" />
          <div className="text-xs text-slate-500 truncate max-w-md">
            <span className="font-semibold text-slate-900">{eventTitle}</span> ·{' '}
            {formatEventDateTime(eventDate)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
            title={soundEnabled ? 'Звук включён' : 'Звук выключен'}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-600" /> : <VolumeX className="h-3.5 w-3.5" />}
            {soundEnabled ? 'Звук: ВКЛ' : 'Звук: ВЫКЛ'}
          </button>

          <ButtonLink
            href={`/api/events/${eventId}/export`}
            download
            variant="outline"
            size="sm"
            className="text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-slate-500" /> Excel
          </ButtonLink>
        </div>
      </div>

      {/* Информационные плашки статистики прохода */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
            <span>Прошло контроль</span>
            <span className="font-bold text-emerald-600">{progressPercent}%</span>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
            <span className="text-emerald-600">{checkedInCount}</span>
            <span className="text-xs text-slate-400 font-normal">из {activeParticipants.length}</span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 mb-1">Ожидаются на входе</div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {remainingCount}
            <span className="ml-1.5 text-xs text-slate-400 font-normal">человек</span>
          </div>
          <p className="mt-2 text-2xs text-slate-400">Билеты забронированы, но ещё не прошли сканирование</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 mb-1">Всего активных билетов</div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {activeParticipants.length}
          </div>
          <p className="mt-2 text-2xs text-slate-400">
            Локация: <span className="text-slate-600 font-medium">{eventLocation}</span>
          </p>
        </div>
      </div>

      {/* Главный блок сканирования билетов */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleCheckInSubmit} className="space-y-4">
          <label htmlFor="ticket-code-input" className="block text-sm font-bold text-slate-900">
            Сканирование или ввод билета
          </label>
          <div className="relative flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <QrCode className="h-6 w-6 text-indigo-500 animate-pulse" />
              </div>
              <input
                id="ticket-code-input"
                ref={inputRef}
                type="text"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                placeholder="Отсканируйте QR или введите код (напр. BA1F7AAC)..."
                autoComplete="off"
                spellCheck={false}
                disabled={isSubmitting}
                className="w-full rounded-2xl border-2 border-indigo-200/90 bg-indigo-50/20 py-4 pl-13 pr-4 text-base sm:text-lg font-mono font-bold uppercase tracking-wider text-slate-900 placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-indigo-100 transition-all"
              />
              {ticketInput && (
                <button
                  type="button"
                  onClick={() => {
                    setTicketInput('');
                    inputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  Очистить
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !ticketInput.trim()}
              className="h-auto py-4 px-8 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-md transition-all whitespace-nowrap"
            >
              {isSubmitting ? 'Проверка...' : 'Подтвердить вход'}
            </Button>
          </div>
          <p className="text-2xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Поддерживаются любые сканеры QR/штрихкодов, сканирование с телефона или ручной ввод номера брони.
          </p>
        </form>

        {/* Большой визуальный экран обратной связи */}
        <div className="mt-6">
          {feedback.status === 'success' && feedback.data && (
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-6 text-emerald-950 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-widest text-emerald-700 uppercase">
                        {feedback.title}
                      </span>
                      <Badge tone="success" className="text-2xs">Вход зафиксирован</Badge>
                    </div>
                    <h3 className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">
                      {feedback.data.fullName}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{feedback.data.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-center shadow-2xs">
                    <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
                      Место в зале
                    </div>
                    <div className="text-base font-extrabold text-indigo-700 flex items-center justify-center gap-1.5 mt-0.5">
                      <Armchair className="h-4 w-4" />
                      {feedback.data.rowLabel && feedback.data.seatNumber
                        ? `Ряд ${feedback.data.rowLabel}, место ${feedback.data.seatNumber}`
                        : 'Входной билет'}
                    </div>
                    {feedback.data.seatCategory && (
                      <span className="inline-block mt-0.5 text-2xs font-bold text-amber-600">
                        {feedback.data.seatCategory === 'vip' ? '👑 VIP-зона' : 'Стандарт'}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center shadow-2xs">
                    <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
                      Номер билета
                    </div>
                    <div className="text-base font-mono font-bold text-slate-800 mt-0.5">
                      {shortId(feedback.data.id).toUpperCase()}
                    </div>
                    <div className="text-2xs text-slate-400 mt-0.5">
                      {formatEventTime(new Date(feedback.data.checkedInAt))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {feedback.status === 'warning' && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/70 p-6 text-amber-950">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-amber-900 tracking-tight">{feedback.title}</h3>
                  <p className="mt-1 text-sm text-amber-800 font-medium leading-relaxed">
                    {feedback.description}
                  </p>
                  <p className="mt-2 text-xs text-amber-700">
                    Убедитесь, что гость не передал дубликат своего билета другому человеку.
                  </p>
                </div>
              </div>
            </div>
          )}

          {feedback.status === 'error' && (
            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-6 text-rose-950">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/20">
                  <XCircle className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-900 tracking-tight">{feedback.title}</h3>
                  <p className="mt-1 text-sm text-rose-800 font-medium leading-relaxed">
                    {feedback.description}
                  </p>
                  <p className="mt-2 text-xs text-rose-600">
                    Проверьте, зарегистрирован ли гость именно на это событие или проверьте опечатки в номере брони.
                  </p>
                </div>
              </div>
            </div>
          )}

          {feedback.status === 'idle' && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-slate-500">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
                <Ticket className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-700">{feedback.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{feedback.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Журнал недавних проходов через эту точку контроля */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Журнал проходов в зале</h2>
            <p className="text-xs text-slate-500">
              Показывает участников, успешно прошедших входной контроль (всего {recentEntries.length})
            </p>
          </div>
          {recentEntries.length > 0 && (
            <Badge tone="success" className="text-xs font-semibold">
              В зале: {recentEntries.length}
            </Badge>
          )}
        </div>

        {recentEntries.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            На этом мероприятии пока никто не прошёл контроль на входе.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {recentEntries.map((entry) => {
              const seatText =
                entry.rowLabel && entry.seatNumber
                  ? `Ряд ${entry.rowLabel}, место ${entry.seatNumber}`
                  : 'Без места';

              return (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-2 hover:bg-slate-50/80 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{entry.fullName}</span>
                        {entry.seatCategory === 'vip' && (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-2xs font-extrabold text-amber-800">
                            VIP
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-2xs text-slate-400">
                          {shortId(entry.id).toUpperCase()}
                        </span>
                        <span>·</span>
                        <span className="text-indigo-600 font-medium">{seatText}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-xs font-mono text-slate-500">
                      {formatEventTime(new Date(entry.checkedInAt!))}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUndoCheckIn(entry.id, entry.fullName)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-2xs font-medium text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      title="Аннулировать отметку о проходе"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Отменить вход
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
