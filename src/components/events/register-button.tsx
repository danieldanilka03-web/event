'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { registerForEventAction } from '@/server/actions/registrations';

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
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
      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          onClick={() => router.push(`/login?next=/events/${eventId}`)}
        >
          Войдите, чтобы записаться
        </Button>
        <Link
          href={`/register?next=/events/${eventId}`}
          className="block text-center text-sm text-[var(--primary)] hover:underline"
        >
          Нет аккаунта? Зарегистрируйтесь
        </Link>
      </div>
    );
  }

  if (isRegistered && registrationId) {
    return (
      <div className="space-y-2">
        <Button size="lg" className="w-full" onClick={() => router.push(`/tickets/${registrationId}`)}>
          Вы зарегистрированы — перейти к билету
        </Button>
        <p className="text-center text-sm text-[var(--muted-fg)]">
          <Link href="/my-tickets" className="hover:underline">
            Все мои билеты
          </Link>
        </p>
      </div>
    );
  }

  if (isCancelled || isPast || isDraft) {
    return (
      <Button size="lg" className="w-full" disabled>
        {isCancelled ? 'Мероприятие отменено' : isPast ? 'Мероприятие прошло' : 'Мероприятие не опубликовано'}
      </Button>
    );
  }

  if (seatsLeft <= 0) {
    return (
      <Button size="lg" className="w-full" disabled>
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
      toast('Вы записаны на мероприятие');
      router.push(`/tickets/${result.data.registrationId}`);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2">
      <input type="hidden" name="eventId" value={eventId} />
      <SubmitButton label="Записаться" pending={isPending} />
      {isCancelledRegistration && (
        <p className="text-center text-sm text-[var(--muted-fg)]">
          Вы отменяли запись — повторная регистрация восстановит билет.
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
