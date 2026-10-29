import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/guards';
import { getEventById, getEventParticipants } from '@/server/db/queries';
import { formatEventDateTime } from '@/shared/format';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/dialog';
import { organizerNav } from '../../../nav';

export const metadata: Metadata = { title: 'Участники мероприятия' };
export const dynamic = 'force-dynamic';

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== 'organizer' && user.role !== 'admin') notFound();

  const { id } = await params;
  const event = await getEventById(id);
  // Организатор видит участников только своих мероприятий.
  if (!event) notFound();
  if (user.role !== 'admin' && event.organizerId !== user.id) notFound();

  const participants = await getEventParticipants(id);
  const active = participants.filter((p) => p.status === 'active');

  return (
    <DashboardShell
      title="Участники"
      subtitle={`${event.title} · ${formatEventDateTime(event.startDate)}`}
      items={organizerNav}
      actions={
        <div className="flex gap-2">
          <ButtonLink href={`/organizer/events/${id}/waitlist`} variant="outline" size="sm">
            Лист ожидания
          </ButtonLink>
          <ButtonLink href={`/organizer/events/${id}/edit`} variant="outline" size="sm">
            Редактировать
          </ButtonLink>
          <ButtonLink href={`/events/${id}`} variant="outline" size="sm">
            Открыть в каталоге
          </ButtonLink>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Badge tone="primary">
          Занято: {event.occupiedSeats} из {event.maxSeats}
        </Badge>
        <Badge tone="success">Активных записей: {active.length}</Badge>
        <Badge tone="neutral">Отменено: {participants.length - active.length}</Badge>
      </div>

      {participants.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="На это мероприятие пока никто не записался." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border-ui)] bg-white shadow-2xs">
          <Table className="min-w-[760px]">
            <THead>
              <TH>Участник</TH>
              <TH>Email</TH>
              <TH>Телефон</TH>
              {event.layoutRows && <TH>Место</TH>}
              <TH>Статус</TH>
              <TH>Дата записи</TH>
            </THead>
            <tbody>
              {participants.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium">{p.fullName}</TD>
                  <TD className="text-[var(--muted-fg)]">{p.email}</TD>
                  <TD className="text-[var(--muted-fg)]">{p.phone ?? '—'}</TD>
                  {event.layoutRows && (
                    <TD className="text-[var(--foreground)] font-medium">
                      {p.rowLabel && p.seatNumber !== null ? `Ряд ${p.rowLabel}, место ${p.seatNumber}` : '—'}
                    </TD>
                  )}
                  <TD>
                    <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>
                      {p.status === 'active' ? 'Активна' : 'Отменена'}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-[var(--muted-fg)]">
                    {formatEventDateTime(p.createdAt)}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </DashboardShell>
  );
}
