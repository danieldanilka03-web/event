'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  X,
  Sparkles,
  Check,
  RefreshCw,
} from 'lucide-react';
import { CATEGORIES, type Category } from '@/shared/constants';
import { CATEGORY_PRESET_IMAGES } from '@/shared/event-images';
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
    imageUrl?: string | null;
    hasLayout?: boolean;
  };
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [fixedSeating, setFixedSeating] = React.useState(event?.hasLayout ?? false);
  const [category, setCategory] = React.useState<Category>(
    (event?.category as Category) ?? CATEGORIES[0],
  );
  const [imageUrl, setImageUrl] = React.useState<string>(event?.imageUrl ?? '');
  const [urlInput, setUrlInput] = React.useState<string>(event?.imageUrl ?? '');
  const [showUrlField, setShowUrlField] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const toast = useToast();
  const router = useRouter();

  const action = mode === 'create' ? createEventAction : updateEventAction;
  const presets = CATEGORY_PRESET_IMAGES[category] ?? CATEGORY_PRESET_IMAGES['Другое'];

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Выберите файл изображения (JPEG, PNG, WebP)', 'danger');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Размер изображения не должен превышать 5 МБ', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setUrlInput('');
        toast('Фотография успешно выбрана');
      }
    };
    reader.readAsDataURL(file);
  }

  function handleApplyUrl() {
    if (!urlInput.trim()) {
      setImageUrl('');
      return;
    }
    setImageUrl(urlInput.trim());
    toast('Ссылка на фото применена');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Параметры и детали события' : 'Редактирование параметров события'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
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
          <input type="hidden" name="imageUrl" value={imageUrl} />

          {/* Название */}
          <Field label="Название" htmlFor="title" error={fieldErrors.title}>
            <Input id="title" name="title" defaultValue={event?.title} required />
          </Field>

          {/* Описание */}
          <Field label="Описание" htmlFor="description" error={fieldErrors.description}>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={event?.description}
              required
            />
          </Field>

          {/* Категория и параметры проведения */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Категория" htmlFor="category" error={fieldErrors.category}>
              <Select
                id="category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                required
              >
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

          {/* Блок добавления обложки / тематической фотографии */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide uppercase">
                  Обложка мероприятия (фотография)
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Отображается в каталоге событий и в шапке страницы билета. Выберите из каталога или загрузите своё.
                </p>
              </div>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('');
                    setUrlInput('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  <X className="h-3.5 w-3.5" /> Сбросить обложку
                </button>
              )}
            </div>

            {/* Живой предпросмотр выбранной обложки */}
            <div className="relative h-44 sm:h-52 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-inner">
              {imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Предпросмотр обложки"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-xs font-bold border border-white/20">
                      <Sparkles className="h-3 w-3 text-amber-300" />
                      {category}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-200 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                      Предпросмотр баннера
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-300 mb-2">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Обложка не выбрана
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Если оставить поле пустым, для мероприятия будет автоматически подобрана тематическая фотография категории «{category}».
                  </p>
                </div>
              )}
            </div>

            {/* Готовые тематические пресеты для выбранной категории */}
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Готовые тематические фотографии для «{category}»:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {presets.map((preset, idx) => {
                  const isSelected = imageUrl === preset.url;
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setImageUrl(preset.url);
                        setUrlInput(preset.url);
                      }}
                      className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-500/50 shadow-sm'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="relative h-20 w-full bg-slate-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white">
                        <p className="text-[11px] font-bold text-slate-800 truncate">{preset.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Загрузка своего файла или ввод ссылки */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl font-semibold text-xs"
              >
                <Upload className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                Загрузить фото с устройства
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowUrlField((v) => !v)}
                className="rounded-xl font-semibold text-xs"
              >
                <LinkIcon className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                {showUrlField ? 'Скрыть URL-ввод' : 'Указать ссылку на картинку (URL)'}
              </Button>
            </div>

            {/* Поле ввода внешней ссылки */}
            {showUrlField && (
              <div className="flex gap-2 animate-in fade-in duration-150">
                <Input
                  placeholder="https://images.unsplash.com/photo-..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="text-xs"
                />
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={handleApplyUrl}
                  className="rounded-xl shrink-0 font-semibold text-xs"
                >
                  Применить URL
                </Button>
              </div>
            )}
          </div>

          {/* Фиксированная рассадка */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                checked={fixedSeating}
                disabled={mode === 'edit'}
                onChange={(e) => setFixedSeating(e.target.checked)}
              />
              <span>
                <span className="font-bold text-slate-900">Интерактивная схема зала</span>
                <span className="mt-0.5 block text-xs text-slate-500 leading-relaxed">
                  Позволяет зрителям выбирать конкретный ряд и место на визуальной схеме перед покупкой. Места временно удерживаются на 10 минут.
                  {mode === 'edit' && ' (изменить параметр после создания события нельзя).'}
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
