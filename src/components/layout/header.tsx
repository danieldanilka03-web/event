import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { UserMenu } from './user-menu';
import { MobileMenu } from './mobile-menu';
import { NavLinks } from './nav-links';
import { Ticket, Sparkles } from 'lucide-react';

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="no-print sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-xl transition-all shadow-2xs">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Логотип и брендинг */}
        <Link href="/" className="group flex items-center gap-2.5 font-bold tracking-tight text-slate-900 transition-opacity hover:opacity-95">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 group-hover:shadow-indigo-500/40 transition-all duration-200">
            <Ticket className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-lg font-black tracking-tight text-slate-900">
                Билеты
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 border border-indigo-100">
                <Sparkles className="h-2.5 w-2.5" /> LIVE
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
              Event Platform
            </span>
          </div>
        </Link>

        {/* Навигация десктоп с мягкими пилюлями */}
        <NavLinks role={user?.role} />

        {/* Правая часть: авторизация / профиль */}
        <div className="hidden items-center gap-3 sm:flex">
          {user ? (
            <UserMenu name={user.fullName} role={user.role} />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300 active:scale-[0.98] transition-all"
              >
                Регистрация
              </Link>
            </div>
          )}
        </div>

        {/* Мобильное меню */}
        <div className="sm:hidden">
          <MobileMenu
            user={user ? { name: user.fullName, role: user.role } : null}
          />
        </div>
      </div>
    </header>
  );
}
