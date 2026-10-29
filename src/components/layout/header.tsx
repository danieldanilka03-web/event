import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { UserMenu } from './user-menu';
import { MobileMenu } from './mobile-menu';
import { Calendar } from 'lucide-react';

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-[var(--border-ui)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
            <Calendar className="h-5 w-5" aria-hidden />
          </span>
          <span className="hidden sm:inline">События</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Основная навигация">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">
            Мероприятия
          </Link>
          {user && (
            <Link href="/my-tickets" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">
              Мои билеты
            </Link>
          )}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {user ? (
            <UserMenu name={user.fullName} role={user.role} />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto sm:hidden">
          <MobileMenu
            user={user ? { name: user.fullName, role: user.role } : null}
          />
        </div>
      </div>
    </header>
  );
}
