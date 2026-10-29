'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User, Shield, LayoutDashboard, ChevronDown, Ticket } from 'lucide-react';
import { logoutAction } from '@/server/actions/auth';
import { ROLE_LABEL } from '@/shared/constants';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu({ name, role }: { name: string; role: 'participant' | 'organizer' | 'admin' }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleLogout() {
    setPending(true);
    await logoutAction();
    router.push('/');
    router.refresh();
  }

  const roleStyles = {
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
    organizer: 'bg-blue-100 text-blue-700 border-blue-200',
    participant: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  }[role];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 shadow-2xs hover:bg-slate-50 transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-bold text-white shadow-xs">
          {initials(name)}
        </span>
        <span className="hidden text-sm font-semibold text-slate-800 lg:inline">{name}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 z-50"
        >
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <p className="text-xs font-medium text-slate-400">Роль в системе</p>
            <div className="mt-1 flex items-center justify-between">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${roleStyles}`}>
                {ROLE_LABEL[role]}
              </span>
              <span className="text-xs text-slate-500 truncate max-w-[120px]">{name}</span>
            </div>
          </div>

          <div className="space-y-0.5">
            {role === 'organizer' && (
              <Link
                href="/organizer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-blue-600" aria-hidden /> Панель организатора
              </Link>
            )}

            {role === 'admin' && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <Shield className="h-4 w-4 text-purple-600" aria-hidden /> Админ-панель
              </Link>
            )}

            {role === 'participant' && (
              <Link
                href="/my-tickets"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
              >
                <Ticket className="h-4 w-4 text-indigo-600" aria-hidden /> Мои билеты
              </Link>
            )}

            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <User className="h-4 w-4 text-slate-500" aria-hidden /> Профиль
            </Link>
          </div>

          <div className="mt-1 pt-1 border-t border-slate-100">
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden /> {pending ? 'Выходим…' : 'Выйти из аккаунта'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
