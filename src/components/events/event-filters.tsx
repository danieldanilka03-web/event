'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Filter, RotateCcw } from 'lucide-react';
import { CATEGORIES, PAGE_SIZE } from '@/shared/constants';
import type { CatalogQuery } from '@/shared/validators';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/dialog';

export function EventFilters({ query }: { query: CatalogQuery }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  function buildHref(values: { q?: string; category?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    const q = values.q ?? '';
    const category = values.category ?? '';
    const from = values.from ?? '';
    const to = values.to ?? '';
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }

  function apply(values: { q: string; category: string; from: string; to: string }) {
    setOpen(false);
    router.push(buildHref(values));
  }

  const form = (
    <FilterForm
      key={`${query.q ?? ''}|${query.category ?? ''}|${query.from ?? ''}|${query.to ?? ''}`}
      query={query}
      onApply={apply}
    />
  );

  return (
    <aside aria-label="Фильтры каталога" className="lg:sticky lg:top-20 lg:self-start">
      <div className="hidden lg:block">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
            <Filter className="h-4 w-4 text-indigo-600" aria-hidden /> Фильтры
          </h2>
          {form}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full lg:hidden rounded-xl font-semibold shadow-2xs"
        onClick={() => setOpen(true)}
        aria-label="Открыть фильтры"
      >
        <Filter className="h-4 w-4 mr-1 text-indigo-600" aria-hidden /> Фильтры
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Фильтры мероприятий">
        {form}
      </Sheet>
    </aside>
  );
}

function FilterForm({
  query,
  onApply,
}: {
  query: CatalogQuery;
  onApply: (v: { q: string; category: string; from: string; to: string }) => void;
}) {
  const [q, setQ] = React.useState(query.q ?? '');
  const [category, setCategory] = React.useState(query.category ?? '');
  const [from, setFrom] = React.useState(query.from ?? '');
  const [to, setTo] = React.useState(query.to ?? '');

  const hasFilters = Boolean(q || category || from || to);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ q, category, from, to });
      }}
    >
      <Field label="Поиск" htmlFor="filter-q">
        <Input
          id="filter-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Название события"
        />
      </Field>

      <Field label="Категория" htmlFor="filter-category">
        <Select
          id="filter-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Дата от" htmlFor="filter-from">
        <Input id="filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>

      <Field label="Дата до" htmlFor="filter-to">
        <Input id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1 font-semibold">
          Применить
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQ('');
              setCategory('');
              setFrom('');
              setTo('');
              onApply({ q: '', category: '', from: '', to: '' });
            }}
            title="Сбросить все фильтры"
            aria-label="Сбросить все фильтры"
          >
            <RotateCcw className="h-4 w-4 text-slate-500" aria-hidden />
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-400 text-center">Отображается по {PAGE_SIZE} событий</p>
    </form>
  );
}
