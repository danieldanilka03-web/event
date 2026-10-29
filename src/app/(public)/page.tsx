import Link from 'next/link';
import { CalendarDays, MapPin, Ticket, ArrowRight, Sparkles, Search, PlusCircle, CheckCircle2 } from 'lucide-react';
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
      {/* Главный Hero-блок (Luma & Apple Event Aesthetic) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 py-16 sm:py-24 text-white">
        {/* Фоновые градиентные сферы */}
        <div className="absolute -top-40 -left-40 h-[450px] w-[450px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -right-40 h-[450px] w-[450px] rounded-full bg-violet-600/20 blur-[100px] pointer-events-none" />

        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3.5 py-1 text-xs font-bold text-indigo-200 backdrop-blur-md shadow-xs mb-6">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Новое поколение бронирования билетов & мероприятий
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
              События, которые <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-200 via-white to-indigo-300 bg-clip-text text-transparent">
                вдохновляют и объединяют
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              Конференции, концерты, выставки и воркшопы. Выбирайте места на интерактивной схеме зала и получайте защищённый электронный билет с QR-кодом за секунды.
            </p>

            {/* Поисковая форма */}
            <form action="/" className="mt-8 flex flex-col sm:flex-row max-w-2xl gap-2.5" role="search">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" aria-hidden />
                <input
                  type="search"
                  name="q"
                  defaultValue={query.q ?? ''}
                  placeholder="Поиск событий по названию, теме или городу…"
                  aria-label="Поиск мероприятий"
                  className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 transition-all"
                />
              </div>
              <button
                type="submit"
                className="h-12 shrink-0 rounded-2xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer"
              >
                Найти события
              </button>
            </form>

            {/* Быстрые категории */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 mr-1">Категории:</span>
              {CATEGORIES.slice(0, 5).map((cat) => (
                <Link
                  key={cat}
                  href={`/?category=${encodeURIComponent(cat)}`}
                  className={`rounded-full px-3 py-1 text-xs font-bold backdrop-blur-md border transition-all ${
                    query.category === cat
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {cat}
                </Link>
              ))}
            </div>

            {/* Метрики платформы */}
            <div className="mt-10 flex flex-wrap gap-6 text-xs sm:text-sm text-slate-400 pt-6 border-t border-white/10">
              <span className="inline-flex items-center gap-2 font-medium text-slate-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                </span>
                <strong className="text-white font-bold">{catalog.total}</strong> активных событий
              </span>
              <span className="inline-flex items-center gap-2 font-medium text-slate-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Ticket className="h-3.5 w-3.5" aria-hidden />
                </span>
                Электронные билеты с QR
              </span>
              <span className="inline-flex items-center gap-2 font-medium text-slate-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                </span>
                Схема зала и лист ожидания
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Основной контент каталога */}
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
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
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {catalog.items.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>

                  {catalog.totalPages > 1 && (
                    <div className="mt-12 flex items-center justify-between border-t border-slate-200/80 pt-6">
                      <p className="text-xs font-semibold text-slate-500">
                        Страница {query.page} из {catalog.totalPages}
                      </p>
                      <Pagination page={query.page} totalPages={catalog.totalPages} params={query} />
                    </div>
                  )}
                </>
              )}

              {/* Блок для организаторов */}
              <div className="mt-14 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 p-6 sm:p-8 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1.5">
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
