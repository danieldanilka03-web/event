import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
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
      subtitle={`Всего зарегистрировано: ${total}`}
      items={adminNav}
    >
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <form className="flex flex-col sm:flex-row gap-2.5" action="/admin/users" method="get" role="search">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Поиск по ФИО или Email…"
              aria-label="Поиск пользователей"
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
                href="/admin/users"
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-slate-400" /> Сбросить
              </Link>
            )}
          </div>
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Пользователи не найдены по вашему запросу." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <Table className="min-w-[700px]">
              <THead>
                <TH className="min-w-[280px]">Пользователь</TH>
                <TH className="min-w-[220px]">Роль в системе</TH>
                <TH className="min-w-[160px]">Статус аккаунта</TH>
              </THead>
              <tbody>
                <AdminUsersClient users={items} currentUserId={admin.id} />
              </tbody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex justify-end">
              <SimplePagination
                page={page}
                totalPages={totalPages}
                basePath="/admin/users"
                search={search ? `q=${encodeURIComponent(search)}` : ''}
              />
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
