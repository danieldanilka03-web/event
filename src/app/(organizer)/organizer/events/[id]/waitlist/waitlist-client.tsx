'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  ArrowUpDown,
  Trash2,
  TrendingUp,
  Mail,
  Phone,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, THead, TH, TR, TD } from '@/components/ui/table';
import { ConfirmDialog, EmptyState, Tabs } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatEventDateTime } from '@/shared/format';
import {
  manualDispatchWaitlistAction,
  updateWaitlistPriorityAction,
  removeWaitlistEntryAction,
} from '@/server/actions/waitlist';
import type { WaitlistStatus } from '@/shared/waitlist';

export type WaitlistClientEntry = {
  id: string;
  status: WaitlistStatus;
  priority: number;
  createdAt: string;
  offeredAt: string | null;
  expiresAt: string | null;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  rowLabel: string | null;
  seatNumber: number | null;
};

export type WaitlistStats = {
  waiting: number;
  offered: number;
  claimed: number;
  expired: number;
  conversionPercent: number;
};

type TabFilter = 'all' | 'waiting' | 'offered' | 'history';

function ExpiryCountdown({ expiresAt }: { expiresAt: string | null }) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!expiresAt) return;
    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Истекло');
        router.refresh();
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}м ${s < 10 ? '0' : ''}${s}с`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, router]);

  if (!expiresAt) return <span>—</span>;

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
      <Timer className="h-3 w-3" />
      {timeLeft ?? '…'}
    </span>
  );
}

function StatusBadge({ status }: { status: WaitlistStatus }) {
  switch (status) {
    case 'offered':
      return <Badge tone="warning">Предложено</Badge>;
    case 'waiting':
      return <Badge tone="primary">В очереди</Badge>;
    case 'claimed':
      return <Badge tone="success">Выкуплен</Badge>;
    case 'expired':
      return <Badge tone="neutral">Истёк</Badge>;
    case 'cancelled':
      return <Badge tone="danger">Отменён</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export function WaitlistClient({
  eventId,
  stats,
  entries,
  hasLayout,
}: {
  eventId: string;
  stats: WaitlistStats;
  entries: WaitlistClientEntry[];
  hasLayout: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = React.useState<TabFilter>('all');
  const [isPending, startTransition] = React.useTransition();

  // Состояния для диалогов
  const [priorityModalEntry, setPriorityModalEntry] = React.useState<WaitlistClientEntry | null>(null);
  const [newPriority, setNewPriority] = React.useState<number>(0);
  const [deleteModalEntry, setDeleteModalEntry] = React.useState<WaitlistClientEntry | null>(null);
  const [dispatchConfirmOpen, setDispatchConfirmOpen] = React.useState(false);

  // Фильтрация
  const filteredEntries = React.useMemo(() => {
    switch (tab) {
      case 'waiting':
        return entries.filter((e) => e.status === 'waiting');
      case 'offered':
        return entries.filter((e) => e.status === 'offered');
      case 'history':
        return entries.filter((e) => e.status === 'claimed' || e.status === 'expired' || e.status === 'cancelled');
      default:
        return entries;
    }
  }, [entries, tab]);

  return (
    <div className="space-y-6">
      {/* Метрики */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-fg)]">В очереди</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{stats.waiting}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-fg)]">Предложено (оффер)</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{stats.offered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-fg)]">Выкуплено</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.claimed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-fg)]">Истекло</p>
            <p className="mt-1 text-2xl font-bold text-slate-500">{stats.expired}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-fg)] flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Конверсия
            </p>
            <p className="mt-1 text-2xl font-bold text-violet-600">{stats.conversionPercent}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Панель алгоритмических действий организатора */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-[var(--border-ui)] bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Управление очередью листа ожидания</h3>
          <p className="text-xs text-[var(--muted-fg)] mt-0.5">
            Система автоматически перераспределяет места при отмене билетов. Вы также можете продвинуть очередь вручную.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
            disabled={isPending || stats.waiting === 0}
            onClick={() => setDispatchConfirmOpen(true)}
          >
            <Play className="h-4 w-4 mr-1.5" />
            {isPending ? 'Распределение…' : 'Продвинуть очередь'}
          </Button>
        </div>
      </div>

      {/* Табы */}
      <Tabs<TabFilter>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: 'Все записи', count: entries.length },
          { value: 'waiting', label: 'Ожидают', count: stats.waiting },
          { value: 'offered', label: 'Предложено', count: stats.offered },
          { value: 'history', label: 'История', count: entries.length - stats.waiting - stats.offered },
        ]}
      />

      {/* Таблица */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          title="В этой категории записей нет"
          description={
            tab === 'waiting'
              ? 'В очереди ожидания сейчас никого нет.'
              : tab === 'offered'
                ? 'Нет активных предложений с зарезервированными местами.'
                : 'Лист ожидания пуст.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border-ui)] bg-white shadow-2xs">
          <Table className="min-w-[880px]">
            <THead>
              <TH>#</TH>
              <TH>Участник</TH>
              <TH>Контакты</TH>
              <TH>Приоритет</TH>
              <TH>Статус</TH>
              {hasLayout && <TH>Место</TH>}
              <TH>Таймер / Срок</TH>
              <TH>Дата заявки</TH>
              <TH aria-label="Действия" />
            </THead>
            <tbody>
              {filteredEntries.map((entry, idx) => {
                const seatStr =
                  entry.rowLabel && entry.seatNumber !== null
                    ? `Ряд ${entry.rowLabel}, место ${entry.seatNumber}`
                    : '—';

                return (
                  <TR key={entry.id}>
                    <TD className="font-mono text-xs text-[var(--muted-fg)]">
                      {entry.status === 'waiting' ? (
                        <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          №{idx + 1}
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </TD>
                    <TD className="font-medium text-slate-900">{entry.fullName}</TD>
                    <TD className="text-xs text-[var(--muted-fg)]">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" /> {entry.email}
                      </div>
                      {entry.phone && (
                        <div className="mt-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" /> {entry.phone}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          entry.priority < 0
                            ? 'bg-purple-100 text-purple-800'
                            : entry.priority === 0
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {entry.priority < 0
                          ? `VIP (${entry.priority})`
                          : entry.priority === 0
                            ? 'Обычный (0)'
                            : `Низкий (+${entry.priority})`}
                      </span>
                    </TD>
                    <TD>
                      <StatusBadge status={entry.status} />
                    </TD>
                    {hasLayout && <TD className="text-xs font-medium">{seatStr}</TD>}
                    <TD className="whitespace-nowrap">
                      {entry.status === 'offered' ? (
                        <ExpiryCountdown expiresAt={entry.expiresAt} />
                      ) : (
                        <span className="text-xs text-[var(--muted-fg)]">—</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-[var(--muted-fg)]">
                      {formatEventDateTime(entry.createdAt)}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        {entry.status === 'waiting' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Изменить приоритет"
                            onClick={() => {
                              setPriorityModalEntry(entry);
                              setNewPriority(entry.priority);
                            }}
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(entry.status === 'waiting' || entry.status === 'offered') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Удалить из очереди"
                            onClick={() => setDeleteModalEntry(entry)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* Диалог ручного продвижения очереди */}
      <ConfirmDialog
        open={dispatchConfirmOpen}
        onClose={() => setDispatchConfirmOpen(false)}
        title="Продвинуть очередь листа ожидания?"
        description="Алгоритм выберет следующего кандидата с наивысшим приоритетом и выделит ему место на 30 минут."
        confirmLabel="Продвинуть"
        pending={isPending}
        onConfirm={async () => {
          startTransition(async () => {
            const res = await manualDispatchWaitlistAction(null, { eventId });
            setDispatchConfirmOpen(false);
            if (res.ok) {
              if (res.data.dispatched) {
                toast('Кандидат выбран, место предложено на 30 минут', 'success');
              } else {
                toast('В очереди нет ожидающих участников', 'danger');
              }
              router.refresh();
            } else {
              toast(res.error, 'danger');
            }
          });
        }}
      />

      {/* Модалка изменения приоритета */}
      <ConfirmDialog
        open={Boolean(priorityModalEntry)}
        onClose={() => setPriorityModalEntry(null)}
        title="Изменить приоритет в очереди"
        description={`Участник: ${priorityModalEntry?.fullName}. Чем меньше число, тем выше позиция кандидата в очереди (FIFO-алгоритм учитывает приоритет перед временем создания).`}
        confirmLabel="Сохранить"
        pending={isPending}
        onConfirm={async () => {
          if (!priorityModalEntry) return;
          startTransition(async () => {
            const res = await updateWaitlistPriorityAction(null, {
              eventId,
              waitlistId: priorityModalEntry.id,
              priority: newPriority,
            });
            setPriorityModalEntry(null);
            if (res.ok) {
              toast('Приоритет обновлён', 'success');
              router.refresh();
            } else {
              toast(res.error, 'danger');
            }
          });
        }}
      >
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold text-slate-700">Уровень приоритета:</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={`rounded-lg border p-2 text-xs font-medium transition ${
                newPriority === -1 ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-slate-200'
              }`}
              onClick={() => setNewPriority(-1)}
            >
              ⭐ VIP (-1)
            </button>
            <button
              type="button"
              className={`rounded-lg border p-2 text-xs font-medium transition ${
                newPriority === 0 ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200'
              }`}
              onClick={() => setNewPriority(0)}
            >
              Обычный (0)
            </button>
            <button
              type="button"
              className={`rounded-lg border p-2 text-xs font-medium transition ${
                newPriority === 1 ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-slate-200'
              }`}
              onClick={() => setNewPriority(1)}
            >
              Сниженный (+1)
            </button>
          </div>
        </div>
      </ConfirmDialog>

      {/* Диалог удаления */}
      <ConfirmDialog
        open={Boolean(deleteModalEntry)}
        onClose={() => setDeleteModalEntry(null)}
        destructive
        title="Исключить из листа ожидания?"
        description={`Участник ${deleteModalEntry?.fullName} будет удалён из очереди.`}
        confirmLabel="Исключить"
        pending={isPending}
        onConfirm={async () => {
          if (!deleteModalEntry) return;
          startTransition(async () => {
            const res = await removeWaitlistEntryAction(null, {
              eventId,
              waitlistId: deleteModalEntry.id,
            });
            setDeleteModalEntry(null);
            if (res.ok) {
              toast('Участник исключён из очереди');
              router.refresh();
            } else {
              toast(res.error, 'danger');
            }
          });
        }}
      />
    </div>
  );
}
