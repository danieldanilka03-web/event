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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== 'organizer') notFound();

  const { id } = await params;
  const event = await getEventById(id);
  // Организатор видит участников только своих мероприятий.
  if (!event || event.organizerId !== user.id) notFound();

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
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <Table className="min-w-[840px]">
            <THead>
              <TH className="min-w-[240px]">Участник</TH>
              <TH className="min-w-[180px]">Email</TH>
              <TH className="min-w-[140px]">Телефон</TH>
              {event.layoutRows && <TH className="min-w-[140px]">Место в зале</TH>}
              <TH className="min-w-[110px]">Статус</TH>
              <TH className="min-w-[160px]">Дата записи</TH>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {participants.map((p) => (
                <TR key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <TD className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                        {initials(p.fullName)}
                      </span>
                      <span className="font-bold text-slate-900">{p.fullName}</span>
                    </div>
                  </TD>
                  <TD className="text-xs text-slate-600 py-3.5">{p.email}</TD>
                  <TD className="text-xs text-slate-500 py-3.5">{p.phone ?? '—'}</TD>
                  {event.layoutRows && (
                    <TD className="text-xs font-bold text-indigo-900 py-3.5">
                      {p.rowLabel && p.seatNumber !== null ? (
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 border border-indigo-100">
                          Ряд {p.rowLabel}, место {p.seatNumber}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TD>
                  )}
                  <TD className="py-3.5">
                    <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>
                      {p.status === 'active' ? 'Активна' : 'Отменена'}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-slate-500 py-3.5">
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
