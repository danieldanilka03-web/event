import Link from 'next/link';
import { Ticket, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="no-print mt-20 border-t border-slate-200/80 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
            <Ticket className="h-3.5 w-3.5" />
          </span>
          <span>События</span>
          <span className="text-slate-400 font-normal">· Платформа мероприятий и бронирования</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <Link href="/" className="hover:text-indigo-600 transition-colors">
            Каталог мероприятий
          </Link>
          <Link href="/login" className="hover:text-indigo-600 transition-colors">
            Вход в систему
          </Link>
          <span className="text-slate-300">|</span>
          <p className="flex items-center gap-1 text-slate-400">
            Сделано с <Heart className="h-3 w-3 text-rose-500 fill-rose-500" /> для курсовой работы © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
