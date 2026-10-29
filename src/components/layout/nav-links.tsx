'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { cn } from '@/shared/utils';

export function NavLinks({ role }: { role?: 'participant' | 'organizer' | 'admin' }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    if (href === '/admin') return pathname === '/admin';
    if (href === '/organizer') return pathname === '/organizer';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const baseStyle =
    'rounded-xl px-3.5 py-2 text-sm transition-all duration-150';

  const activeClass =
    'font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 shadow-2xs';
  const inactiveClass =
    'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70';

  return (
    <nav className="hidden items-center gap-1 sm:flex" aria-label="Основная навигация">
      <Link
        href="/"
        className={cn(baseStyle, isActive('/') ? activeClass : inactiveClass)}
      >
        Мероприятия
      </Link>

      {role === 'organizer' && (
        <>
          <Link
            href="/organizer"
            className={cn(baseStyle, isActive('/organizer') ? activeClass : inactiveClass)}
          >
            Дашборд
          </Link>
          <Link
            href="/organizer/events"
            className={cn(baseStyle, isActive('/organizer/events') ? activeClass : inactiveClass)}
          >
            Мои мероприятия
          </Link>
          <Link
            href="/organizer/events/new"
            className={cn(
              'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
              isActive('/organizer/events/new')
                ? 'text-white bg-indigo-600 shadow-xs'
                : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100',
            )}
          >
            <Plus className="h-3.5 w-3.5" /> Создать
          </Link>
        </>
      )}

      {role === 'admin' && (
        <>
          <Link
            href="/admin"
            className={cn(baseStyle, isActive('/admin') ? activeClass : inactiveClass)}
          >
            Статистика
          </Link>
          <Link
            href="/admin/events"
            className={cn(baseStyle, isActive('/admin/events') ? activeClass : inactiveClass)}
          >
            Модерация
          </Link>
          <Link
            href="/admin/users"
            className={cn(baseStyle, isActive('/admin/users') ? activeClass : inactiveClass)}
          >
            Пользователи
          </Link>
        </>
      )}

      {role && (
        <Link
          href="/my-tickets"
          className={cn(
            baseStyle,
            isActive('/my-tickets') ? activeClass : inactiveClass,
          )}
        >
          Мои билеты
        </Link>
      )}
    </nav>
  );
}
