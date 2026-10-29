export const CATEGORIES = [
  'Конференции',
  'Концерты',
  'Мастер-классы',
  'Спорт',
  'Выставки',
  'Образование',
  'Другое',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Градиенты плашек категорий вместо изображений (в ТЗ у событий нет картинок). */
export const CATEGORY_GRADIENTS: Record<Category, string> = {
  'Конференции': 'from-indigo-500 to-violet-500',
  'Концерты': 'from-rose-500 to-orange-500',
  'Мастер-классы': 'from-emerald-500 to-teal-500',
  'Спорт': 'from-amber-500 to-lime-500',
  'Выставки': 'from-sky-500 to-cyan-500',
  'Образование': 'from-fuchsia-500 to-pink-500',
  'Другое': 'from-slate-500 to-slate-600',
};

export const EVENT_STATUS_LABEL: Record<'draft' | 'published' | 'cancelled', string> = {
  draft: 'Черновик',
  published: 'Опубликовано',
  cancelled: 'Отменено',
};

export const ROLE_LABEL: Record<'participant' | 'organizer' | 'admin', string> = {
  participant: 'Участник',
  organizer: 'Организатор',
  admin: 'Администратор',
};

export const PAGE_SIZE = 9;
export const ADMIN_PAGE_SIZE = 10;
export const TIMEZONE = 'Europe/Moscow';
