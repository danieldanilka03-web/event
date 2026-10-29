import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-5xl font-semibold text-[var(--primary)]">404</p>
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <p className="text-[var(--muted-fg)]">
        Возможно, мероприятие удалено или ссылка указана с ошибкой.
      </p>
      <div className="flex gap-2">
        <ButtonLink href="/">В каталог</ButtonLink>
        <Link
          href="/my-tickets"
          className="rounded-xl border border-[var(--border-ui)] px-4 py-2.5 text-[15px] font-medium hover:bg-slate-50"
        >
          Мои билеты
        </Link>
      </div>
    </div>
  );
}
