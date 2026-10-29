'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, XCircle, Pencil, Users, Trash2, Clock } from 'lucide-react';
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
      <div className="overflow-hidden rounded-xl border border-[var(--border-ui)] bg-white shadow-2xs">
        <Table className="min-w-[960px]">
          <THead>
            <TH className="w-[280px]">Название</TH>
            <TH className="w-[150px]">Дата</TH>
            <TH className="w-[120px]">Статус</TH>
            <TH className="w-[140px]">Заполняемость</TH>
            <TH className="text-right">Действия</TH>
          </THead>
          <tbody>
            {events.map((event) => {
              const percent = fillPercent(event.maxSeats, event.occupiedSeats);
              const activeParticipants = event.activeParticipants;
              return (
                <TR key={event.id}>
                  <TD className="max-w-[280px]">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="truncate text-sm text-[var(--muted-fg)]">{event.location}</p>
                  </TD>
                  <TD className="whitespace-nowrap text-[var(--muted-fg)]">
                    {formatEventDateTime(event.startDate)}
                    {isPast(event.startDate) && (
                      <Badge tone="neutral" className="ml-2">
                        Прошло
                      </Badge>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">
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
                  <TD className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <Progress value={percent} />
                      </div>
                      <span className="whitespace-nowrap text-xs text-[var(--muted-fg)]">
                        {event.occupiedSeats}/{event.maxSeats}
                      </span>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <ButtonLink
                        href={`/organizer/events/${event.id}/participants`}
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-medium"
                        title="Список участников"
                      >
                        <Users className="h-3.5 w-3.5 text-[var(--muted-fg)]" aria-hidden />
                        Участники
                      </ButtonLink>
                      <ButtonLink
                        href={`/organizer/events/${event.id}/waitlist`}
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-medium"
                        title="Лист ожидания"
                      >
                        <Clock className="h-3.5 w-3.5 text-[var(--muted-fg)]" aria-hidden />
                        Очередь
                      </ButtonLink>
                      <ButtonLink
                        href={`/organizer/events/${event.id}/edit`}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--muted-fg)] hover:text-[var(--foreground)]"
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
