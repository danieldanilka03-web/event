'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Clock, Ban, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/dialog';
import { claimWaitlistSpotAction, rejectWaitlistSpotAction } from '@/server/actions/waitlist';
import { formatEventDateTime } from '@/shared/format';

export type UserActiveOffer = {
  waitlistId: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: string;
  expiresAt: string | null;
  seatLabel: string | null;
};

function OfferCard({ offer }: { offer: UserActiveOffer }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!offer.expiresAt) return;

    function update() {
      const diff = new Date(offer.expiresAt!).getTime() - Date.now();
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
  }, [offer.expiresAt, router]);

  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" /> Доступно по очереди
            </span>
            <span className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-900 bg-white/80 border border-emerald-300 rounded px-2 py-0.5">
              <Clock className="h-3 w-3 text-emerald-700" />
              {timeLeft ?? '…'}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-semibold text-slate-900">
            <Link href={`/events/${offer.eventId}`} className="hover:underline">
              {offer.eventTitle}
            </Link>
          </h3>

          <p className="text-xs sm:text-sm text-slate-600">
            {formatEventDateTime(offer.eventStartDate)}
            {offer.seatLabel && (
              <span className="ml-2 font-medium text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                {offer.seatLabel}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const res = await claimWaitlistSpotAction(null, {
                  eventId: offer.eventId,
                  waitlistId: offer.waitlistId,
                });
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
            <CheckCircle className="h-4 w-4 mr-1" />
            {isPending ? 'Оформляем…' : 'Забрать билет'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-slate-600 hover:text-red-700 hover:bg-red-50 border-slate-300"
            disabled={isPending}
            onClick={() => setRejectOpen(true)}
          >
            <Ban className="h-4 w-4 mr-1" />
            Отказаться
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        destructive
        title="Отказаться от предложенного места?"
        description={`Вы отказываетесь от места на мероприятие «${offer.eventTitle}». Оно будет передано следующему участнику из очереди.`}
        confirmLabel="Да, отказаться"
        pending={isPending}
        onConfirm={async () => {
          startTransition(async () => {
            const res = await rejectWaitlistSpotAction(null, {
              eventId: offer.eventId,
              waitlistId: offer.waitlistId,
            });
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

export function ActiveOffersBanner({ offers }: { offers: UserActiveOffer[] }) {
  if (offers.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {offers.map((offer) => (
        <OfferCard key={offer.waitlistId} offer={offer} />
      ))}
    </div>
  );
}
