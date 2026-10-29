import type { Metadata } from 'next';
import { requireRole } from '@/server/auth/guards';
import { getOrganizerEvents } from '@/server/db/queries';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ButtonLink } from '@/components/ui/button';
import { SimplePagination } from '@/components/tables/pagination';
import { OrganizerEventsClient } from './events-client';
import { organizerNav } from '../nav';

export const metadata: Metadata = { title: 'Мои мероприятия' };
export const dynamic = 'force-dynamic';

export default async function OrganizerEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole('organizer', 'admin');
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page ?? 1) || 1);
  const search = String(Array.isArray(sp.q) ? sp.q[0] : sp.q ?? '').trim();

  const { items, total, totalPages } = await getOrganizerEvents(user.id, page, search);

  return (
    <DashboardShell
      title="Мои мероприятия"
      subtitle={`Всего: ${total}`}
      items={organizerNav}
      actions={<ButtonLink href="/organizer/events/new" size="sm">Создать мероприятие</ButtonLink>}
    >
      <form className="mb-4 flex gap-2" action="/organizer/events" method="get" role="search">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Поиск по названию"
          aria-label="Поиск мероприятий"
          className="h-10 w-full max-w-xs rounded-xl border border-[var(--border-ui)] bg-white px-3 text-[15px] focus:border-[var(--primary)] focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 rounded-xl border border-[var(--border-ui)] bg-white px-4 text-sm font-medium hover:bg-slate-50"
        >
          Найти
        </button>
        {search && (
          <a
            href="/organizer/events"
            className="flex h-10 items-center rounded-xl px-3 text-sm text-[var(--muted-fg)] hover:bg-slate-100"
          >
            Сбросить
          </a>
        )}
      </form>

      <OrganizerEventsClient events={items} />

      <div className="mt-6 flex justify-end">
        <SimplePagination
          page={page}
          totalPages={totalPages}
          basePath="/organizer/events"
          search={search ? `q=${encodeURIComponent(search)}` : ''}
        />
      </div>
    </DashboardShell>
  );
}
