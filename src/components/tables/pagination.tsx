import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { CatalogQuery } from '@/shared/validators';
import { PAGE_SIZE } from '@/shared/constants';

function hrefFor(page: number, query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: CatalogQuery;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  const itemClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border-ui)] px-3 text-sm font-medium';

  return (
    <nav aria-label="Постраничная навигация" className="flex items-center gap-1">
      <Link
        href={hrefFor(Math.max(1, page - 1), params)}
        aria-label="Предыдущая страница"
        aria-disabled={page === 1}
        className={cn(itemClass, page === 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50')}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Link>
      {pages[0] !== 1 && <span className="px-1 text-sm text-[var(--muted-fg)]">…</span>}
      {pages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p, params)}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            itemClass,
            p === page ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'hover:bg-slate-50',
          )}
        >
          {p}
        </Link>
      ))}
      {pages[pages.length - 1] !== totalPages && (
        <span className="px-1 text-sm text-[var(--muted-fg)]">…</span>
      )}
      <Link
        href={hrefFor(Math.min(totalPages, page + 1), params)}
        aria-label="Следующая страница"
        aria-disabled={page === totalPages}
        className={cn(
          itemClass,
          page === totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50',
        )}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </nav>
  );
}

/** Универсальная пагинация для админок и панелей (с фиксированным размером страницы). */
export function SimplePagination({
  page,
  totalPages,
  basePath,
  search = '',
}: {
  page: number;
  totalPages: number;
  basePath: string;
  search?: string;
}) {
  if (totalPages <= 1) return null;
  const itemClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border-ui)] px-3 text-sm font-medium';

  return (
    <nav aria-label="Постраничная навигация" className="flex items-center gap-1">
      <Link
        href={page > 1 ? `${basePath}?${search}${search ? '&' : ''}page=${page - 1}` : `${basePath}?${search}`}
        aria-disabled={page === 1}
        className={cn(itemClass, page === 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50')}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Link>
      <span className="px-2 text-sm text-[var(--muted-fg)]">
        {page} / {totalPages}
      </span>
      <Link
        href={`${basePath}?${search}${search ? '&' : ''}page=${Math.min(totalPages, page + 1)}`}
        aria-disabled={page === totalPages}
        className={cn(
          itemClass,
          page === totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50',
        )}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </nav>
  );
}

export { PAGE_SIZE };
