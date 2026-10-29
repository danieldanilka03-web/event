'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Ticket, ArrowRight, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { registerForEventAction } from '@/server/actions/registrations';

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button
      type="submit"
      className="w-full h-11 text-base font-semibold shadow-sm hover:shadow"
      disabled={pending}
    >
      {pending ? 'Отправляем…' : label}
    </Button>
  );
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
  const toast = useToast();
  const router = useRouter();

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

  if (isRegistered && registrationId) {
    return (
      <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-4 text-center">
        <div className="inline-flex items-center justify-center gap-1.5 font-semibold text-emerald-800 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Вы записаны на событие
        </div>
        <p className="mt-1 text-xs text-emerald-700/80 leading-relaxed">
          Электронный билет сохранён в вашем личном кабинете.
        </p>
        <Button
          size="md"
          className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
          onClick={() => router.push(`/tickets/${registrationId}`)}
        >
          <Ticket className="h-4 w-4 mr-1.5" />
          Открыть билет
        </Button>
        <p className="mt-2 text-center text-xs text-slate-500">
          <Link href="/my-tickets" className="hover:text-slate-800 hover:underline">
            Все мои билеты →
          </Link>
        </p>
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

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await registerForEventAction(null, { eventId });
      if (!result.ok) {
        setError(result.error);
        toast(result.error, 'danger');
        return;
      }
      toast('Вы успешно записались на мероприятие!');
      router.push(`/tickets/${result.data.registrationId}`);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5">
      <input type="hidden" name="eventId" value={eventId} />
      <SubmitButton label="Записаться на событие" pending={isPending} />
      {isCancelledRegistration && (
        <p className="text-center text-xs text-slate-500">
          Вы ранее отменяли запись. Повторная регистрация восстановит ваш билет.
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-600 text-center font-medium" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
