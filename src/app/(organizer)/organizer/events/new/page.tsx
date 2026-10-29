import type { Metadata } from 'next';
import { requireRole } from '@/server/auth/guards';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { EventForm } from '@/components/events/event-form';
import { organizerNav } from '../../nav';

export const metadata: Metadata = { title: 'Создание мероприятия' };
export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  await requireRole('organizer', 'admin');

  return (
    <DashboardShell
      title="Новое мероприятие"
      subtitle="После создания мероприятие попадёт в статус «Черновик» — опубликуйте его, когда будете готовы"
      items={organizerNav}
    >
      <EventForm mode="create" />
    </DashboardShell>
  );
}
