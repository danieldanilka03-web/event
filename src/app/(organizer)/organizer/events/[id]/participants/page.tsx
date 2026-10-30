import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { requireUser } from '@/server/auth/guards';
import { getEventById, getEventParticipants } from '@/server/db/queries';
import { formatEventDateTime } from '@/shared/format';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ButtonLink } from '@/components/ui/button';
import { organizerNav } from '../../../nav';
import { ParticipantsClient } from './participants-client';

export const metadata: Metadata = { title: 'Участники мероприятия' };
export const dynamic = 'force-dynamic';

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== 'organizer' && user.role !== 'admin') notFound();

  const { id } = await params;
  const event = await getEventById(id);
  // Организатор видит участников только своих мероприятий, админ — любых.
  if (!event || (user.role !== 'admin' && event.organizerId !== user.id)) notFound();

  const rawParticipants = await getEventParticipants(id);

  const participants = rawParticipants.map((p) => ({
    id: p.id,
    status: p.status,
    checkedInAt: p.checkedInAt,
    createdAt: p.createdAt,
    userId: p.userId,
    fullName: p.fullName,
    email: p.email,
    phone: p.phone,
    rowLabel: p.rowLabel,
    seatNumber: p.seatNumber,
    seatCategory: p.seatCategory,
  }));

  return (
    <DashboardShell
      title="Участники мероприятия"
      subtitle={`${event.title} · ${formatEventDateTime(event.startDate)}`}
      items={organizerNav}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            href={`/organizer/events/${id}/check-in`}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
            size="sm"
          >
            <QrCode className="h-4 w-4 mr-1.5" /> Контроль входа (QR-сканер)
          </ButtonLink>
          <ButtonLink href={`/organizer/events/${id}/waitlist`} variant="outline" size="sm">
            Лист ожидания
          </ButtonLink>
          <ButtonLink href={`/organizer/events/${id}/edit`} variant="outline" size="sm">
            Редактировать
          </ButtonLink>
          <ButtonLink href={`/events/${id}`} variant="outline" size="sm">
            В каталоге ↗
          </ButtonLink>
        </div>
      }
    >
      <ParticipantsClient
        eventId={event.id}
        eventTitle={event.title}
        hasLayout={Boolean(event.layoutRows)}
        initialParticipants={participants}
      />
    </DashboardShell>
  );
}
