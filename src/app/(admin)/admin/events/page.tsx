import type { Metadata } from 'next';
import { requireRole } from '@/server/auth/guards';
import { getAdminEvents } from '@/server/db/queries';
import { DashboardShell } from '@/components/layout/dashboard-shell';
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
      subtitle={`Всего событий: ${total}. Администратор может публиковать, скрывать или удалять мероприятия платформы.`}
      items={adminNav}
    >
      {items.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Мероприятий пока нет." />
      ) : (
        <>
          <AdminEventsClient events={items} />
          {totalPages > 1 && (
            <div className="mt-6 flex justify-end">
              <SimplePagination page={page} totalPages={totalPages} basePath="/admin/events" />
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
