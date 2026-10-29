import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/guards';
import { getEventById } from '@/server/db/queries';
import { getEventWaitlistStats, getEventWaitlistEntries } from '@/server/db/waitlist';
import { formatEventDateTime } from '@/shared/format';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ButtonLink } from '@/components/ui/button';
import { organizerNav } from '../../../nav';
import { WaitlistClient, type WaitlistClientEntry } from './waitlist-client';

export const metadata: Metadata = { title: 'Лист ожидания' };
export const dynamic = 'force-dynamic';

export default async function WaitlistPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== 'organizer' && user.role !== 'admin') notFound();

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  if (user.role !== 'admin' && event.organizerId !== user.id) notFound();

  const [stats, rawEntries] = await Promise.all([
    getEventWaitlistStats(id),
    getEventWaitlistEntries(id),
  ]);

  const entries: WaitlistClientEntry[] = rawEntries.map((e) => ({
    id: e.id,
    status: e.status,
    priority: e.priority,
    createdAt: e.createdAt.toISOString(),
    offeredAt: e.offeredAt ? e.offeredAt.toISOString() : null,
    expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
    userId: e.userId,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone,
    rowLabel: e.rowLabel,
    seatNumber: e.seatNumber,
  }));

  return (
    <DashboardShell
      title="Лист ожидания"
      subtitle={`${event.title} · ${formatEventDateTime(event.startDate)}`}
      items={organizerNav}
      actions={
        <div className="flex gap-2">
          <ButtonLink href={`/organizer/events/${id}/participants`} variant="outline" size="sm">
            Участники
          </ButtonLink>
          <ButtonLink href={`/organizer/events/${id}/edit`} variant="outline" size="sm">
            Редактировать
          </ButtonLink>
          <ButtonLink href={`/events/${id}`} variant="outline" size="sm">
            В каталоге
          </ButtonLink>
        </div>
      }
    >
      <WaitlistClient
        eventId={event.id}
        stats={stats}
        entries={entries}
        hasLayout={Boolean(event.layoutRows)}
      />
    </DashboardShell>
  );
}
