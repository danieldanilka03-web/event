import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/guards';
import { getEventById, getEventParticipants } from '@/server/db/queries';
import { formatEventDateTime } from '@/shared/format';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { organizerNav } from '../../../nav';
import { CheckInClient, type CheckInParticipant } from './check-in-client';

export const metadata: Metadata = {
  title: 'Контроль входа и QR-сканер',
};

export const dynamic = 'force-dynamic';

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== 'organizer' && user.role !== 'admin') notFound();

  const { id } = await params;
  const event = await getEventById(id);
  if (!event || (user.role !== 'admin' && event.organizerId !== user.id)) notFound();

  const rawParticipants = await getEventParticipants(id);

  const initialParticipants: CheckInParticipant[] = rawParticipants.map((p) => ({
    id: p.id,
    status: p.status,
    checkedInAt: p.checkedInAt,
    userId: p.userId,
    fullName: p.fullName,
    email: p.email,
    rowLabel: p.rowLabel,
    seatNumber: p.seatNumber,
    seatCategory: p.seatCategory,
  }));

  return (
    <DashboardShell
      title="Контроль входа (QR-сканер)"
      subtitle={`${event.title} · ${formatEventDateTime(event.startDate)} · ${event.location}`}
      items={organizerNav}
    >
      <CheckInClient
        eventId={event.id}
        eventTitle={event.title}
        eventDate={event.startDate}
        eventLocation={event.location}
        initialParticipants={initialParticipants}
      />
    </DashboardShell>
  );
}
