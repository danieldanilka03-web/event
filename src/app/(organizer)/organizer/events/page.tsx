import type { Metadata } from 'next';
import { Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
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
      subtitle={`Всего: ${total} ${total === 1 ? 'мероприятие' : total >= 2 && total <= 4 ? 'мероприятия' : 'мероприятий'}`}
      items={organizerNav}
      actions={
        <ButtonLink href="/organizer/events/new" size="sm" className="shadow-xs font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Создать мероприятие
        </ButtonLink>
      }
    >
      {/* Поисковая панель */}
      <div className="mb-6 rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-xs">
        <form className="flex flex-col sm:flex-row gap-2.5" action="/organizer/events" method="get" role="search">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Поиск мероприятий по названию…"
              aria-label="Поиск мероприятий"
              className="h-10 w-full rounded-xl border border-slate-200/90 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100/80 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-2xs hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
              Найти
            </button>
            {search && (
              <Link
                href="/organizer/events"
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-slate-400" /> Сбросить
              </Link>
            )}
          </div>
        </form>
      </div>

      <OrganizerEventsClient events={items} />

      {totalPages > 1 && (
        <div className="mt-6 flex justify-end">
          <SimplePagination
            page={page}
            totalPages={totalPages}
            basePath="/organizer/events"
            search={search ? `q=${encodeURIComponent(search)}` : ''}
          />
        </div>
      )}
    </DashboardShell>
  );
}
