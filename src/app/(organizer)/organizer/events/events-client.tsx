'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
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
        disabled={isPending}
        onClick={() => submit('draft')}
        aria-label="Снять с публикации"
      >
        <EyeOff className="h-4 w-4" aria-hidden /> {isPending ? '…' : 'Снять с публикации'}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={() => submit('published')}>
      <Eye className="h-4 w-4" aria-hidden /> {isPending ? '…' : 'Опубликовать'}
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
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Отменить мероприятие">
        <XCircle className="h-4 w-4" aria-hidden /> Отменить
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
        size="sm"
        className="text-[var(--danger)]"
        onClick={() => setOpen(true)}
        aria-label="Удалить мероприятие"
      >
        <Trash2 className="h-4 w-4" aria-hidden /> Удалить
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
      <div className="rounded-xl border border-[var(--border-ui)] bg-white">
        <Table>
          <THead>
            <TH>Название</TH>
            <TH>Дата</TH>
            <TH>Статус</TH>
            <TH>Заполняемость</TH>
            <TH aria-label="Действия" />
          </THead>
          <tbody>
            {events.map((event) => {
              const percent = fillPercent(event.maxSeats, event.occupiedSeats);
              const activeParticipants = event.activeParticipants;
              return (
                <TR key={event.id}>
                  <TD className="max-w-[240px]">
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
                  <TD>
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
                  <TD className="min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <Progress value={percent} />
                      </div>
                      <span className="whitespace-nowrap text-sm text-[var(--muted-fg)]">
                        {event.occupiedSeats}/{event.maxSeats}
                      </span>
                    </div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link
                        href={`/organizer/events/${event.id}/participants`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-slate-100"
                      >
                        <Users className="h-4 w-4" aria-hidden /> Участники
                      </Link>
                      <Link
                        href={`/organizer/events/${event.id}/waitlist`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-slate-100"
                        title="Лист ожидания"
                      >
                        <Clock className="h-4 w-4" aria-hidden /> Очередь
                      </Link>
                      <Link
                        href={`/organizer/events/${event.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-slate-100"
                        aria-label="Редактировать мероприятие"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
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
