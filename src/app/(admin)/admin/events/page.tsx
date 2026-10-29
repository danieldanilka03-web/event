import type { Metadata } from 'next';
import { requireRole } from '@/server/auth/guards';
import { getAdminEvents } from '@/server/db/queries';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Table, THead, TH } from '@/components/ui/table';
import { SimplePagination } from '@/components/tables/pagination';
import { EmptyState } from '@/components/ui/dialog';
import { adminNav } from '../nav';
import { AdminEventsClient } from './events-client';

export const metadata: Metadata = { title: 'Модерация мероприятий' };
export const dynamic = 'force-dynamic';

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole('admin');
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page ?? 1) || 1);
  const { items, total, totalPages } = await getAdminEvents(page);

  return (
    <DashboardShell
      title="Модерация мероприятий"
      subtitle={`Всего: ${total}. Администратор может менять статус и удалять любые мероприятия.`}
      items={adminNav}
    >
      {items.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Мероприятий пока нет." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <Table className="min-w-[1000px]">
              <THead>
                <TH className="min-w-[280px]">Мероприятие</TH>
                <TH className="min-w-[170px]">Организатор</TH>
                <TH className="min-w-[130px]">Дата</TH>
                <TH className="min-w-[100px]">Места</TH>
                <TH className="min-w-[130px]">Статус</TH>
                <TH className="min-w-[260px] text-right" aria-label="Действия">Управление</TH>
              </THead>
              <tbody>
                <AdminEventsClient events={items} />
              </tbody>
            </Table>
          </div>
          <div className="mt-6 flex justify-end">
            <SimplePagination page={page} totalPages={totalPages} basePath="/admin/events" />
          </div>
        </>
      )}
    </DashboardShell>
  );
}
