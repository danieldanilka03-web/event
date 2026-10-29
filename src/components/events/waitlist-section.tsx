'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/dialog';
import type { WaitlistUserStatus } from '@/shared/waitlist';
import {
  joinWaitlistAction,
  leaveWaitlistAction,
  claimWaitlistSpotAction,
  rejectWaitlistSpotAction,
} from '@/server/actions/waitlist';

export function WaitlistSection({
  eventId,
  isAuthenticated,
  isPast,
  isCancelled,
  isDraft,
  seatsLeft,
  waitlistStatus,
}: {
  eventId: string;
  isAuthenticated: boolean;
  isPast: boolean;
  isCancelled: boolean;
  isDraft: boolean;
  seatsLeft: number;
  waitlistStatus: WaitlistUserStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);

  // Таймер обратного отсчёта для оффера
  const [timeLeft, setTimeLeft] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!waitlistStatus.expiresAt) {
      setTimeLeft(null);
      return;
    }

    function update() {
      const diff = new Date(waitlistStatus.expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Истекло');
        router.refresh();
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [waitlistStatus.expiresAt, router]);

  // Не показывать, если событие отменено, прошло или черновик
  if (isCancelled || isPast || isDraft) {
    return null;
  }

  // Сценарий 1: Пользователю предложено освободившееся место (offered)
  if (waitlistStatus.status === 'offered' && waitlistStatus.waitlistId) {
    const waitlistId = waitlistStatus.waitlistId;

    return (
      <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/60 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-800">
          <Sparkles className="h-5 w-5 text-emerald-600 animate-pulse" />
          <h3 className="font-semibold text-base">Вам предложено место!</h3>
        </div>

        <p className="mt-2 text-sm text-emerald-900 leading-snug">
          Кто-то отменил запись, и место зарезервировано за вами.
        </p>

        {waitlistStatus.offeredSeatLabel && (
          <p className="mt-2 text-sm font-medium text-emerald-950 bg-emerald-100/80 rounded-lg px-2.5 py-1.5 inline-block">
            {waitlistStatus.offeredSeatLabel}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-emerald-800">
          <span className="flex items-center gap-1 font-medium">
            <Clock className="h-3.5 w-3.5" /> До завершения брони:
          </span>
          <span className="font-mono text-sm font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
            {timeLeft ?? '…'}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const res = await claimWaitlistSpotAction(null, { eventId, waitlistId });
                if (res.ok) {
                  toast('🎉 Билет успешно оформлен!', 'success');
                  router.push(`/tickets/${res.data.registrationId}`);
                  router.refresh();
                } else {
                  toast(res.error, 'danger');
                }
              });
            }}
          >
            {isPending ? 'Оформляем…' : 'Подтвердить и забрать билет'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-slate-700 hover:text-red-700 hover:bg-red-50 border-emerald-200"
            disabled={isPending}
            onClick={() => setRejectOpen(true)}
          >
            Отказаться в пользу следующего
          </Button>
        </div>

        <ConfirmDialog
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          destructive
          title="Отказаться от предложенного места?"
          description="Место будет немедленно передано следующему участнику из листа ожидания."
          confirmLabel="Да, отказаться"
          pending={isPending}
          onConfirm={async () => {
            startTransition(async () => {
              const res = await rejectWaitlistSpotAction(null, { eventId, waitlistId });
              setRejectOpen(false);
              if (res.ok) {
                toast('Вы отказались от места');
                router.refresh();
              } else {
                toast(res.error, 'danger');
              }
            });
          }}
        />
      </div>
    );
  }

  // Сценарий 2: Пользователь уже в очереди ожидания (waiting)
  if (waitlistStatus.status === 'waiting') {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Clock className="h-4 w-4 text-amber-700" /> Вы в листе ожидания
          </span>
          <Badge tone="warning">В очереди</Badge>
        </div>

        <div className="mt-3 rounded-lg bg-white/90 p-3 border border-amber-200 text-center">
          <div className="text-2xl font-bold text-amber-950 font-mono">
            №{waitlistStatus.position ?? 1}
          </div>
          <p className="text-xs text-amber-800 mt-0.5">
            из {waitlistStatus.totalWaiting} {waitlistStatus.totalWaiting === 1 ? 'человека' : 'человек'} в очереди
          </p>
        </div>

        <p className="mt-3 text-xs text-amber-900 leading-relaxed">
          Как только другой участник отменит свой билет, система автоматически зарезервирует его для вас на 30 минут.
        </p>

        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-amber-900 border-amber-300 hover:bg-amber-100"
            disabled={isPending}
            onClick={() => setLeaveOpen(true)}
          >
            Покинуть очередь
          </Button>
        </div>

        <ConfirmDialog
          open={leaveOpen}
          onClose={() => setLeaveOpen(false)}
          destructive
          title="Выйти из листа ожидания?"
          description="Ваше место в очереди будет аннулировано."
          confirmLabel="Покинуть очередь"
          pending={isPending}
          onConfirm={async () => {
            startTransition(async () => {
              const res = await leaveWaitlistAction(null, { eventId });
              setLeaveOpen(false);
              if (res.ok) {
                toast('Вы покинули лист ожидания');
                router.refresh();
              } else {
                toast(res.error, 'danger');
              }
            });
          }}
        />
      </div>
    );
  }

  // Сценарий 3: Мест нет (seatsLeft <= 0), пользователь ещё не в очереди
  if (seatsLeft <= 0) {
    if (!isAuthenticated) {
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-sm font-medium text-slate-800">Все места заняты</p>
          <p className="mt-1 text-xs text-[var(--muted-fg)]">
            {waitlistStatus.totalWaiting > 0
              ? `В листе ожидания: ${waitlistStatus.totalWaiting} чел.`
              : 'Лист ожидания свободен'}
          </p>
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={() => router.push(`/login?next=/events/${eventId}`)}
          >
            Войдите, чтобы встать в очередь
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-[var(--border-ui)] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <h4 className="font-semibold text-sm">Все места заняты</h4>
        </div>

        <p className="mt-2 text-xs text-[var(--muted-fg)] leading-relaxed">
          Запишитесь в лист ожидания. Если кто-то откажется от билета, система автоматически выделит место вам на 30 минут.
        </p>

        {waitlistStatus.totalWaiting > 0 && (
          <p className="mt-2 text-xs font-medium text-slate-700">
            Сейчас в очереди: <span className="font-mono">{waitlistStatus.totalWaiting}</span> чел.
          </p>
        )}

        <Button
          size="lg"
          className="mt-4 w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-medium"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const res = await joinWaitlistAction(null, { eventId });
              if (res.ok) {
                toast(`Вы встали в лист ожидания (позиция №${res.data.position})`, 'success');
                router.refresh();
              } else {
                toast(res.error, 'danger');
              }
            });
          }}
        >
          {isPending ? 'Записываем…' : 'Встать в лист ожидания'}
        </Button>
      </div>
    );
  }

  return null;
}
