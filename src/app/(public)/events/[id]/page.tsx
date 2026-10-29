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
  Clock,
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
      <nav aria-label="Хлебные крошки" className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Link href="/" className="hover:text-indigo-600 transition-colors">
          Каталог событий
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-400">{event.category}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="truncate max-w-md font-bold text-slate-800">{event.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Левая колонка */}
        <div className="space-y-6">
          {/* Обложка события (Apple / Luma Aesthetic) */}
          <div
            className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 sm:p-10 text-white shadow-xl shadow-indigo-900/10`}
          >
            {/* Фоновый узор и подсветка */}
            <div
              className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 25px 25px, white 2%, transparent 0%), radial-gradient(circle at 75px 75px, white 2%, transparent 0%)',
                backgroundSize: '100px 100px',
              }}
            />
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-black tracking-wide text-white backdrop-blur-md border border-white/25 shadow-xs">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                {event.category}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3.5 py-1 text-xs font-semibold text-white/95 backdrop-blur-md border border-white/15">
                  <CalendarDays className="h-3.5 w-3.5 text-indigo-300" />
                  {formatEventDate(event.startDate)} в {formatEventTime(event.startDate)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3.5 py-1 text-xs font-semibold text-white/95 backdrop-blur-md border border-white/15">
                  <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                  {event.location}
                </span>
              </div>
            </div>

            <div className="relative z-10 mt-8 sm:mt-12">
              {event.status !== 'published' && (
                <div className="mb-3">
                  <Badge tone={event.status === 'cancelled' ? 'danger' : 'neutral'}>
                    {EVENT_STATUS_LABEL[event.status]}
                  </Badge>
                </div>
              )}
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-sm leading-tight">
                {event.title}
              </h1>
            </div>
          </div>

          {/* Организатор события */}
          <div className="flex items-center gap-3.5 rounded-3xl border border-slate-200/80 bg-white/95 p-4 sm:p-5 shadow-xs">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-sm font-black text-white shadow-sm shadow-indigo-200">
              {initials(event.organizerName ?? 'О')}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Организатор события</p>
              <p className="font-bold text-slate-900 text-base">{event.organizerName ?? 'Официальный организатор'}</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/90 shadow-2xs">
                <UserCheck className="h-3.5 w-3.5" />
                Верифицирован
              </span>
            </div>
          </div>

          {/* Описание события */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-3.5">О мероприятии</h2>
            <div className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700 font-normal">
              {event.description}
            </div>
          </div>

          {/* Интерактивная схема зала (если настроена) */}
          {event.layoutRows && (
            <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 sm:p-8 shadow-xs">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">Выбор места в зале</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Кликните на свободное место, чтобы забронировать его на 10 минут
                  </p>
                </div>
              </div>
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

        {/* Правая колонка: сайдбар оформления билета */}
        <div>
          <Card className="lg:sticky lg:top-24 lg:self-start border-slate-200/80 shadow-md">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-black">Бронирование билета</CardTitle>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  Вход свободный
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Дата и время */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400">Дата и время</p>
                  <p className="font-bold text-slate-900 mt-0.5 text-sm">
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
                  <p className="text-xs font-semibold text-slate-400">Локация</p>
                  <p className="font-bold text-slate-900 mt-0.5 text-sm">{event.location}</p>
                </div>
              </div>

              {/* Заполняемость зала */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <Users className="h-4 w-4 text-slate-400" />
                    Заполняемость зала
                  </span>
                  <span className="font-bold text-slate-900">
                    {event.occupiedSeats} / {event.maxSeats}
                  </span>
                </div>
                <Progress value={percent} />
                <div className="pt-1">
                  <Badge tone={seats.tone} withDot>{seats.label}</Badge>
                </div>
              </div>

              {/* Блок действия / Статус регистрации */}
              <div className="pt-2">
                {registration?.status === 'active' ? (
                  /* Карточка успешной регистрации */
                  <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/80 p-4 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5 font-bold text-emerald-900 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Вы зарегистрированы
                    </div>
                    {mySeat && (
                      <p className="mt-1 text-xs font-black text-emerald-950">
                        Ряд {mySeat.rowLabel}, место {mySeat.number}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-emerald-700/90 leading-relaxed font-medium">
                      Электронный билет сохранён в личном кабинете.
                    </p>
                    <ButtonLink
                      href={`/tickets/${registration.id}`}
                      size="md"
                      className="mt-3.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold"
                    >
                      <Ticket className="h-4 w-4 mr-1.5" />
                      Открыть билет
                    </ButtonLink>
                    <p className="mt-2.5 text-center text-xs text-slate-500 font-semibold">
                      <Link href="/my-tickets" className="hover:text-slate-900 hover:underline">
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
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-center text-xs font-bold text-indigo-900 leading-relaxed">
                    👉 Выберите желаемое место на схеме зала слева
                  </div>
                )}
              </div>

              {isCancelled && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-bold text-center">
                  Мероприятие отменено организатором.
                </div>
              )}
              {past && !isCancelled && (
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600 font-bold text-center">
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
