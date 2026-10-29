'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  CalendarDays,
  UserCheck,
  MoreVertical,
  ExternalLink,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { adminDeleteEventAction, moderateEventAction } from '@/server/actions/admin';
import type { EventStatusInput } from '@/shared/validators';

type Row = {
  id: string;
  title: string;
  category: string;
  startDate: Date;
  status: EventStatusInput;
  maxSeats: number;
  occupiedSeats: number;
  organizerName: string | null;
};

function StatusSelect({ event }: { event: Row }) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleChange(next: EventStatusInput) {
    startTransition(async () => {
      const result = await moderateEventAction(null, { eventId: event.id, status: next });
      if (result.ok) {
        toast(`Статус обновлен: ${next === 'published' ? 'Опубликовано' : next === 'draft' ? 'Черновик' : 'Отменено'}`);
        router.refresh();
      } else {
        toast(result.error, 'danger');
      }
    });
  }

  const toneClass =
    event.status === 'published'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : event.status === 'cancelled'
        ? 'text-rose-700 bg-rose-50 border-rose-200'
        : 'text-slate-700 bg-slate-50 border-slate-200';

  return (
    <select
      value={event.status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value as EventStatusInput)}
      aria-label={`Статус события ${event.title}`}
      className={`h-8 rounded-xl border px-2.5 text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100 ${toneClass}`}
    >
      <option value="published">Опубликовано</option>
      <option value="draft">Черновик</option>
      <option value="cancelled">Отменено</option>
    </select>
  );
}

function AdminRowActions({ event }: { event: Row }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <StatusSelect event={event} />

        <DropdownMenu>
          <DropdownTrigger className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs">
            <MoreVertical className="h-4 w-4" />
          </DropdownTrigger>
          <DropdownContent align="right">
            <DropdownItem href={`/events/${event.id}`}>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              Открыть в каталоге
            </DropdownItem>
            <DropdownItem href={`/organizer/events/${event.id}/participants`}>
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              Список участников
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onClick={() => setOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              Удалить мероприятие
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        pending={pending}
        destructive
        title="Удалить мероприятие?"
        description={`«${event.title}» будет удалено вместе со всеми записями участников (${event.occupiedSeats}). Действие необратимо.`}
        confirmLabel="Удалить навсегда"
        onConfirm={async () => {
          setPending(true);
          const result = await adminDeleteEventAction(null, { eventId: event.id });
          setPending(false);
          setOpen(false);
          if (result.ok) {
            toast('Мероприятие удалено');
            router.refresh();
          } else toast(result.error, 'danger');
        }}
      />
    </>
  );
}

export function AdminEventsClient({ events }: { events: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-2xs">
      <Table className="w-full">
        <THead>
          <TH>Мероприятие</TH>
          <TH>Организатор</TH>
          <TH>Дата</TH>
          <TH>Места</TH>
          <TH className="text-right">Статус и действия</TH>
        </THead>
        <tbody className="divide-y divide-slate-100">
          {events.map((event) => (
            <TR key={event.id} className="hover:bg-slate-50/60 transition-colors">
              <TD className="max-w-[260px] py-3.5">
                <p className="truncate font-bold text-slate-900">{event.title}</p>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">{event.category}</p>
              </TD>
              <TD className="whitespace-nowrap py-3.5 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                  {event.organizerName ?? 'Не указан'}
                </span>
              </TD>
              <TD className="whitespace-nowrap py-3.5 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                  {event.startDate.toLocaleDateString('ru-RU')}
                </span>
              </TD>
              <TD className="whitespace-nowrap py-3.5 text-xs font-bold text-slate-800">
                {event.occupiedSeats} / {event.maxSeats}
              </TD>
              <TD className="whitespace-nowrap text-right py-3.5">
                <AdminRowActions event={event} />
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
