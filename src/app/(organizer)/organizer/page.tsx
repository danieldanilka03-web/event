import type { Metadata } from 'next';
import Link from 'next/link';
import { Users, Armchair, Gauge } from 'lucide-react';
import { requireRole } from '@/server/auth/guards';
import { getOrganizerEvents, getOrganizerMetrics } from '@/server/db/queries';
import { DashboardShell, MetricCard } from '@/components/layout/dashboard-shell';
import { ButtonLink } from '@/components/ui/button';
import { Badge, Progress } from '@/components/ui/badge';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { formatEventDateTime, fillPercent } from '@/shared/format';
import { organizerNav } from './nav';

export const metadata: Metadata = { title: 'Панель организатора' };
export const dynamic = 'force-dynamic';

export default async function OrganizerDashboard() {
  const user = await requireRole('organizer', 'admin');
  const metrics = await getOrganizerMetrics(user.id);
  const events = await getOrganizerEvents(user.id, 1, '');

  return (
    <DashboardShell
      title="Панель организатора"
      subtitle={`Здравствуйте, ${user.fullName}`}
      items={organizerNav}
      actions={
        <ButtonLink href="/organizer/events/new" size="sm">
          Создать мероприятие
        </ButtonLink>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<Users className="h-5 w-5" />} value={metrics.registrations} label="Всего регистраций" />
        <MetricCard
          icon={<Armchair className="h-5 w-5" />}
          value={metrics.freeSeats}
          label="Свободных мест"
          tone="accent"
        />
        <MetricCard
          icon={<Gauge className="h-5 w-5" />}
          value={`${metrics.fillPercent}%`}
          label="Средняя заполняемость"
          tone="success"
        />
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border-ui)] bg-white">
        <div className="border-b border-[var(--border-ui)] p-4">
          <h2 className="text-lg font-semibold">Мои мероприятия</h2>
        </div>
        {events.items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted-fg)]">
            Пока нет мероприятий.{' '}
            <Link href="/organizer/events/new" className="text-[var(--primary)] hover:underline">
              Создайте первое
            </Link>
            .
          </p>
        ) : (
          <Table>
            <THead>
              <TH>Название</TH>
              <TH>Дата</TH>
              <TH>Статус</TH>
              <TH>Заполняемость</TH>
              <TH aria-label="Действия" />
            </THead>
            <tbody>
              {events.items.slice(0, 8).map((event) => {
                const percent = fillPercent(event.maxSeats, event.occupiedSeats);
                return (
                  <TR key={event.id}>
                    <TD className="max-w-[240px] truncate font-medium">{event.title}</TD>
                    <TD className="whitespace-nowrap text-[var(--muted-fg)]">
                      {formatEventDateTime(event.startDate)}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          event.status === 'published'
                            ? 'success'
                            : event.status === 'cancelled'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {event.status === 'published'
                          ? 'Опубликовано'
                          : event.status === 'cancelled'
                            ? 'Отменено'
                            : 'Черновик'}
                      </Badge>
                    </TD>
                    <TD className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Progress value={percent} />
                        </div>
                        <span className="whitespace-nowrap text-sm text-[var(--muted-fg)]">
                          {event.occupiedSeats}/{event.maxSeats} · {percent}%
                        </span>
                      </div>
                    </TD>
                    <TD>
                      <Link
                        href={`/organizer/events/${event.id}/participants`}
                        className="text-sm font-medium text-[var(--primary)] hover:underline"
                      >
                        Участники
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </DashboardShell>
  );
}
