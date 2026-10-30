import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  CalendarDays,
  MapPin,
  User,
  Hash,
  Armchair,
  Ticket,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { requireUser } from '@/server/auth/guards';
import { getTicketById, getUserRegistrationsForEvent } from '@/server/db/queries';
import { formatEventDate, formatEventTime } from '@/shared/format';
import { shortId, cn } from '@/shared/utils';
import { getTicketQrDataUrl } from '@/components/tickets/qr';
import { PrintButton } from '@/components/tickets/print-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Электронный билет' };

function pluralTickets(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} билетов`;
  if (mod10 === 1) return `${count} билет`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} билета`;
  return `${count} билетов`;
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ticket = await getTicketById(id);

  // Билет доступен владельцу записи, администратору и организатору этого мероприятия.
  const isOwner = ticket?.userId === user.id;
  const isAdmin = user.role === 'admin';
  const isOrganizer = user.role === 'organizer' && ticket?.organizerId === user.id;
  if (!ticket || (!isOwner && !isAdmin && !isOrganizer)) notFound();

  // Получаем все активные билеты этого пользователя на данное мероприятие (если оформлен групповой заказ)
  const allRegistrations = await getUserRegistrationsForEvent(ticket.eventId, ticket.userId);
  const siblingTickets = allRegistrations.filter((r) => r.status === 'active');
  siblingTickets.sort((a, b) => {
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    const rowCmp = (a.rowLabel ?? '').localeCompare(b.rowLabel ?? '');
    if (rowCmp !== 0) return rowCmp;
    return (a.seatNumber ?? 0) - (b.seatNumber ?? 0);
  });

  const currentIndex = siblingTickets.findIndex((t) => t.id === ticket.id);
  const ticketNumber = currentIndex >= 0 ? currentIndex + 1 : 1;
  const totalTickets = siblingTickets.length;

  const prevTicket = currentIndex > 0 ? siblingTickets[currentIndex - 1] : null;
  const nextTicket = currentIndex >= 0 && currentIndex < totalTickets - 1 ? siblingTickets[currentIndex + 1] : null;

  const qrDataUrl = await getTicketQrDataUrl(ticket.id);
  const isCancelled = ticket.eventStatus === 'cancelled' || ticket.status === 'cancelled';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      {/* Навигационная панель сверху */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/my-tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> К моим билетам
        </Link>
        <div className="flex items-center gap-2">
          {totalTickets > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <Link
                href={prevTicket ? `/tickets/${prevTicket.id}` : '#'}
                aria-disabled={!prevTicket}
                className={cn(
                  'flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-bold border transition-colors',
                  prevTicket
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-100 bg-slate-50 text-slate-300 pointer-events-none',
                )}
                title="Предыдущий билет"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Предыдущий
              </Link>
              <Link
                href={nextTicket ? `/tickets/${nextTicket.id}` : '#'}
                aria-disabled={!nextTicket}
                className={cn(
                  'flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-bold border transition-colors',
                  nextTicket
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-100 bg-slate-50 text-slate-300 pointer-events-none',
                )}
                title="Следующий билет"
              >
                Следующий <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
          <PrintButton />
        </div>
      </div>

      {/* Плашка группового заказа (если куплено несколько мест) */}
      {totalTickets > 1 && (
        <div className="no-print mb-6 rounded-3xl border border-indigo-200/90 bg-indigo-50/80 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs shadow-2xs">
                  {totalTickets}
                </span>
                <p className="text-sm font-bold text-indigo-950">
                  В вашем заказе {pluralTickets(totalTickets)}:
                </p>
              </div>
              <p className="mt-1 text-xs text-indigo-800/90 font-medium leading-relaxed">
                У каждого места свой персональный QR-код. Вы можете переслать нужный билет друзьям или показать контролёру по очереди.
              </p>
            </div>
            {/* Быстрые кнопки переключения между билетами */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {siblingTickets.map((t, idx) => {
                const isCurrent = t.id === ticket.id;
                const seatLabel = t.rowLabel && t.seatNumber ? `Ряд ${t.rowLabel}, м.${t.seatNumber}` : `Билет №${idx + 1}`;
                return (
                  <Link
                    key={t.id}
                    href={`/tickets/${t.id}`}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150',
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-600 ring-offset-2'
                        : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-100 hover:text-slate-950',
                    )}
                  >
                    {isCurrent ? `✓ ${seatLabel}` : seatLabel}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Карточка электронного билета */}
      <div className="print-area relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl ticket-edge-left ticket-edge-right">
        {/* Шапка билета */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-6 sm:px-8 py-6 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-md border border-white/20">
                <Ticket className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-widest font-bold opacity-90">
                  Электронный билет
                </p>
                {totalTickets > 1 && (
                  <span className="rounded-md bg-white/25 px-2 py-0.5 text-[11px] font-black tracking-normal">
                    {ticketNumber} из {totalTickets}
                  </span>
                )}
              </div>
            </div>
            {!isCancelled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-200 border border-emerald-400/30">
                <CheckCircle2 className="h-3.5 w-3.5" /> Действителен
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl tracking-tight text-white leading-tight">
            {ticket.title}
          </h1>
        </div>

        {/* Тело билета с перфорацией */}
        <div className="grid gap-6 p-6 sm:p-8 sm:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Дата и время начала</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {formatEventDate(ticket.startDate)}, {formatEventTime(ticket.startDate)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <MapPin className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Место проведения</p>
                <p className="font-semibold text-slate-900 mt-0.5">{ticket.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                <User className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Покупатель / Участник</p>
                <p className="font-semibold text-slate-900 mt-0.5">{ticket.userFullName}</p>
              </div>
            </div>

            {ticket.rowLabel && ticket.seatNumber !== null && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Назначенное место</p>
                  {totalTickets > 1 && (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-md">
                      Место {ticketNumber} из {totalTickets}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <Armchair className="h-6 w-6 text-indigo-700" />
                  <p className="text-xl font-black text-indigo-950">
                    Ряд {ticket.rowLabel}, место {ticket.seatNumber}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3.5 pt-2 border-t border-slate-100">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Hash className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Номер билета</p>
                <p className="font-mono text-sm font-bold text-slate-700">{shortId(ticket.id)}</p>
              </div>
            </div>

            {isCancelled && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-bold">
                {ticket.eventStatus === 'cancelled' ? 'Мероприятие отменено организатором' : 'Запись на мероприятие отменена'}
              </div>
            )}
          </div>

          {/* QR-код блок */}
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
            <div className="overflow-hidden rounded-xl bg-white p-2 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR-код билета"
                width={180}
                height={180}
                className="h-auto w-full max-w-[180px]"
              />
            </div>
            <p className="text-[11px] leading-tight text-slate-500 font-medium max-w-[180px]">
              Предъявите этот QR-код на входе для прохода на место
              {ticket.rowLabel && ticket.seatNumber ? (
                <strong className="block text-slate-800 mt-0.5">
                  Ряд {ticket.rowLabel}, место {ticket.seatNumber}
                </strong>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
