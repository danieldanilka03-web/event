import Link from 'next/link';
import { cn } from '@/shared/utils';

export type SidebarItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  items,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  items: SidebarItem[];
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--muted-fg)]">{subtitle}</p>}
        </div>
        {actions}
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav aria-label="Разделы панели" className="md:sticky md:top-20 md:self-start">
          <ul className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {items.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted-fg)] hover:bg-white hover:text-[var(--foreground)]',
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function MetricCard({
  icon,
  value,
  label,
  tone = 'primary',
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  tone?: 'primary' | 'accent' | 'success';
}) {
  const tones = {
    primary: 'bg-indigo-50 text-indigo-600',
    accent: 'bg-amber-50 text-amber-600',
    success: 'bg-green-50 text-green-600',
  } as const;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-ui)] bg-white p-4">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold">{value}</p>
        {/* Подпись не обрезаем: названия метрик длинные («Опубликованных событий»). */}
        <p className="text-sm leading-tight text-[var(--muted-fg)]">{label}</p>
      </div>
    </div>
  );
}
