'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  Printer,
  QrCode,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  Ban,
  Armchair,
  Filter,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { formatEventDate, formatEventDateTime, formatEventTime } from '@/shared/format';
import { shortId } from '@/shared/utils';
import { toggleCheckInStatusAction } from '@/server/actions/check-in';

export type ParticipantItem = {
  id: string;
  status: 'active' | 'cancelled';
  checkedInAt: Date | null;
  createdAt: Date;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  rowLabel: string | null;
  seatNumber: number | null;
  seatCategory: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function ParticipantsClient({
  eventId,
  eventTitle,
  hasLayout,
  initialParticipants,
}: {
  eventId: string;
  eventTitle: string;
  hasLayout: boolean;
  initialParticipants: ParticipantItem[];
}) {
  const [participants, setParticipants] = React.useState<ParticipantItem[]>(initialParticipants);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'checkedIn' | 'waiting' | 'cancelled'>('all');
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const toast = useToast();

  // Обновляем при изменении props от сервера
  React.useEffect(() => {
    setParticipants(initialParticipants);
  }, [initialParticipants]);

  const active = participants.filter((p) => p.status === 'active');
  const checkedIn = active.filter((p) => Boolean(p.checkedInAt));
  const waiting = active.filter((p) => !p.checkedInAt);
  const cancelled = participants.filter((p) => p.status === 'cancelled');

  const checkInPercent = active.length > 0 ? Math.round((checkedIn.length / active.length) * 100) : 0;

  // Фильтрация
  const filtered = participants.filter((p) => {
    if (filter === 'checkedIn' && (!p.checkedInAt || p.status !== 'active')) return false;
    if (filter === 'waiting' && (p.checkedInAt || p.status !== 'active')) return false;
    if (filter === 'cancelled' && p.status !== 'cancelled') return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const seatStr = `${p.rowLabel ?? ''} ${p.seatNumber ?? ''}`.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      seatStr.includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  async function handleToggleCheckIn(p: ParticipantItem) {
    if (p.status === 'cancelled') return;
    setPendingId(p.id);
    const result = await toggleCheckInStatusAction(null, {
      registrationId: p.id,
      eventId,
    });
    setPendingId(null);

    if (result.ok) {
      const isNowChecked = result.data.checkedIn;
      setParticipants((prev) =>
        prev.map((item) =>
          item.id === p.id
            ? { ...item, checkedInAt: isNowChecked ? new Date() : null }
            : item,
        ),
      );
      toast(
        isNowChecked
          ? `✓ Вход подтверждён: ${p.fullName}`
          : `Отметка о входе снята: ${p.fullName}`,
      );
    } else {
      toast(result.error, 'danger');
    }
  }

  return (
    <div className="space-y-6">
      {/* Сводка и панель быстрого доступа */}
      <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Всего записей
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{participants.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Активных: {active.length} · Отменено: {cancelled.length}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Прошло контроль
            </p>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-emerald-950">
            {checkedIn.length}{' '}
            <span className="text-sm font-bold text-emerald-700">/ {active.length}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200/70">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${checkInPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Ожидается гостей
            </p>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-amber-950">{waiting.length}</p>
          <p className="text-xs text-amber-700/80 mt-0.5 font-medium">Ещё не прошли КПП на входе</p>
        </div>

        {/* Быстрый переход в полноэкранный QR-сканер */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white shadow-md shadow-indigo-500/15">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-100 flex items-center gap-1.5">
              <QrCode className="h-4 w-4" /> Контроль на входе
            </p>
            <p className="text-xs text-indigo-100/90 mt-1 leading-snug font-medium">
              Сканирование QR-кодов билетов камерой или сканером
            </p>
          </div>
          <Link
            href={`/organizer/events/${eventId}/check-in`}
            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50 active:scale-95 transition"
          >
            Открыть QR-сканер →
          </Link>
        </div>
      </div>

      {/* Панель фильтров, поиска и экспорта */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        {/* Поиск */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, email, месту, ID..."
            className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Экспорт и печать */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Кнопки переключения фильтра */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'all' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Все ({participants.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('checkedIn')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'checkedIn'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600'
              }`}
            >
              В зале ({checkedIn.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('waiting')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'waiting'
                  ? 'bg-white text-amber-700 shadow-2xs font-bold'
                  : 'text-slate-600'
              }`}
            >
              Ожидаются ({waiting.length})
            </button>
          </div>

          <a
            href={`/api/events/${eventId}/export`}
            download
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 transition"
            title="Скачать таблицу участников в формате CSV для Microsoft Excel"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" /> Экспорт в Excel / CSV
          </a>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-10 rounded-xl font-bold text-xs"
            title="Распечатать ведомость регистрации для КПП/охраны"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Печать ведомости
          </Button>
        </div>
      </div>

      {/* Заголовок ведомости для печати (виден только при печати) */}
      <div className="hidden print:block mb-6 border-b border-black pb-4">
        <h1 className="text-2xl font-black">{eventTitle}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ведомость регистрации участников на входе · Всего зарегистрировано: {active.length} · Прошло: {checkedIn.length}
        </p>
      </div>

      {/* Таблица участников */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <p className="text-sm font-semibold">Участники не найдены</p>
          <p className="text-xs text-slate-400 mt-1">
            Попробуйте изменить поисковый запрос или переключить фильтр.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
          <Table className="w-full">
            <THead>
              <TH className="w-10 text-center px-2 py-3 text-xs">№</TH>
              <TH className="min-w-[160px] px-3 py-3">Участник</TH>
              <TH className="min-w-[150px] px-3 py-3">Email / Телефон</TH>
              {hasLayout && <TH className="min-w-[110px] px-3 py-3">Место в зале</TH>}
              <TH className="min-w-[130px] px-3 py-3">Контроль (КПП)</TH>
              <TH className="w-24 px-3 py-3">Билет ID</TH>
              <TH className="no-print w-28 text-right px-3 py-3">Действие</TH>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p, index) => {
                const isChecked = Boolean(p.checkedInAt);
                const isBusy = pendingId === p.id;

                return (
                  <TR
                    key={p.id}
                    className={`transition-colors ${
                      isChecked ? 'bg-emerald-50/30 hover:bg-emerald-50/50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <TD className="text-xs text-slate-400 font-mono py-3 text-center px-2">{index + 1}</TD>

                    <TD className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs border ${
                            isChecked
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}
                        >
                          {initials(p.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 leading-tight text-xs sm:text-sm truncate">
                            {p.fullName}
                          </p>
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5 whitespace-nowrap">
                            Запись: {formatEventDateTime(p.createdAt)}
                          </p>
                        </div>
                      </div>
                    </TD>

                    <TD className="text-xs text-slate-600 py-3 px-3">
                      <p className="font-medium truncate">{p.email}</p>
                      <p className="text-slate-400 mt-0.5 text-2xs">{p.phone ?? '—'}</p>
                    </TD>

                    {hasLayout && (
                      <TD className="text-xs py-3 px-3">
                        {p.rowLabel && p.seatNumber !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border whitespace-nowrap ${
                              p.seatCategory === 'vip'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-100'
                            }`}
                          >
                            <Armchair className="h-3 w-3" />
                            Ряд {p.rowLabel}, м.{p.seatNumber}
                            {p.seatCategory === 'vip' && ' · VIP'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TD>
                    )}

                    {/* Колонка контроля входа */}
                    <TD className="py-3 px-3 text-xs">
                      {p.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-2xs font-bold text-rose-700 border border-rose-200">
                          Отменён
                        </span>
                      ) : isChecked ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/80 px-2 py-0.5 text-2xs font-bold text-emerald-900 border border-emerald-200 whitespace-nowrap">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Прошёл
                          </span>
                          <p className="text-[10px] text-emerald-700 font-medium pl-0.5 whitespace-nowrap">
                            {formatEventTime(p.checkedInAt!)}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600 border border-slate-200 whitespace-nowrap">
                          <Clock className="h-3 w-3 text-slate-400" />
                          Ожидается
                        </span>
                      )}
                    </TD>

                    <TD className="py-3 px-3">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                        {shortId(p.id)}
                      </span>
                    </TD>

                    <TD className="no-print py-3 text-right px-3">
                      {p.status === 'active' && (
                        <Button
                          size="sm"
                          variant={isChecked ? 'outline' : 'default'}
                          disabled={isBusy}
                          onClick={() => handleToggleCheckIn(p)}
                          className={`rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                            isChecked
                              ? 'text-slate-600 hover:text-rose-600 hover:border-rose-300 h-8 px-2.5'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs h-8 px-3'
                          }`}
                        >
                          {isBusy ? (
                            '...'
                          ) : isChecked ? (
                            <>
                              <RotateCcw className="h-3 w-3 mr-1" /> Снять
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" /> Отметить
                            </>
                          )}
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
