import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin, Users, User } from 'lucide-react';
import { getCurrentUser } from '@/server/auth/session';
import { getEventById, getRegistrationForUser } from '@/server/db/queries';
import { getHall } from '@/server/db/halls';
import { CATEGORY_GRADIENTS, EVENT_STATUS_LABEL, type Category } from '@/shared/constants';
import { fillPercent, formatEventDate, formatEventTime, isPast, seatsInfo } from '@/shared/format';
import { Badge, Progress } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterButton } from '@/components/events/register-button';
import { HallPicker } from '@/components/events/hall-picker';
import { WaitlistSection } from '@/components/events/waitlist-section';
import { getWaitlistStatusForUser } from '@/server/db/waitlist';
import { ButtonLink } from '@/components/ui/button';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Сессию читаем до notFound(): иначе Next успевает отдать «оболочку» страницы
  // и ответ для несуществующего мероприятия ушёл бы со статусом 200.
  const user = await getCurrentUser();
  const event = await getEventById(id);
  if (!event) notFound();

  const registration = user ? await getRegistrationForUser(event.id, user.id) : null;
  const waitlistStatus = await getWaitlistStatusForUser(event.id, user?.id ?? null);

  // Мероприятия с фиксированной рассадкой показывают интерактивную схему зала.
  const hallSeats = event.layoutRows ? await getHall(event.id, user?.id ?? null) : [];

  const seats = seatsInfo(event.maxSeats, event.occupiedSeats);
  const percent = fillPercent(event.maxSeats, event.occupiedSeats);
  const past = isPast(event.startDate);
  const gradient = CATEGORY_GRADIENTS[event.category as Category] ?? CATEGORY_GRADIENTS['Другое'];
  const isCancelled = event.status === 'cancelled';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav aria-label="Хлебные крошки" className="mb-4 text-sm text-[var(--muted-fg)]">
        <Link href="/" className="hover:underline">
          Мероприятия
        </Link>
        <span className="mx-2">/</span>
        <span className="line-clamp-1">{event.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className={`h-32 rounded-xl bg-gradient-to-br sm:h-40 ${gradient}`} aria-hidden />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--accent)]">{event.category}</span>
            {event.status !== 'published' && (
              <Badge tone={event.status === 'cancelled' ? 'danger' : 'neutral'}>
                {EVENT_STATUS_LABEL[event.status]}
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{event.title}</h1>
          <div className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-700">
            {event.description}
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--muted-fg)]">
            <User className="h-4 w-4" aria-hidden />
            Организатор: {event.organizerName}
          </p>

          {event.layoutRows && (
            <section className="mt-6 rounded-xl border border-[var(--border-ui)] bg-white p-4 sm:p-5">
              <h2 className="mb-4 text-lg font-semibold">Выбор места в зале</h2>
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

        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardHeader>
            <CardTitle>Детали мероприятия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              <div>
                <p className="text-sm text-[var(--muted-fg)]">Дата и время</p>
                <p className="font-medium">
                  {formatEventDate(event.startDate)}, {formatEventTime(event.startDate)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              <div>
                <p className="text-sm text-[var(--muted-fg)]">Место проведения</p>
                <p className="font-medium">{event.location}</p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Users className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
                <p className="text-sm text-[var(--muted-fg)]">Занято мест</p>
              </div>
              <p className="font-medium">
                {event.occupiedSeats} из {event.maxSeats}
              </p>
              <div className="mt-2">
                <Progress value={percent} />
              </div>
              <p className="mt-2">
                <Badge tone={seats.tone}>{seats.label}</Badge>
              </p>
            </div>

            {registration?.status === 'active' ? (
              event.layoutRows ? (
                <div className="space-y-2">
                  <ButtonLink href={`/tickets/${registration.id}`} size="lg" className="w-full">
                    Вы зарегистрированы — перейти к билету
                  </ButtonLink>
                  <p className="text-center text-sm text-[var(--muted-fg)]">
                    <Link href="/my-tickets" className="hover:underline">
                      Все мои билеты
                    </Link>
                  </p>
                </div>
              ) : (
                <RegisterButton
                  eventId={event.id}
                  registrationId={registration.id}
                  isRegistered={true}
                  isCancelledRegistration={false}
                  isAuthenticated={Boolean(user)}
                  isPast={past}
                  isCancelled={isCancelled}
                  isDraft={event.status === 'draft'}
                  seatsLeft={seats.free}
                />
              )
            ) : waitlistStatus.status === 'offered' || waitlistStatus.status === 'waiting' || seats.free <= 0 ? (
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
              <p className="rounded-xl border border-[var(--border-ui)] bg-slate-50 p-3 text-center text-sm text-[var(--muted-fg)]">
                Выберите желаемое место на схеме зала слева
              </p>
            )}

            {isCancelled && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Мероприятие отменено организатором.
              </p>
            )}
            {past && !isCancelled && (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                Мероприятие уже прошло.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
