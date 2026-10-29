import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  MapPin,
  Users,
  UserCheck,
  CheckCircle2,
  Ticket,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { getCurrentUser } from '@/server/auth/session';
import { getEventById, getRegistrationForUser } from '@/server/db/queries';
import { getHall } from '@/server/db/halls';
import {
  CATEGORY_GRADIENTS,
  EVENT_STATUS_LABEL,
  type Category,
} from '@/shared/constants';
import { fillPercent, formatEventDate, formatEventTime, isPast, seatsInfo } from '@/shared/format';
import { Badge, Progress } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterButton } from '@/components/events/register-button';
import { HallPicker } from '@/components/events/hall-picker';
import { WaitlistSection } from '@/components/events/waitlist-section';
import { getWaitlistStatusForUser } from '@/server/db/waitlist';
import { ButtonLink } from '@/components/ui/button';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const event = await getEventById(id);
  if (!event) notFound();

  const registration = user ? await getRegistrationForUser(event.id, user.id) : null;
  const waitlistStatus = await getWaitlistStatusForUser(event.id, user?.id ?? null);
  const hallSeats = event.layoutRows ? await getHall(event.id, user?.id ?? null) : [];
  const mySeat = hallSeats.find((s) => s.status === 'mine');

  const seats = seatsInfo(event.maxSeats, event.occupiedSeats);
  const percent = fillPercent(event.maxSeats, event.occupiedSeats);
  const past = isPast(event.startDate);
  const gradient = CATEGORY_GRADIENTS[event.category as Category] ?? CATEGORY_GRADIENTS['Другое'];
  const isCancelled = event.status === 'cancelled';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Хлебные крошки */}
      <nav aria-label="Хлебные крошки" className="mb-6 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Link href="/" className="hover:text-indigo-600 transition-colors">
          Каталог
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-400">{event.category}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="truncate max-w-md font-semibold text-slate-800">{event.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Левая колонка */}
        <div className="space-y-6">
          {/* Обложка события */}
          <div
            className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 sm:p-8 text-white shadow-lg`}
          >
            {/* Декоративная подсветка и сетка */}
            <div
              className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 25px 25px, white 2%, transparent 0%), radial-gradient(circle at 75px 75px, white 2%, transparent 0%)',
                backgroundSize: '100px 100px',
              }}
            />
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold tracking-wide text-white backdrop-blur-md border border-white/25 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                {event.category}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md border border-white/10">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatEventDate(event.startDate)}
              </span>
            </div>

            <div className="relative z-10 mt-10 sm:mt-14">
              {event.status !== 'published' && (
                <div className="mb-2">
                  <Badge tone={event.status === 'cancelled' ? 'danger' : 'neutral'}>
                    {EVENT_STATUS_LABEL[event.status]}
                  </Badge>
                </div>
              )}
              <h1 className="text-2xl font-black tracking-tight sm:text-4xl text-white drop-shadow-xs">
                {event.title}
              </h1>
            </div>
          </div>

          {/* Организатор */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-sm font-bold text-white shadow-xs">
              {initials(event.organizerName ?? 'О')}
            </span>
            <div>
              <p className="text-xs font-medium text-slate-400">Организатор события</p>
              <p className="font-semibold text-slate-900">{event.organizerName ?? 'Организатор'}</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                <UserCheck className="h-3.5 w-3.5" />
                Подтверждён
              </span>
            </div>
          </div>

          {/* Описание */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-3">О мероприятии</h2>
            <div className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
              {event.description}
            </div>
          </div>

          {/* Интерактивная схема зала (если настроена) */}
          {event.layoutRows && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
              <h2 className="mb-4 text-lg font-bold tracking-tight text-slate-900">Выбор места в зале</h2>
              <HallPicker
                eventId={event.id}
                seats={hallSeats}
                isAuthenticated={Boolean(user)}
                isRegistered={registration?.status === 'active'}
                isPast={past}
                isUnavailable={isCancelled || event.status !== 'published'}
              />
            </section>
          )}
        </div>

        {/* Правая колонка: сайдбар */}
        <div>
          <Card className="lg:sticky lg:top-20 lg:self-start border-slate-200/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Детали мероприятия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Дата и время */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">Дата и время</p>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {formatEventDate(event.startDate)}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">Начало в {formatEventTime(event.startDate)}</p>
                </div>
              </div>

              {/* Место */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <MapPin className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">Место проведения</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{event.location}</p>
                </div>
              </div>

              {/* Заполняемость */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600">
                    <Users className="h-4 w-4 text-slate-400" />
                    Свободные места
                  </span>
                  <span className="font-bold text-slate-900">
                    {event.occupiedSeats} / {event.maxSeats}
                  </span>
                </div>
                <Progress value={percent} />
                <div className="pt-1">
                  <Badge tone={seats.tone}>{seats.label}</Badge>
                </div>
              </div>

              <div className="pt-2">
                {registration?.status === 'active' ? (
                  /* Карточка успешной регистрации */
                  <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-4 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5 font-bold text-emerald-800 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Вы зарегистрированы
                    </div>
                    {mySeat && (
                      <p className="mt-1 text-xs font-bold text-emerald-900">
                        Ряд {mySeat.rowLabel}, место {mySeat.number}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-emerald-700/80 leading-relaxed">
                      Электронный билет сохранён в вашем личном кабинете.
                    </p>
                    <ButtonLink
                      href={`/tickets/${registration.id}`}
                      size="md"
                      className="mt-3.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
                    >
                      <Ticket className="h-4 w-4 mr-1.5" />
                      Открыть билет
                    </ButtonLink>
                    <p className="mt-2.5 text-center text-xs text-slate-500">
                      <Link href="/my-tickets" className="hover:text-slate-800 hover:underline">
                        Все мои билеты →
                      </Link>
                    </p>
                  </div>
                ) : waitlistStatus.status === 'offered' ||
                  waitlistStatus.status === 'waiting' ||
                  seats.free <= 0 ? (
                  <WaitlistSection
                    eventId={event.id}
                    isAuthenticated={Boolean(user)}
                    isPast={past}
                    isCancelled={isCancelled}
                    isDraft={event.status === 'draft'}
                    seatsLeft={seats.free}
                    waitlistStatus={waitlistStatus}
                  />
                ) : !event.layoutRows ? (
                  <RegisterButton
                    eventId={event.id}
                    registrationId={registration?.id ?? null}
                    isRegistered={false}
                    isCancelledRegistration={registration?.status === 'cancelled'}
                    isAuthenticated={Boolean(user)}
                    isPast={past}
                    isCancelled={isCancelled}
                    isDraft={event.status === 'draft'}
                    seatsLeft={seats.free}
                  />
                ) : (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-center text-xs font-medium text-indigo-900 leading-relaxed">
                    👉 Выберите желаемое место на интерактивной схеме зала слева
                  </div>
                )}
              </div>

              {isCancelled && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium text-center">
                  Мероприятие отменено организатором.
                </div>
              )}
              {past && !isCancelled && (
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600 font-medium text-center">
                  Мероприятие уже состоялось.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
