'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Ticket, Ban, Armchair, ArrowRight, Sparkles } from 'lucide-react';
import type { TicketRow } from '@/server/db/queries';
import { formatEventDate, formatEventTime, isPast } from '@/shared/format';
import { CATEGORY_GRADIENTS, CATEGORY_STYLES, type Category } from '@/shared/constants';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
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
      toast('Запись на мероприятие отменена');
      router.refresh();
    } else {
      toast(result.error, 'danger');
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
        onClick={() => setOpen(true)}
        aria-label={`Отменить запись на ${title}`}
      >
        <Ban className="h-4 w-4 mr-1 text-slate-400" aria-hidden /> Отменить запись
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        pending={pending}
        destructive
        title="Отменить регистрацию?"
        description={`Вы перестанете числиться участником события «${title}». Освободившееся место перейдёт участнику из листа ожидания.`}
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
    <div className="space-y-6">
      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'active', label: 'Активные билеты', count: groups.active.length },
          { value: 'past', label: 'Прошедшие', count: groups.past.length },
          { value: 'cancelled', label: 'Отменённые', count: groups.cancelled.length },
        ]}
      />

      {groups[tab].length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-10 w-10 text-indigo-500" aria-hidden />}
          title="Билетов пока нет"
          description={
            tab === 'active'
              ? 'У вас нет активных записей. Выберите интересное мероприятие в каталоге.'
              : tab === 'past'
                ? 'История посещённых мероприятий пуста.'
                : 'Отменённых записей нет.'
          }
          action={
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Перейти в каталог событий
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {groups[tab].map((t) => {
            const gradient = CATEGORY_GRADIENTS[t.category as Category] ?? CATEGORY_GRADIENTS['Другое'];
            const catStyle = CATEGORY_STYLES[t.category as Category] ?? CATEGORY_STYLES['Другое'];

            return (
              <li
                key={t.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-indigo-200"
              >
                {/* Цветная полоска категории слева */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${gradient}`} />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pl-1">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}>
                        <Sparkles className="h-3 w-3" />
                        {t.category}
                      </span>

                      {t.eventStatus === 'cancelled' && <Badge tone="danger">Мероприятие отменено</Badge>}
                      {t.status === 'cancelled' && t.eventStatus !== 'cancelled' && (
                        <Badge tone="neutral">Запись отменена</Badge>
                      )}
                    </div>

                    <h3 className="truncate text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {t.title}
                    </h3>

                    {t.rowLabel && t.seatNumber !== null && (
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
                        <Armchair className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
                        Ряд {t.rowLabel}, место {t.seatNumber}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        <CalendarDays className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
                        {formatEventDate(t.startDate)}, {formatEventTime(t.startDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                        {t.location}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                    {t.status === 'active' && (
                      <ButtonLink
                        href={`/tickets/${t.id}`}
                        size="sm"
                        className="font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                      >
                        <Ticket className="h-4 w-4 mr-1.5" />
                        Билет
                      </ButtonLink>
                    )}
                    {t.status === 'active' && !isPast(t.startDate) && t.eventStatus !== 'cancelled' && (
                      <CancelButton registrationId={t.id} title={t.title} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
