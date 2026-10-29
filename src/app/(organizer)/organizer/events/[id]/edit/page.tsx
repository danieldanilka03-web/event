import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/server/auth/guards';
import { getOwnedEventForEdit } from '@/server/actions/events';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { EventForm } from '@/components/events/event-form';
import { organizerNav } from '../../../nav';

export const metadata: Metadata = { title: 'Редактирование мероприятия' };
export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('organizer', 'admin');
  const { id } = await params;
  const event = await getOwnedEventForEdit(id);
  if (!event) notFound();

  return (
    <DashboardShell
      title="Редактирование мероприятия"
      subtitle={event.title}
      items={organizerNav}
    >
      <EventForm
        mode="edit"
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          category: event.category,
          location: event.location,
          startDate: event.startDate,
          maxSeats: event.maxSeats,
          occupiedSeats: event.occupiedSeats,
          hasLayout: event.layoutRows !== null,
        }}
      />
    </DashboardShell>
  );
}
