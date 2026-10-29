'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Trash2 } from 'lucide-react';
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
        <tr key={event.id} className="border-t border-[var(--border-ui)]">
          <td className="px-4 py-3">
            <p className="max-w-[260px] truncate font-medium">{event.title}</p>
            <p className="text-sm text-[var(--muted-fg)]">{event.category}</p>
          </td>
          <td className="text-[var(--muted-fg)]">{event.organizerName}</td>
          <td className="whitespace-nowrap text-[var(--muted-fg)]">
            {event.startDate.toLocaleDateString('ru-RU')}
          </td>
          <td className="whitespace-nowrap text-[var(--muted-fg)]">
            {event.occupiedSeats}/{event.maxSeats}
          </td>
          <td>
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
          <td>
            <div className="flex flex-wrap items-center gap-2">
              <StatusForm event={event} />
              <DeleteButton event={event} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
