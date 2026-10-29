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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 font-medium">{subtitle}</p>}
        </div>
        {actions}
      </div>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <nav aria-label="Разделы панели" className="md:sticky md:top-20 md:self-start">
          <ul className="flex gap-1.5 overflow-x-auto md:flex-col md:overflow-visible p-1 rounded-2xl bg-slate-100/70 border border-slate-200/60">
            {items.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition-all',
                  )}
                >
                  <span className="text-slate-400 group-hover:text-indigo-600">{item.icon}</span>
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
    primary: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    accent: 'bg-amber-50 text-amber-600 border-amber-100',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  } as const;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${tones[tone]} shadow-2xs`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs leading-tight text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}
