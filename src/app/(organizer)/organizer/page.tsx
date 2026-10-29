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
  const user = await requireRole('organizer');
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

      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="text-base font-bold tracking-tight text-slate-900">Последние мероприятия</h2>
          <Link href="/organizer/events" className="text-xs font-semibold text-indigo-600 hover:underline">
            Все мероприятия →
          </Link>
        </div>
        {events.items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Пока нет мероприятий.{' '}
            <Link href="/organizer/events/new" className="font-semibold text-indigo-600 hover:underline">
              Создайте первое
            </Link>
            .
          </p>
        ) : (
          <Table className="min-w-[800px]">
            <THead>
              <TH>Название</TH>
              <TH>Дата</TH>
              <TH>Статус</TH>
              <TH>Заполняемость</TH>
              <TH className="text-right">Управление</TH>
            </THead>
            <tbody>
              {events.items.slice(0, 8).map((event) => {
                const percent = fillPercent(event.maxSeats, event.occupiedSeats);
                return (
                  <TR key={event.id}>
                    <TD className="max-w-[240px] truncate font-semibold text-slate-900">{event.title}</TD>
                    <TD className="whitespace-nowrap text-slate-500 text-xs font-medium">
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
                        <div className="w-20">
                          <Progress value={percent} />
                        </div>
                        <span className="whitespace-nowrap text-xs text-slate-500">
                          {event.occupiedSeats}/{event.maxSeats} ({percent}%)
                        </span>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-right">
                      <Link
                        href={`/organizer/events/${event.id}/participants`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
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
