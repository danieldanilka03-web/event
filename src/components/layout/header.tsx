import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { UserMenu } from './user-menu';
import { MobileMenu } from './mobile-menu';
import { NavLinks } from './nav-links';
import { Ticket, Sparkles } from 'lucide-react';

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

        {/* Навигация десктоп с активной подсветкой */}
        <NavLinks role={user?.role} />

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
