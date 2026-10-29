import type { Metadata } from 'next';
import { Users, CalendarCheck, Ticket, CalendarClock } from 'lucide-react';
import { requireRole } from '@/server/auth/guards';
import { getAdminMetrics, getAdminEvents } from '@/server/db/queries';
import { DashboardShell, MetricCard } from '@/components/layout/dashboard-shell';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatEventDateTime } from '@/shared/format';
import { adminNav } from './nav';

export const metadata: Metadata = { title: 'Админ-панель' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  await requireRole('admin');
  const metrics = await getAdminMetrics();
  const events = await getAdminEvents(1);

  return (
    <DashboardShell title="Админ-панель" subtitle="Статистика платформы" items={adminNav}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Users className="h-5 w-5" />} value={metrics.users} label="Пользователей" />
        <MetricCard
          icon={<CalendarCheck className="h-5 w-5" />}
          value={metrics.publishedEvents}
          label="Опубликованных событий"
          tone="accent"
        />
        <MetricCard
          icon={<Ticket className="h-5 w-5" />}
          value={metrics.registrations}
          label="Активных регистраций"
          tone="success"
        />
        <MetricCard
          icon={<CalendarClock className="h-5 w-5" />}
          value={metrics.upcomingEvents}
          label="Будущих событий"
        />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-bold tracking-tight text-slate-900">Последние мероприятия на платформе</h2>
        </div>
        <Table className="min-w-[720px]">
          <THead>
            <TH>Название</TH>
            <TH>Организатор</TH>
            <TH>Дата</TH>
            <TH>Статус</TH>
            <TH>Места</TH>
          </THead>
          <tbody>
            {events.items.slice(0, 8).map((e) => (
              <TR key={e.id}>
                <TD className="max-w-[240px] truncate font-medium">{e.title}</TD>
                <TD className="text-[var(--muted-fg)]">{e.organizerName}</TD>
                <TD className="whitespace-nowrap text-[var(--muted-fg)]">
                  {formatEventDateTime(e.startDate)}
                </TD>
                <TD>
                  <Badge
                    tone={e.status === 'published' ? 'success' : e.status === 'cancelled' ? 'danger' : 'neutral'}
                  >
                    {e.status === 'published'
                      ? 'Опубликовано'
                      : e.status === 'cancelled'
                        ? 'Отменено'
                        : 'Черновик'}
                  </Badge>
                </TD>
                <TD className="whitespace-nowrap text-[var(--muted-fg)]">
                  {e.occupiedSeats}/{e.maxSeats}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DashboardShell>
  );
}
