'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, XCircle, Pencil, Users, Trash2, Clock, MapPin, CalendarDays } from 'lucide-react';
import type { EventWithParticipants } from '@/server/db/queries';
import { fillPercent, formatEventDateTime, isPast } from '@/shared/format';
import { Badge, Progress } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { ConfirmDialog, EmptyState } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { deleteEventAction, setEventStatusAction } from '@/server/actions/events';
import type { EventStatusInput } from '@/shared/validators';

function StatusForm({ eventId, status }: { eventId: string; status: EventStatusInput }) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(next: EventStatusInput) {
    startTransition(async () => {
      const result = await setEventStatusAction(null, { eventId, status: next });
      if (result.ok) {
        toast(`Статус изменён: ${next === 'draft' ? 'черновик' : next === 'published' ? 'опубликовано' : 'отменено'}`);
        router.refresh();
      } else {
        toast(result.error, 'danger');
      }
    });
  }

  if (status === 'published') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2.5 text-xs font-medium"
        disabled={isPending}
        onClick={() => submit('draft')}
        title="Снять с публикации (вернуть в черновик)"
        aria-label="Снять с публикации"
      >
        <EyeOff className="h-3.5 w-3.5 text-amber-600" aria-hidden /> {isPending ? '…' : 'В черновик'}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 px-2.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
      disabled={isPending}
      onClick={() => submit('published')}
      title="Опубликовать мероприятие"
      aria-label="Опубликовать мероприятие"
    >
      <Eye className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> {isPending ? '…' : 'Опубликовать'}
    </Button>
  );
}

function CancelEventButton({ event }: { event: EventWithParticipants }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  if (event.status === 'cancelled') return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-[var(--muted-fg)] hover:text-amber-700 hover:bg-amber-50"
        onClick={() => setOpen(true)}
        title="Отменить мероприятие"
        aria-label="Отменить мероприятие"
      >
        <XCircle className="h-3.5 w-3.5" aria-hidden /> Отменить
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        pending={pending}
        destructive
        title="Отменить мероприятие?"
        description="Мероприятие исчезнет из каталога. Записи участников сохранятся в кабинете с пометкой «Мероприятие отменено»."
        confirmLabel="Отменить мероприятие"
        onConfirm={async () => {
          setPending(true);
          const result = await setEventStatusAction(null, { eventId: event.id, status: 'cancelled' });
          setPending(false);
          setOpen(false);
          if (result.ok) {
            toast('Мероприятие отменено');
            router.refresh();
          } else toast(result.error, 'danger');
        }}
      />
    </>
  );
}

function DeleteEventButton({ event, participants }: { event: EventWithParticipants; participants: number }) {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[var(--danger)] hover:bg-red-50"
        onClick={() => setOpen(true)}
        title="Удалить мероприятие"
        aria-label="Удалить мероприятие"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        pending={pending}
        destructive
        title="Удалить мероприятие?"
        description={
          participants > 0
              ? `У мероприятия ${participants} активных участн. Введите число ${participants}, чтобы подтвердить удаление.`
            : 'Активных регистраций нет. Мероприятие будет удалено безвозвратно.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Отмена
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                if (participants > 0 && confirmText.trim() !== String(participants)) {
                  setPending(false);
                  toast(`Введите число участников (${participants}) для подтверждения`, 'danger');
                  return;
                }
                const result = await deleteEventAction(null, {
                  eventId: event.id,
                  confirmParticipants: confirmText.trim(),
                });
                setPending(false);
                setOpen(false);
                if (result.ok) {
                  toast('Мероприятие удалено');
                  router.push('/organizer/events');
                  router.refresh();
                } else toast(result.error, 'danger');
              }}
            >
              {pending ? 'Удаляем…' : 'Удалить'}
            </Button>
          </>
        }
      >
        {participants > 0 && (
          <input
            className="mt-3 h-10 w-full rounded-xl border border-[var(--border-ui)] px-3"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Введите ${participants}`}
            aria-label="Подтверждение числом участников"
          />
        )}
      </ConfirmDialog>
    </>
  );
}

export function OrganizerEventsClient({ events }: { events: EventWithParticipants[] }) {
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get('q') ?? '';

  if (events.length === 0) {
    return (
      <EmptyState
        title="Ничего не найдено"
        description={currentSearch ? 'Попробуйте изменить поисковый запрос.' : 'Создайте своё первое мероприятие.'}
        action={<ButtonLink href="/organizer/events/new" size="sm">Создать мероприятие</ButtonLink>}
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <Table className="min-w-[1040px]">
          <THead>
            <TH className="min-w-[280px]">Название</TH>
            <TH className="min-w-[160px]">Дата и время</TH>
            <TH className="min-w-[130px]">Статус</TH>
            <TH className="min-w-[170px]">Заполняемость</TH>
            <TH className="min-w-[340px] text-right">Действия</TH>
          </THead>
          <tbody className="divide-y divide-slate-100">
            {events.map((event) => {
              const percent = fillPercent(event.maxSeats, event.occupiedSeats);
              const activeParticipants = event.activeParticipants;
              return (
                <TR key={event.id} className="hover:bg-slate-50/60 transition-colors">
                  <TD className="max-w-[280px] py-4">
                    <p className="truncate font-bold text-slate-900">{event.title}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-slate-500 mt-1">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">{event.location}</span>
                    </p>
                  </TD>
                  <TD className="whitespace-nowrap py-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <CalendarDays className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      {formatEventDateTime(event.startDate)}
                    </div>
                    {isPast(event.startDate) && (
                      <span className="inline-block mt-1 text-[11px] font-medium text-slate-400">
                        Уже состоялось
                      </span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap py-4">
                    <Badge
                      tone={
                        event.status === 'published'
                          ? 'success'
                          : event.status === 'cancelled'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {event.status === 'published'
                        ? 'Опубликовано'
                        : event.status === 'cancelled'
                          ? 'Отменено'
                          : 'Черновик'}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap py-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          {event.occupiedSeats} / {event.maxSeats}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">{percent}%</span>
                      </div>
                      <div className="w-28">
                        <Progress value={percent} />
                      </div>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-right py-4">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <ButtonLink
                        href={`/organizer/events/${event.id}/participants`}
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs"
                        title="Список участников"
                      >
                        <Users className="h-3.5 w-3.5 text-indigo-600 mr-1" aria-hidden />
                        Участники ({activeParticipants})
                      </ButtonLink>
                      <ButtonLink
                        href={`/organizer/events/${event.id}/waitlist`}
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs"
                        title="Лист ожидания"
                      >
                        <Clock className="h-3.5 w-3.5 text-amber-600 mr-1" aria-hidden />
                        Очередь
                      </ButtonLink>
                      <ButtonLink
                        href={`/organizer/events/${event.id}/edit`}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        title="Редактировать мероприятие"
                        aria-label="Редактировать мероприятие"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </ButtonLink>
                      <StatusForm eventId={event.id} status={event.status} />
                      <CancelEventButton event={event} />
                      <DeleteEventButton event={event} participants={activeParticipants} />
                    </div>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </>
  );
}
