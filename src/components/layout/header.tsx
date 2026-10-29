import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { UserMenu } from './user-menu';
import { MobileMenu } from './mobile-menu';
import { Ticket, Sparkles, Plus } from 'lucide-react';

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all shadow-2xs">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        {/* Логотип и название */}
        <Link href="/" className="group flex items-center gap-2.5 font-bold tracking-tight text-slate-900 transition-opacity hover:opacity-90">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform duration-200">
            <Ticket className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent">
              События
            </span>
            <span className="hidden md:inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 border border-indigo-100">
              <Sparkles className="h-2.5 w-2.5" /> PRO
            </span>
          </div>
        </Link>

        {/* Навигация десктоп */}
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Основная навигация">
          <Link
            href="/"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100/70 transition-colors"
          >
            Мероприятия
          </Link>

          {user?.role === 'organizer' && (
            <>
              <Link
                href="/organizer"
                className="rounded-xl px-3.5 py-2 text-sm font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-100 transition-colors"
              >
                Дашборд
              </Link>
              <Link
                href="/organizer/events"
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
              >
                Мои мероприятия
              </Link>
              <Link
                href="/organizer/events/new"
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Создать
              </Link>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <Link
                href="/admin"
                className="rounded-xl px-3.5 py-2 text-sm font-semibold text-purple-700 bg-purple-50/80 hover:bg-purple-100/80 border border-purple-100 transition-colors"
              >
                Админ-панель
              </Link>
              <Link
                href="/admin/events"
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
              >
                Модерация
              </Link>
              <Link
                href="/admin/users"
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
              >
                Пользователи
              </Link>
            </>
          )}

          {user?.role === 'participant' && (
            <Link
              href="/my-tickets"
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100/70 transition-colors"
            >
              Мои билеты
            </Link>
          )}
        </nav>

        {/* Правая часть: авторизация / профиль */}
        <div className="ml-auto hidden items-center gap-3 sm:flex">
          {user ? (
            <UserMenu name={user.fullName} role={user.role} />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-xs shadow-indigo-200 active:scale-[0.98] transition-all"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>

        {/* Мобильное меню */}
        <div className="ml-auto sm:hidden">
          <MobileMenu
            user={user ? { name: user.fullName, role: user.role } : null}
          />
        </div>
      </div>
    </header>
  );
}
