'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Eye,
  EyeOff,
  XCircle,
  Pencil,
  Users,
  Trash2,
  Clock,
  MapPin,
  CalendarDays,
  MoreVertical,
  ExternalLink,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { EventWithParticipants } from '@/server/db/queries';
import { fillPercent, formatEventDateTime, isPast } from '@/shared/format';
import { Badge, Progress } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { ConfirmDialog, EmptyState } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { deleteEventAction, setEventStatusAction } from '@/server/actions/events';
import type { EventStatusInput } from '@/shared/validators';

function ActionMenu({
  event,
  activeParticipants,
}: {
  event: EventWithParticipants;
  activeParticipants: number;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();
  const toast = useToast();

  function toggleStatus() {
    const nextStatus: EventStatusInput = event.status === 'published' ? 'draft' : 'published';
    startTransition(async () => {
      const result = await setEventStatusAction(null, { eventId: event.id, status: nextStatus });
      if (result.ok) {
        toast(nextStatus === 'published' ? 'Мероприятие опубликовано' : 'Переведено в черновик');
        router.refresh();
      } else {
        toast(result.error, 'danger');
      }
    });
  }

  async function handleCancel() {
    startTransition(async () => {
      const result = await setEventStatusAction(null, { eventId: event.id, status: 'cancelled' });
      setCancelOpen(false);
      if (result.ok) {
        toast('Мероприятие отменено');
        router.refresh();
      } else {
        toast(result.error, 'danger');
      }
    });
  }

  async function handleDelete() {
    if (activeParticipants > 0 && confirmText.trim() !== String(activeParticipants)) {
      toast(`Введите число участников (${activeParticipants}) для подтверждения`, 'danger');
      return;
    }
    setIsDeleting(true);
    const result = await deleteEventAction(null, {
      eventId: event.id,
      confirmParticipants: confirmText.trim(),
    });
    setIsDeleting(false);
    setDeleteOpen(false);
    if (result.ok) {
      toast('Мероприятие удалено');
      router.refresh();
    } else {
      toast(result.error, 'danger');
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <ButtonLink
          href={`/organizer/events/${event.id}/participants`}
          size="sm"
          variant="outline"
          className="h-8.5 px-3 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-300 shadow-2xs whitespace-nowrap"
        >
          <Users className="h-3.5 w-3.5 mr-1 text-indigo-600" />
          Участники ({activeParticipants})
        </ButtonLink>

        <DropdownMenu>
          <DropdownTrigger className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs">
            <MoreVertical className="h-4 w-4" />
          </DropdownTrigger>
          <DropdownContent align="right">
            <DropdownItem href={`/organizer/events/${event.id}/edit`}>
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
              Редактировать
            </DropdownItem>
            <DropdownItem href={`/organizer/events/${event.id}/waitlist`}>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Лист ожидания
            </DropdownItem>
            <DropdownItem href={`/events/${event.id}`}>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              Открыть в каталоге
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onClick={toggleStatus} disabled={isPending}>
              {event.status === 'published' ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                  Снять с публикации
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-emerald-600" />
                  Опубликовать
                </>
              )}
            </DropdownItem>
            {event.status !== 'cancelled' && (
              <DropdownItem onClick={() => setCancelOpen(true)}>
                <XCircle className="h-3.5 w-3.5 text-amber-600" />
                Отменить событие
              </DropdownItem>
            )}
            <DropdownSeparator />
            <DropdownItem destructive onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              Удалить событие
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      {/* Диалог отмены */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        pending={isPending}
        destructive
        title="Отменить мероприятие?"
        description={`«${event.title}» будет снято с публикации. Участники увидят статус «Мероприятие отменено».`}
        confirmLabel="Отменить мероприятие"
        onConfirm={handleCancel}
      />

      {/* Диалог удаления */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        pending={isDeleting}
        destructive
        title="Удалить мероприятие безвозвратно?"
        description={
          activeParticipants > 0
            ? `У мероприятия ${activeParticipants} активных участников. Для подтверждения введите число ${activeParticipants}.`
            : `Мероприятие «${event.title}» будет удалено из базы данных навсегда.`
        }
        confirmLabel="Удалить навсегда"
        onConfirm={handleDelete}
      >
        {activeParticipants > 0 && (
          <input
            className="mt-3 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-rose-500 focus:outline-none"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Введите ${activeParticipants}`}
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
  const [viewMode, setViewMode] = React.useState<'cards' | 'table'>('cards');

  if (events.length === 0) {
    return (
      <EmptyState
        title="Мероприятий не найдено"
        description={currentSearch ? 'Попробуйте изменить поисковый запрос.' : 'Создайте своё первое мероприятие.'}
        action={<ButtonLink href="/organizer/events/new" size="sm">Создать мероприятие</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Переключатель вида */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">
          Найдено {events.length} {events.length === 1 ? 'событие' : events.length <= 4 ? 'события' : 'событий'}
        </p>

        <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              viewMode === 'cards'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Карточки
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              viewMode === 'table'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <List className="h-3.5 w-3.5" /> Таблица
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* Список карточек — никогда не обрезается, идеально читается */
        <div className="space-y-3">
          {events.map((event) => {
            const percent = fillPercent(event.maxSeats, event.occupiedSeats);
            const activeParticipants = event.activeParticipants;

            return (
              <div
                key={event.id}
                className="group rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Информация о событии */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          event.status === 'published'
                            ? 'success'
                            : event.status === 'cancelled'
                              ? 'danger'
                              : 'neutral'
                        }
                        withDot
                      >
                        {event.status === 'published'
                          ? 'Опубликовано'
                          : event.status === 'cancelled'
                            ? 'Отменено'
                            : 'Черновик'}
                      </Badge>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                        <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
                        {formatEventDateTime(event.startDate)}
                      </span>

                      {isPast(event.startDate) && (
                        <span className="text-[11px] font-semibold text-slate-400">· Прошло</span>
                      )}
                    </div>

                    <h3 className="truncate text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {event.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5 truncate max-w-xs">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Progress value={percent} />
                        </div>
                        <span className="font-bold text-slate-700 whitespace-nowrap">
                          {event.occupiedSeats} / {event.maxSeats} ({percent}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="shrink-0 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                    <ActionMenu event={event} activeParticipants={activeParticipants} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Табличный вид с компактными контролами (ничего не вылезает) */
        <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-2xs">
          <Table className="w-full">
            <THead>
              <TH>Название</TH>
              <TH>Дата</TH>
              <TH>Статус</TH>
              <TH>Заполняемость</TH>
              <TH className="text-right">Управление</TH>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => {
                const percent = fillPercent(event.maxSeats, event.occupiedSeats);
                const activeParticipants = event.activeParticipants;
                return (
                  <TR key={event.id} className="hover:bg-slate-50/60 transition-colors">
                    <TD className="max-w-[240px] py-3.5">
                      <p className="truncate font-bold text-slate-900">{event.title}</p>
                      <p className="truncate text-xs text-slate-500 mt-0.5">{event.location}</p>
                    </TD>
                    <TD className="whitespace-nowrap py-3.5 text-xs font-semibold text-slate-700">
                      {formatEventDateTime(event.startDate)}
                    </TD>
                    <TD className="whitespace-nowrap py-3.5">
                      <Badge
                        tone={
                          event.status === 'published'
                            ? 'success'
                            : event.status === 'cancelled'
                              ? 'danger'
                              : 'neutral'
                        }
                        withDot
                      >
                        {event.status === 'published'
                          ? 'Опубликовано'
                          : event.status === 'cancelled'
                            ? 'Отменено'
                            : 'Черновик'}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Progress value={percent} />
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {event.occupiedSeats}/{event.maxSeats}
                        </span>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-right py-3.5">
                      <ActionMenu event={event} activeParticipants={activeParticipants} />
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
