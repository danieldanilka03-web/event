'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  function isItemActive(href: string) {
    if (href === '/admin' || href === '/organizer') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          </div>
          {subtitle && <p className="mt-1 text-sm text-slate-500 font-medium">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      </div>

      <div className="grid gap-8 md:grid-cols-[230px_1fr]">
        <nav aria-label="Разделы панели" className="md:sticky md:top-24 md:self-start">
          <ul className="flex gap-1.5 overflow-x-auto md:flex-col md:overflow-visible p-2 rounded-3xl bg-slate-100/80 border border-slate-200/70 shadow-2xs">
            {items.map((item) => {
              const active = isItemActive(item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-150',
                      active
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
                    )}
                  >
                    <span className={cn('shrink-0 transition-colors', active ? 'text-indigo-600' : 'text-slate-400')}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">{children}</div>
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
    primary: {
      icon: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      border: 'hover:border-indigo-200',
    },
    accent: {
      icon: 'bg-amber-50 text-amber-600 border-amber-100',
      border: 'hover:border-amber-200',
    },
    success: {
      icon: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      border: 'hover:border-emerald-200',
    },
  } as const;

  const style = tones[tone];

  return (
    <div
      className={cn(
        'group flex items-center gap-4.5 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        style.border,
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-2xs transition-transform duration-200 group-hover:scale-105',
          style.icon,
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  );
}
