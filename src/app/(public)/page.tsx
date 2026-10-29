import Link from 'next/link';
import { CalendarDays, MapPin, Ticket, ArrowRight } from 'lucide-react';
import { getCatalog } from '@/server/db/queries';
import { catalogQuerySchema } from '@/shared/validators';
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
  // Каталог — динамическая страница, поэтому loading.tsx на уровне группы
  // отключён (он отдавал бы «оболочку» раньше 404). Скелетоны рисуем вручную.
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
      <section className="border-b border-[var(--border-ui)] bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
          <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
            Мероприятия, на которые хочется попасть
          </h1>
          <p className="mt-3 max-w-xl text-base text-indigo-100 sm:text-lg">
            Конференции, концерты, мастер-классы и выставки. Выбирайте событие и бронируйте билет
            в пару кликов.
          </p>
          <form action="/" className="mt-6 flex max-w-xl gap-2" role="search">
            <input
              type="search"
              name="q"
              defaultValue={query.q ?? ''}
              placeholder="Поиск по названию, например «конференция»"
              aria-label="Поиск мероприятий"
              className="h-12 w-full rounded-xl border border-transparent px-4 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-xl bg-white px-5 font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Найти
            </button>
          </form>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-indigo-100">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden /> {catalog.total} мероприятий
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Ticket className="h-4 w-4" aria-hidden /> Бесплатная запись
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden /> Москва и другие города
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <EventFilters query={query} />

          <section aria-label="Каталог мероприятий">
            <CatalogLoadingShell>
            {dbError ? (
              <EmptyState
                title="Каталог временно недоступен"
                description="Не удалось подключиться к базе данных. Проверьте переменные окружения DATABASE_URL."
              />
            ) : catalog.items.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-10 w-10" aria-hidden />}
                title="Ничего не найдено"
                description="Попробуйте изменить параметры поиска или сбросить фильтры."
                action={
                  <Link
                    href="/"
                    className="rounded-xl border border-[var(--border-ui)] px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    Сбросить фильтры
                  </Link>
                }
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {catalog.items.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <p className="text-sm text-[var(--muted-fg)]">
                    Стр. {query.page} из {catalog.totalPages}
                  </p>
                  <Pagination page={query.page} totalPages={catalog.totalPages} params={query} />
                </div>
              </>
            )}

            <div className="mt-10 rounded-xl border border-[var(--border-ui)] bg-white p-5">
              <h2 className="text-lg font-semibold">Хотите организовать своё событие?</h2>
              <p className="mt-1 text-sm text-[var(--muted-fg)]">
                Создайте мероприятие, настройте лимит мест и следите за регистрациями в панели
                организатора.
              </p>
              <div className="mt-4">
                <ButtonLink href="/organizer/events/new" size="sm">
                  Перейти к созданию <ArrowRight className="h-4 w-4" aria-hidden />
                </ButtonLink>
              </div>
            </div>
            </CatalogLoadingShell>
          </section>
        </div>
      </div>
    </>
  );
}
