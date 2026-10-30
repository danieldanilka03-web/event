'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { CATEGORIES } from '@/shared/constants';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { createEventAction, updateEventAction } from '@/server/actions/events';
import { toLocalInputValue } from '@/shared/format';

function Submit({ pending, label }: { pending: boolean; label: string }) {
  const { pending: formPending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || formPending}>
      {pending || formPending ? 'Сохраняем…' : label}
    </Button>
  );
}

export function EventForm({
  mode,
  event,
}: {
  mode: 'create' | 'edit';
  event?: {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    startDate: Date;
    maxSeats: number;
    occupiedSeats: number;
    hasLayout?: boolean;
  };
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [fixedSeating, setFixedSeating] = React.useState(event?.hasLayout ?? false);
  const toast = useToast();
  const router = useRouter();

  const action = mode === 'create' ? createEventAction : updateEventAction;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Параметры и детали события' : 'Редактирование параметров события'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          action={async (formData) => {
            setPending(true);
            setError(null);
            setFieldErrors({});
            const result = await action(null, formData);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              setFieldErrors(result.fieldErrors ?? {});
              return;
            }
            toast(mode === 'create' ? 'Мероприятие создано как черновик' : 'Изменения сохранены');
            router.push('/organizer/events');
            router.refresh();
          }}
        >
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          {event && <input type="hidden" name="id" value={event.id} />}
          <input type="hidden" name="fixedSeating" value={fixedSeating ? 'on' : 'off'} />

          <Field label="Название" htmlFor="title" error={fieldErrors.title}>
            <Input id="title" name="title" defaultValue={event?.title} required />
          </Field>

          <Field label="Описание" htmlFor="description" error={fieldErrors.description}>
            <Textarea id="description" name="description" rows={6} defaultValue={event?.description} required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Категория" htmlFor="category" error={fieldErrors.category}>
              <Select id="category" name="category" defaultValue={event?.category ?? CATEGORIES[0]} required>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Место проведения" htmlFor="location" error={fieldErrors.location}>
              <Input id="location" name="location" defaultValue={event?.location} required />
            </Field>

            <Field label="Дата и время" htmlFor="startDate" error={fieldErrors.startDate}>
              <Input
                id="startDate"
                name="startDate"
                type="datetime-local"
                defaultValue={event ? toLocalInputValue(event.startDate) : ''}
                required
              />
            </Field>

            <Field
              label="Количество мест"
              htmlFor="maxSeats"
              error={fieldErrors.maxSeats}
              hint={
                mode === 'edit' && event?.hasLayout
                  ? `Схема зала сформирована (${event.maxSeats} мест, занято: ${event.occupiedSeats}). Число мест нельзя изменить.`
                  : event
                    ? `Занято: ${event.occupiedSeats}`
                    : undefined
              }
            >
              <Input
                id="maxSeats"
                name="maxSeats"
                type="number"
                min={event ? Math.max(1, event.occupiedSeats) : 1}
                defaultValue={event?.maxSeats ?? 20}
                disabled={mode === 'edit' && Boolean(event?.hasLayout)}
                required
              />
              {mode === 'edit' && event?.hasLayout && (
                <input type="hidden" name="maxSeats" value={event.maxSeats} />
              )}
            </Field>
          </div>

          <div className="rounded-xl border border-[var(--border-ui)] bg-slate-50 p-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={fixedSeating}
                disabled={mode === 'edit'}
                onChange={(e) => setFixedSeating(e.target.checked)}
              />
              <span>
                <span className="font-medium">Фиксированная рассадка</span>
                <span className="mt-0.5 block text-[var(--muted-fg)]">
                  Появится схема зала с выбором ряда и места по клику, бронируется на 10 минут.
                  {mode === 'edit' && ' — изменить после создания нельзя.'}
                </span>
              </span>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Submit pending={pending} label={mode === 'create' ? 'Создать' : 'Сохранить'} />
            <Button type="button" variant="outline" onClick={() => router.push('/organizer/events')}>
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
