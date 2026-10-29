import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/server/auth/guards';
import { getAdminUsers } from '@/server/db/queries';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Table, THead, TH } from '@/components/ui/table';
import { SimplePagination } from '@/components/tables/pagination';
import { EmptyState } from '@/components/ui/dialog';
import { adminNav } from '../nav';
import { AdminUsersClient } from './users-client';

export const metadata: Metadata = { title: 'Пользователи' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole('admin');
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page ?? 1) || 1);
  const search = String(Array.isArray(sp.q) ? sp.q[0] : sp.q ?? '').trim();

  const { items, total, totalPages } = await getAdminUsers(page, search);

  return (
    <DashboardShell
      title="Пользователи"
      subtitle={`Всего: ${total}`}
      items={adminNav}
    >
      <form className="mb-4 flex gap-2" action="/admin/users" method="get" role="search">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Поиск по ФИО"
          aria-label="Поиск пользователей"
          className="h-10 w-full max-w-xs rounded-xl border border-[var(--border-ui)] bg-white px-3 text-[15px] focus:border-[var(--primary)] focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 rounded-xl border border-[var(--border-ui)] bg-white px-4 text-sm font-medium hover:bg-slate-50"
        >
          Найти
        </button>
        {search && (
          <Link
            href="/admin/users"
            className="flex h-10 items-center rounded-xl px-3 text-sm text-[var(--muted-fg)] hover:bg-slate-100"
          >
            Сбросить
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Пользователи не найдены по вашему запросу." />
      ) : (
        <>
          <div className="rounded-xl border border-[var(--border-ui)] bg-white">
            <Table>
              <THead>
                <TH>Пользователь</TH>
                <TH>Роль</TH>
                <TH>Статус</TH>
              </THead>
              <tbody>
                <AdminUsersClient users={items} currentUserId={admin.id} />
              </tbody>
            </Table>
          </div>
          <div className="mt-6 flex justify-end">
            <SimplePagination
              page={page}
              totalPages={totalPages}
              basePath="/admin/users"
              search={search ? `q=${encodeURIComponent(search)}` : ''}
            />
          </div>
        </>
      )}
    </DashboardShell>
  );
}
