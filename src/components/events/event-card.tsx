import Link from 'next/link';
import { CalendarDays, MapPin, Users, ArrowRight, Sparkles } from 'lucide-react';
import type { EventWithMeta } from '@/server/db/queries';
import { CATEGORY_GRADIENTS, type Category } from '@/shared/constants';
import { formatEventDate, formatEventTime, seatsInfo } from '@/shared/format';
import { Badge } from '@/components/ui/badge';

export function EventCard({ event }: { event: EventWithMeta }) {
  const seats = seatsInfo(event.maxSeats, event.occupiedSeats);
  const gradient = CATEGORY_GRADIENTS[event.category as Category] ?? CATEGORY_GRADIENTS['Другое'];

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200">
      {/* Верхняя шапка с градиентом */}
      <div className={`relative h-28 sm:h-32 bg-gradient-to-br ${gradient} p-3.5 text-white overflow-hidden`}>
        {/* Декоративный узор */}
        <div
          className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15px 15px, white 2%, transparent 0%), radial-gradient(circle at 45px 45px, white 2%, transparent 0%)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-md border border-white/25 shadow-2xs">
            <Sparkles className="h-3 w-3" />
            {event.category}
          </span>

          <span className="inline-flex items-center rounded-lg bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md border border-white/10">
            {formatEventDate(event.startDate)}
          </span>
        </div>
      </div>

      {/* Тело карточки */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
          <Link href={`/events/${event.id}`} className="focus:outline-none">
            {event.title}
          </Link>
        </h3>

        <div className="mt-3 space-y-1.5 text-xs text-slate-500">
          <p className="flex items-center gap-1.5 font-medium text-slate-600">
            <CalendarDays className="h-3.5 w-3.5 text-indigo-500 shrink-0" aria-hidden />
            {formatEventDate(event.startDate)}, {formatEventTime(event.startDate)}
          </p>
          <p className="flex items-center gap-1.5 text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden />
            <span className="line-clamp-1">{event.location}</span>
          </p>
        </div>

        {/* Подвал карточки */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
          <Badge tone={seats.tone}>
            <Users className="h-3 w-3" aria-hidden />
            {seats.label}
          </Badge>
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all"
          >
            Подробнее <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
