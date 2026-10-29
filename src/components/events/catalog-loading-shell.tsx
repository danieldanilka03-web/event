'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CatalogSkeleton } from '@/components/events/catalog-skeleton';
import type { ReactNode } from 'react';

/**
 * Показывает скелетоны каталога, пока идут изменения query-параметров
 * (фильтры, пагинация). Основной контент рендерится на сервере.
 */
export function CatalogLoadingShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setPending(true);
    const timer = setTimeout(() => setPending(false), 400);
    return () => clearTimeout(timer);
  }, [searchParams]);

  if (!pending) return <>{children}</>;
  return <CatalogSkeleton />;
}