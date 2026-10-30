import Link from 'next/link';
import { CalendarDays, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import type { EventWithMeta } from '@/server/db/queries';
import { CATEGORY_GRADIENTS, type Category } from '@/shared/constants';
import { formatEventDate, formatEventTime, seatsInfo } from '@/shared/format';
import { getEventImageUrl } from '@/shared/event-images';
import { Badge } from '@/components/ui/badge';

function getMonthAndDay(date: Date) {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleString('ru-RU', { month: 'short' }).toUpperCase().replace('.', '');
  return { day, month };
}

export function EventCard({ event }: { event: EventWithMeta }) {
  const seats = seatsInfo(event.maxSeats, event.occupiedSeats);
  const { day, month } = getMonthAndDay(event.startDate);
  const imageUrl = getEventImageUrl(event);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200">
      {/* Шапка карточки / визуальный постер с фото */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={event.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        {/* Мягкий градиентный оверлей поверх фото для контраста */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-black/20 to-black/30 pointer-events-none" />

        <div className="absolute inset-0 p-3.5 flex items-start justify-between gap-2 z-10 pointer-events-none">
          {/* Дата-стикер (день + месяц) */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/95 px-2.5 py-1 text-slate-900 shadow-lg backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 leading-none">
              {month}
            </span>
            <span className="text-base font-black leading-none mt-0.5">{day}</span>
          </div>

          {/* Бейдж категории */}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 backdrop-blur-md px-3 py-1 text-xs font-bold text-white border border-white/20 shadow-md">
            <Sparkles className="h-3 w-3 text-amber-300" />
            {event.category}
          </span>
        </div>
      </div>

      {/* Тело карточки */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
          <Link href={`/events/${event.id}`} className="focus:outline-none">
            {event.title}
          </Link>
        </h3>

        <div className="mt-3.5 space-y-2 text-xs">
          <p className="flex items-center gap-2 font-semibold text-slate-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>
              {formatEventDate(event.startDate)} в {formatEventTime(event.startDate)}
            </span>
          </p>
          <p className="flex items-center gap-2 text-slate-500">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="truncate">{event.location}</span>
          </p>
        </div>

        {/* Подвал карточки */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
          <Badge tone={seats.tone} withDot>
            {seats.label}
          </Badge>

          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-200"
          >
            Билеты <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
