import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarDays, MapPin, User, Hash, Armchair } from 'lucide-react';
import { requireUser } from '@/server/auth/guards';
import { getTicketById } from '@/server/db/queries';
import { formatEventDate, formatEventTime } from '@/shared/format';
import { shortId } from '@/shared/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getTicketQrDataUrl } from '@/components/tickets/qr';
import { PrintButton } from '@/components/tickets/print-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Электронный билет' };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ticket = await getTicketById(id);

  // Билет доступен владельцу записи, администратору и организатору этого мероприятия.
  const isOwner = ticket?.userId === user.id;
  const isAdmin = user.role === 'admin';
  const isOrganizer = user.role === 'organizer' && ticket?.organizerId === user.id;
  if (!ticket || (!isOwner && !isAdmin && !isOrganizer)) notFound();

  const qrDataUrl = await getTicketQrDataUrl(ticket.id);
  const isCancelled = ticket.eventStatus === 'cancelled' || ticket.status === 'cancelled';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/my-tickets" className="text-sm text-[var(--muted-fg)] hover:underline">
          ← К списку билетов
        </Link>
        <PrintButton />
      </div>

      <Card className="print-area overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white">
          <p className="text-sm uppercase tracking-wide opacity-80">Электронный билет</p>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{ticket.title}</h1>
        </div>

        <CardContent className="grid gap-6 p-6 sm:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              <div>
                <p className="text-sm text-[var(--muted-fg)]">Дата и время</p>
                <p className="font-medium">
                  {formatEventDate(ticket.startDate)}, {formatEventTime(ticket.startDate)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              <div>
                <p className="text-sm text-[var(--muted-fg)]">Адрес</p>
                <p className="font-medium">{ticket.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              <div>
                <p className="text-sm text-[var(--muted-fg)]">Владелец</p>
                <p className="font-medium">{ticket.userFullName}</p>
              </div>
            </div>

            {ticket.rowLabel && ticket.seatNumber !== null && (
              <div className="flex items-start gap-3">
                <Armchair className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
                <div>
                  <p className="text-sm text-[var(--muted-fg)]">Ваше место</p>
                  <p className="font-medium">
                    Ряд {ticket.rowLabel}, место {ticket.seatNumber}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Hash className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              <div>
                <p className="text-sm text-[var(--muted-fg)]">Номер брони</p>
                <p className="font-mono font-medium">{shortId(ticket.id)}</p>
              </div>
            </div>

            {isCancelled && (
              <Badge tone="danger">
                {ticket.eventStatus === 'cancelled' ? 'Мероприятие отменено' : 'Запись отменена'}
              </Badge>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-ui)] p-4">
            <div className="h-[200px] w-[200px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR-код билета"
                width={200}
                height={200}
                className="h-full w-full"
              />
            </div>
            <p className="text-center text-xs text-[var(--muted-fg)]">
              Наведите камеру телефона, чтобы открыть билет
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
