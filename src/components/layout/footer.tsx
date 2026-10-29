import Link from 'next/link';
import { Ticket } from 'lucide-react';

export function Footer() {
  return (
    <footer className="no-print mt-20 border-t border-slate-200/80 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2.5 font-semibold text-slate-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xs">
            <Ticket className="h-4 w-4" />
          </span>
          <span className="font-bold text-slate-900">Билеты</span>
          <span className="text-slate-400 font-normal">· Платформа мероприятий и бронирования</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
          <Link href="/" className="hover:text-indigo-600 transition-colors">
            Каталог мероприятий
          </Link>
          <Link href="/login" className="hover:text-indigo-600 transition-colors">
            Вход в систему
          </Link>
          <span className="text-slate-300">|</span>
          <p className="text-slate-400">
            © {new Date().getFullYear()} Все права защищены
          </p>
        </div>
      </div>
    </footer>
  );
}
