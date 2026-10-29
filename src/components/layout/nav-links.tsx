'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, Ticket, Compass } from 'lucide-react';
import { cn } from '@/shared/utils';

export function NavLinks({ role }: { role?: 'participant' | 'organizer' | 'admin' }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const baseStyle =
    'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-all duration-150';

  const activeClass =
    'font-bold text-indigo-700 bg-indigo-50/90 border border-indigo-200/80 shadow-2xs';
  const inactiveClass =
    'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent';

  return (
    <nav className="hidden items-center gap-1.5 sm:flex" aria-label="Основная навигация">
      <Link
        href="/"
        className={cn(baseStyle, isActive('/') ? activeClass : inactiveClass)}
      >
        <Compass className="h-4 w-4 text-slate-400 group-hover:text-slate-600" aria-hidden />
        <span>Каталог событий</span>
      </Link>

      {role === 'admin' && (
        <Link
          href="/admin"
          className={cn(
            baseStyle,
            isActive('/admin')
              ? 'font-bold text-purple-700 bg-purple-50/90 border border-purple-200/80 shadow-2xs'
              : 'font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50/50 border border-transparent',
          )}
        >
          <Shield className="h-4 w-4 text-purple-600" aria-hidden />
          <span>Админ-панель</span>
        </Link>
      )}

      {role === 'organizer' && (
        <Link
          href="/organizer"
          className={cn(
            baseStyle,
            isActive('/organizer')
              ? 'font-bold text-blue-700 bg-blue-50/90 border border-blue-200/80 shadow-2xs'
              : 'font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50/50 border border-transparent',
          )}
        >
          <LayoutDashboard className="h-4 w-4 text-blue-600" aria-hidden />
          <span>Панель организатора</span>
        </Link>
      )}

      {role === 'participant' && (
        <Link
          href="/my-tickets"
          className={cn(baseStyle, isActive('/my-tickets') ? activeClass : inactiveClass)}
        >
          <Ticket className="h-4 w-4 text-indigo-600" aria-hidden />
          <span>Мои билеты</span>
        </Link>
      )}
    </nav>
  );
}
