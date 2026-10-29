'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Ticket, LogIn, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { registerForEventAction } from '@/server/actions/registrations';

function pluralTickets(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} билетов`;
  if (mod10 === 1) return `${count} билет`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} билета`;
  return `${count} билетов`;
}

export function RegisterButton({
  eventId,
  registrationId,
  isRegistered,
  isCancelledRegistration,
  isAuthenticated,
  isPast,
  isCancelled,
  isDraft,
  seatsLeft,
}: {
  eventId: string;
  registrationId: string | null;
  isRegistered: boolean;
  isCancelledRegistration: boolean;
  isAuthenticated: boolean;
  isPast: boolean;
  isCancelled: boolean;
  isDraft: boolean;
  seatsLeft: number;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [quantity, setQuantity] = React.useState(1);
  const toast = useToast();
  const router = useRouter();

  const maxAllowed = Math.max(1, Math.min(5, seatsLeft));

  if (!isAuthenticated) {
    return (
      <div className="space-y-2.5">
        <Button
          size="lg"
          className="w-full h-11 font-semibold"
          onClick={() => router.push(`/login?next=/events/${eventId}`)}
        >
          <LogIn className="h-4 w-4 mr-1.5" />
          Войдите, чтобы записаться
        </Button>
        <Link
          href={`/register?next=/events/${eventId}`}
          className="block text-center text-xs text-indigo-600 font-medium hover:underline"
        >
          Нет аккаунта? Зарегистрируйтесь
        </Link>
      </div>
    );
  }

  if (isCancelled || isPast || isDraft) {
    return (
      <Button size="lg" className="w-full h-11" disabled variant="outline">
        {isCancelled ? 'Мероприятие отменено' : isPast ? 'Мероприятие прошло' : 'Мероприятие не опубликовано'}
      </Button>
    );
  }

  if (seatsLeft <= 0) {
    return (
      <Button size="lg" className="w-full h-11" disabled variant="outline">
        Мест нет
      </Button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerForEventAction(null, { eventId, quantity });
      if (!result.ok) {
        setError(result.error);
        toast(result.error, 'danger');
        return;
      }
      toast(`Успешно оформлено: ${pluralTickets(quantity)}!`);
      router.push(`/tickets/${result.data.registrationId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {isRegistered && registrationId && (
        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-3.5 text-center">
          <div className="inline-flex items-center justify-center gap-1.5 font-bold text-emerald-800 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            У вас уже есть оформленный билет
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/80 leading-relaxed font-medium">
            Вы можете докупить ещё билеты для друзей или перейти к уже оформленным.
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Link
              href={`/tickets/${registrationId}`}
              className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
            >
              Открыть билет →
            </Link>
            <span className="text-emerald-300">·</span>
            <Link
              href="/my-tickets"
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              Все мои билеты
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {maxAllowed > 1 && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/80 p-2.5">
            <span className="text-xs font-bold text-slate-700 ml-1">Количество билетов:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={quantity <= 1 || isPending}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40 transition-colors"
                aria-label="Уменьшить количество"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center font-black text-slate-900 text-sm">{quantity}</span>
              <button
                type="button"
                disabled={quantity >= maxAllowed || isPending}
                onClick={() => setQuantity((q) => Math.min(maxAllowed, q + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40 transition-colors"
                aria-label="Увеличить количество"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-base font-bold shadow-sm hover:shadow bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl"
          disabled={isPending}
        >
          {isPending ? 'Оформляем…' : `Записаться (${pluralTickets(quantity)})`}
        </Button>

        {isCancelledRegistration && !isRegistered && (
          <p className="text-center text-xs text-slate-500 font-medium">
            Вы ранее отменяли запись. Новая регистрация создаст для вас свежий билет.
          </p>
        )}
        {error && (
          <p className="text-xs text-rose-600 text-center font-bold" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
