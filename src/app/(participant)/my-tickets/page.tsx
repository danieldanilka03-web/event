import type { Metadata } from 'next';
import { requireUser } from '@/server/auth/guards';
import { getUserTickets } from '@/server/db/queries';
import { getUserActiveOffers } from '@/server/db/waitlist';
import { ActiveOffersBanner, type UserActiveOffer } from '@/components/events/active-offers-banner';
import { MyTicketsClient } from './my-tickets-client';

export const metadata: Metadata = { title: 'Мои билеты' };
export const dynamic = 'force-dynamic';

export default async function MyTicketsPage() {
  const user = await requireUser();
  const [tickets, rawOffers] = await Promise.all([
    getUserTickets(user.id),
    getUserActiveOffers(user.id),
  ]);

  const offers: UserActiveOffer[] = rawOffers.map((o) => ({
    waitlistId: o.waitlistId,
    eventId: o.eventId,
    eventTitle: o.eventTitle,
    eventStartDate: o.eventStartDate,
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    seatLabel: o.rowLabel && o.seatNumber !== null ? `Ряд ${o.rowLabel}, место ${o.seatNumber}` : null,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">Мои билеты</h1>
      <p className="mt-1 text-sm text-[var(--muted-fg)]">
        Записи на мероприятия, которые вы забронировали.
      </p>

      <div className="mt-6">
        <ActiveOffersBanner offers={offers} />
        <MyTicketsClient tickets={tickets} />
      </div>
    </div>
  );
}
