import Link from 'next/link';
import {
  CalendarDays,
  Ticket,
  ArrowRight,
  Sparkles,
  Search,
  PlusCircle,
  CheckCircle2,
  SlidersHorizontal,
  Compass,
} from 'lucide-react';
import { getCatalog } from '@/server/db/queries';
import { catalogQuerySchema } from '@/shared/validators';
import { CATEGORIES } from '@/shared/constants';
import { EventCard } from '@/components/events/event-card';
import { EventFilters } from '@/components/events/event-filters';
import { CatalogLoadingShell } from '@/components/events/catalog-loading-shell';
import { Pagination } from '@/components/tables/pagination';
import { EmptyState } from '@/components/ui/dialog';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const CATEGORY_ICONS: Record<string, string> = {
  Конференции: '💼',
  Концерты: '🎤',
  'Мастер-классы': '🎨',
  Спорт: '⚽',
  Выставки: '🖼️',
  Другое: '✨',
};

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parsed = catalogQuerySchema.safeParse({
    q: first(sp.q),
    category: first(sp.category),
    from: first(sp.from),
    to: first(sp.to),
    page: first(sp.page) ?? 1,
  });
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});

  let catalog: Awaited<ReturnType<typeof getCatalog>> = { items: [], total: 0, totalPages: 1 };
  let dbError = false;
  try {
    catalog = await getCatalog(query);
  } catch (e) {
    console.error('Не удалось загрузить каталог', e);
    dbError = true;
  }

  return (
    <>
      {/* Компактная, светлая витрина каталога (современный стандарт SaaS / Afisha) */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-indigo-50/60 via-slate-50/40 to-white py-8 sm:py-12">
        {/* Мягкие фоновые акценты */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center text-center">
            {/* Статус-бейдж */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-white/90 px-3.5 py-1 text-xs font-bold text-indigo-700 shadow-2xs mb-4">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Афиша событий · {catalog.total} активных мероприятий</span>
            </div>

            {/* Главный заголовок */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              События, на которые хочется попасть
            </h1>

            {/* Подзаголовок */}
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
              Конференции, концерты, выставки и мастер-классы. Выбирайте места на интерактивной схеме зала и получайте защищённый электронный билет с QR-кодом.
            </p>

            {/* Единая поисковая строка */}
            <form action="/" className="mt-6 flex w-full max-w-2xl items-center gap-2" role="search">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                <input
                  type="search"
                  name="q"
                  defaultValue={query.q ?? ''}
                  placeholder="Поиск по названию или теме…"
                  aria-label="Поиск мероприятий"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <button
                type="submit"
                className="h-11 shrink-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-bold text-white shadow-sm hover:shadow-md hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                Найти
              </button>
            </form>

            {/* Быстрые категории (чипсы) */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 max-w-3xl">
              <Link
                href="/"
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  !query.category
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>Все события</span>
              </Link>
              {CATEGORIES.map((cat) => {
                const isSelected = query.category === cat;
                const icon = CATEGORY_ICONS[cat] ?? '✨';
                return (
                  <Link
                    key={cat}
                    href={`/?category=${encodeURIComponent(cat)}${query.q ? `&q=${encodeURIComponent(query.q)}` : ''}`}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{cat}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Основной каталог с карточками (виден сразу над сгибом экрана!) */}
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <EventFilters query={query} />

          <section aria-label="Каталог мероприятий">
            <CatalogLoadingShell>
              {dbError ? (
                <EmptyState
                  title="Каталог временно недоступен"
                  description="Не удалось подключиться к базе данных. Проверьте параметры подключения."
                />
              ) : catalog.items.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="h-10 w-10 text-indigo-500" aria-hidden />}
                  title="Ничего не найдено"
                  description="Попробуйте изменить параметры поиска или сбросить активные фильтры."
                  action={
                    <Link
                      href="/"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      Сбросить фильтры
                    </Link>
                  }
                />
              ) : (
                <>
                  {/* Заголовок результатов */}
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {query.category ? `Категория: ${query.category}` : 'Все актуальные события'}
                      <span className="text-slate-400 font-normal ml-1.5">({catalog.total})</span>
                    </p>
                    {query.category && (
                      <Link
                        href="/"
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Показать все →
                      </Link>
                    )}
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {catalog.items.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>

                  {catalog.totalPages > 1 && (
                    <div className="mt-10 flex items-center justify-between border-t border-slate-200/80 pt-6">
                      <p className="text-xs font-semibold text-slate-500">
                        Страница {query.page} из {catalog.totalPages}
                      </p>
                      <Pagination page={query.page} totalPages={catalog.totalPages} params={query} />
                    </div>
                  )}
                </>
              )}

              {/* Блок для организаторов */}
              <div className="mt-12 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-6 sm:p-8 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-700 uppercase tracking-wider">
                      <PlusCircle className="h-3.5 w-3.5" />
                      Для организаторов
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                      Хотите организовать своё событие?
                    </h2>
                    <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
                      Создавайте мероприятия, настраивайте интерактивную схему зала, управляйте бронями и очередью листа ожидания через личный кабинет.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <ButtonLink href="/organizer/events/new" size="md" className="font-bold shadow-sm">
                      Создать событие <ArrowRight className="h-4 w-4 ml-1" />
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </CatalogLoadingShell>
          </section>
        </div>
      </div>
    </>
  );
}
