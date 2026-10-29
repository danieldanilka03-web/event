import Link from 'next/link';
import { CalendarDays, MapPin, Users, ArrowRight } from 'lucide-react';
import type { EventWithMeta } from '@/server/db/queries';
import { CATEGORY_GRADIENTS, type Category } from '@/shared/constants';
import { formatEventDateTime, seatsInfo } from '@/shared/format';
import { Badge } from '@/components/ui/badge';

export function EventCard({ event }: { event: EventWithMeta }) {
  const seats = seatsInfo(event.maxSeats, event.occupiedSeats);
  const gradient = CATEGORY_GRADIENTS[event.category as Category] ?? CATEGORY_GRADIENTS['Другое'];

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border-ui)] bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className={`h-20 bg-gradient-to-br ${gradient}`} aria-hidden />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <span className="text-sm font-medium text-[var(--accent)]">{event.category}</span>
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug">
          <Link href={`/events/${event.id}`} className="hover:text-[var(--primary)]">
            {event.title}
          </Link>
        </h3>
        <p className="flex items-start gap-2 text-sm text-[var(--muted-fg)]">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {formatEventDateTime(event.startDate)}
        </p>
        <p className="flex items-start gap-2 text-sm text-[var(--muted-fg)]">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="line-clamp-2">{event.location}</span>
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <Badge tone={seats.tone}>
            <Users className="h-3.5 w-3.5" aria-hidden />
            {seats.label}
          </Badge>
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Подробнее <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
