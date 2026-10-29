'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet } from '@/components/ui/dialog';
import { logoutAction } from '@/server/actions/auth';
import { ROLE_LABEL } from '@/shared/constants';
import { cn } from '@/shared/utils';

export function MobileMenu({
  user,
}: {
  user: { name: string; role: 'participant' | 'organizer' | 'admin' } | null;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    setOpen(false);
    await logoutAction();
    router.push('/');
    router.refresh();
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    if (href === '/admin') return pathname === '/admin';
    if (href === '/organizer') return pathname === '/organizer';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const linkClass = 'block rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors';

  const activeLinkClass = 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80';
  const inactiveLinkClass = 'text-slate-700 hover:bg-slate-100/70 font-medium';

  return (
    <>
      <button
        type="button"
        aria-label="Открыть меню"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-2xs hover:bg-slate-50 transition-colors"
      >
        <Menu className="h-5 w-5 text-slate-700" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Навигация">
        <nav className="flex flex-col gap-1 mt-2" aria-label="Мобильная навигация">
          <Link
            href="/"
            className={cn(linkClass, isActive('/') ? activeLinkClass : inactiveLinkClass)}
            onClick={() => setOpen(false)}
          >
            Мероприятия
          </Link>

          {user ? (
            <>
              {user.role === 'organizer' && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                  <p className="px-3.5 text-xs font-bold uppercase tracking-wider text-slate-400">Кабинет организатора</p>
                  <Link
                    href="/organizer"
                    className={cn(linkClass, isActive('/organizer') && pathname === '/organizer' ? activeLinkClass : inactiveLinkClass)}
                    onClick={() => setOpen(false)}
                  >
                    Дашборд
                  </Link>
                  <Link
                    href="/organizer/events"
                    className={cn(linkClass, isActive('/organizer/events') && pathname !== '/organizer/events/new' ? activeLinkClass : inactiveLinkClass)}
                    onClick={() => setOpen(false)}
                  >
                    Мои мероприятия
                  </Link>
                  <Link
                    href="/organizer/events/new"
                    className={cn(
                      linkClass,
                      isActive('/organizer/events/new')
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-blue-700 hover:bg-blue-50 font-semibold',
                    )}
                    onClick={() => setOpen(false)}
                  >
                    + Создать событие
                  </Link>
                </div>
              )}

              {user.role === 'admin' && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                  <p className="px-3.5 text-xs font-bold uppercase tracking-wider text-slate-400">Администрирование</p>
                  <Link
                    href="/admin"
                    className={cn(linkClass, pathname === '/admin' ? activeLinkClass : inactiveLinkClass)}
                    onClick={() => setOpen(false)}
                  >
                    Статистика
                  </Link>
                  <Link
                    href="/admin/events"
                    className={cn(linkClass, pathname.startsWith('/admin/events') ? activeLinkClass : inactiveLinkClass)}
                    onClick={() => setOpen(false)}
                  >
                    Модерация событий
                  </Link>
                  <Link
                    href="/admin/users"
                    className={cn(linkClass, pathname.startsWith('/admin/users') ? activeLinkClass : inactiveLinkClass)}
                    onClick={() => setOpen(false)}
                  >
                    Пользователи
                  </Link>
                </div>
              )}

              {user.role === 'participant' && (
                <Link
                  href="/my-tickets"
                  className={cn(linkClass, isActive('/my-tickets') ? activeLinkClass : inactiveLinkClass)}
                  onClick={() => setOpen(false)}
                >
                  Мои билеты
                </Link>
              )}

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                <Link
                  href="/profile"
                  className={cn(
                    linkClass,
                    isActive('/profile')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-100',
                  )}
                  onClick={() => setOpen(false)}
                >
                  Профиль
                </Link>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100">
                <p className="px-3 text-xs text-slate-400 font-medium mb-1">
                  Вы вошли как: {ROLE_LABEL[user.role]}
                </p>
                <button
                  type="button"
                  onClick={logout}
                  className={`${linkClass} w-full text-left text-rose-600 hover:bg-rose-50`}
                >
                  Выйти из системы
                </button>
              </div>
            </>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
                onClick={() => setOpen(false)}
              >
                Регистрация
              </Link>
            </div>
          )}
        </nav>
      </Sheet>
    </>
  );
}
