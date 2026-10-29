'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet } from '@/components/ui/dialog';
import { logoutAction } from '@/server/actions/auth';
import { ROLE_LABEL } from '@/shared/constants';

export function MobileMenu({
  user,
}: {
  user: { name: string; role: 'participant' | 'organizer' | 'admin' } | null;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  async function logout() {
    setOpen(false);
    await logoutAction();
    router.push('/');
    router.refresh();
  }

  const linkClass = 'block rounded-lg px-3 py-2 text-[15px] font-medium hover:bg-slate-100';

  return (
    <>
      <button
        type="button"
        aria-label="Открыть меню"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Меню">
        <nav className="flex flex-col gap-1" aria-label="Мобильная навигация">
          <Link href="/" className={linkClass} onClick={() => setOpen(false)}>
            Мероприятия
          </Link>
          {user ? (
            <>
              {user.role === 'organizer' && (
                <>
                  <Link href="/organizer" className={`${linkClass} font-semibold text-blue-700 bg-blue-50/60`} onClick={() => setOpen(false)}>
                    Дашборд организатора
                  </Link>
                  <Link href="/organizer/events" className={linkClass} onClick={() => setOpen(false)}>
                    Мои мероприятия
                  </Link>
                  <Link href="/organizer/events/new" className={linkClass} onClick={() => setOpen(false)}>
                    + Создать событие
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <>
                  <Link href="/admin" className={`${linkClass} font-semibold text-purple-700 bg-purple-50/60`} onClick={() => setOpen(false)}>
                    Админ-панель
                  </Link>
                  <Link href="/admin/events" className={linkClass} onClick={() => setOpen(false)}>
                    Модерация событий
                  </Link>
                  <Link href="/admin/users" className={linkClass} onClick={() => setOpen(false)}>
                    Пользователи
                  </Link>
                </>
              )}
              {user.role === 'participant' && (
                <Link href="/my-tickets" className={linkClass} onClick={() => setOpen(false)}>
                  Мои билеты
                </Link>
              )}
              <Link href="/profile" className={linkClass} onClick={() => setOpen(false)}>
                Профиль
              </Link>
              <p className="px-3 pt-2 text-xs text-[var(--muted-fg)]">{ROLE_LABEL[user.role]}</p>
              <button type="button" onClick={logout} className={`${linkClass} text-left text-[var(--danger)]`}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={linkClass} onClick={() => setOpen(false)}>
                Войти
              </Link>
              <Link
                href="/register"
                className="mt-1 rounded-xl bg-[var(--primary)] px-3 py-2 text-center text-[15px] font-medium text-white"
                onClick={() => setOpen(false)}
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </Sheet>
    </>
  );
}
