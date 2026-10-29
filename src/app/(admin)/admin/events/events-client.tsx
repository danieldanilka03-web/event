'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, CalendarDays, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
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

function StatusForm({ event }: { event: Row }) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const toast = useToast();
  const [statusValue, setStatusValue] = React.useState<EventStatusInput>(event.status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await moderateEventAction(null, { eventId: event.id, status: statusValue });
      if (result.ok) {
        toast('Статус мероприятия обновлён');
        router.refresh();
      } else toast(result.error, 'danger');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Select
        name="status"
        value={statusValue}
        onChange={(e) => setStatusValue(e.target.value as EventStatusInput)}
        disabled={isPending}
        aria-label={`Статус мероприятия ${event.title}`}
        className="h-9 w-40"
      >
        <option value="draft">Черновик</option>
        <option value="published">Опубликовано</option>
        <option value="cancelled">Отменено</option>
      </Select>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? '…' : 'Применить'}
      </Button>
    </form>
  );
}

function DeleteButton({ event }: { event: Row }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <Button variant="ghost" size="sm" className="text-[var(--danger)]" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden /> Удалить
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        pending={pending}
        destructive
        title="Удалить мероприятие?"
        description={`«${event.title}» будет удалено вместе с регистрациями участников (${event.occupiedSeats}). Действие необратимо.`}
        confirmLabel="Удалить"
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
    <>
      {events.map((event) => (
        <tr key={event.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
          <td className="px-4 py-3.5">
            <p className="max-w-[280px] truncate font-bold text-slate-900">{event.title}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{event.category}</p>
          </td>
          <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
            <span className="inline-flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-slate-400" />
              {event.organizerName ?? 'Не указан'}
            </span>
          </td>
          <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
              {event.startDate.toLocaleDateString('ru-RU')}
            </span>
          </td>
          <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-800">
            {event.occupiedSeats} / {event.maxSeats}
          </td>
          <td className="px-4 py-3.5 whitespace-nowrap">
            <Badge
              tone={
                event.status === 'published' ? 'success' : event.status === 'cancelled' ? 'danger' : 'neutral'
              }
            >
              {event.status === 'published'
                ? 'Опубликовано'
                : event.status === 'cancelled'
                  ? 'Отменено'
                  : 'Черновик'}
            </Badge>
          </td>
          <td className="whitespace-nowrap px-4 py-3.5 text-right">
            <div className="inline-flex items-center justify-end gap-2">
              <StatusForm event={event} />
              <DeleteButton event={event} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
