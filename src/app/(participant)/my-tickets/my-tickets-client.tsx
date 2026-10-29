'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Ticket, Ban, Armchair } from 'lucide-react';
import type { TicketRow } from '@/server/db/queries';
import { formatEventDate, formatEventTime, isPast } from '@/shared/format';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog, EmptyState, Tabs } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cancelRegistrationAction } from '@/server/actions/registrations';

type TabKey = 'active' | 'past' | 'cancelled';

function bucketOf(t: TicketRow): TabKey {
  if (t.status === 'cancelled' || t.eventStatus === 'cancelled') return 'cancelled';
  return isPast(t.startDate) ? 'past' : 'active';
}

function CancelButton({ registrationId, title }: { registrationId: string; title: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  async function confirm() {
    setPending(true);
    const result = await cancelRegistrationAction(null, { registrationId });
    setPending(false);
    setOpen(false);
    if (result.ok) {
      toast('Запись отменена');
      router.refresh();
    } else {
      toast(result.error, 'danger');
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`Отменить запись на ${title}`}>
        <Ban className="h-4 w-4" aria-hidden /> Отменить
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        pending={pending}
        destructive
        title="Отменить запись?"
        description={`Вы перестанете числиться участником мероприятия «${title}». Место будет передано следующему участнику из листа ожидания или вернётся в общий список.`}
        confirmLabel="Отменить запись"
      />
    </>
  );
}

export function MyTicketsClient({ tickets }: { tickets: TicketRow[] }) {
  const [tab, setTab] = React.useState<TabKey>('active');

  const groups: Record<TabKey, TicketRow[]> = { active: [], past: [], cancelled: [] };
  for (const t of tickets) groups[bucketOf(t)].push(t);

  return (
    <div className="space-y-5">
      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'active', label: 'Активные', count: groups.active.length },
          { value: 'past', label: 'Прошедшие', count: groups.past.length },
          { value: 'cancelled', label: 'Отменённые', count: groups.cancelled.length },
        ]}
      />

      {groups[tab].length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-10 w-10" aria-hidden />}
          title="Ничего не найдено"
          description={
            tab === 'active'
              ? 'У вас пока нет активных билетов. Выберите мероприятие в каталоге.'
              : tab === 'past'
                ? 'Прошедших мероприятий пока нет.'
                : 'Отменённых записей нет.'
          }
          action={
            <Link
              href="/"
              className="rounded-xl border border-[var(--border-ui)] px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Перейти в каталог
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {groups[tab].map((t) => (
            <li key={t.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--accent)]">{t.category}</p>
                      {t.eventStatus === 'cancelled' && <Badge tone="danger">Мероприятие отменено</Badge>}
                      {t.status === 'cancelled' && t.eventStatus !== 'cancelled' && (
                        <Badge tone="neutral">Запись отменена</Badge>
                      )}
                    </div>
                    <p className="truncate text-lg font-semibold">{t.title}</p>
                    {t.rowLabel && t.seatNumber !== null && (
                      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)]">
                        <Armchair className="h-4 w-4" aria-hidden />
                        Ряд {t.rowLabel}, место {t.seatNumber}
                      </p>
                    )}
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-fg)]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {formatEventDate(t.startDate)}, {formatEventTime(t.startDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" aria-hidden />
                        {t.location}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {t.status === 'active' && (
                      <ButtonLink href={`/tickets/${t.id}`} size="sm">
                        Билет
                      </ButtonLink>
                    )}
                    {t.status === 'active' && !isPast(t.startDate) && t.eventStatus !== 'cancelled' && (
                      <CancelButton registrationId={t.id} title={t.title} />
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
