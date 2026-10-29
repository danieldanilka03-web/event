'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User, Shield, LayoutDashboard, ChevronDown } from 'lucide-react';
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {initials(name)}
        </span>
        <span className="hidden text-sm font-medium lg:inline">{name}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border-ui)] bg-white py-1 shadow-lg"
        >
          <p className="px-4 py-2 text-xs text-[var(--muted-fg)]">{ROLE_LABEL[role]}</p>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50">
            <User className="h-4 w-4" aria-hidden /> Профиль
          </Link>
          {role === 'organizer' || role === 'admin' ? (
            <Link href="/organizer" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50">
              <LayoutDashboard className="h-4 w-4" aria-hidden /> Панель организатора
            </Link>
          ) : null}
          {role === 'admin' && (
            <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50">
              <Shield className="h-4 w-4" aria-hidden /> Админ-панель
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-slate-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden /> {pending ? 'Выходим…' : 'Выйти'}
          </button>
        </div>
      )}
    </div>
  );
}
