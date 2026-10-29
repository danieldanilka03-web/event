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

/** Стильные пастельные схемы для бейджей категорий */
export const CATEGORY_STYLES: Record<Category, { bg: string; text: string; border: string; dot: string }> = {
  'Конференции': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200/80', dot: 'bg-indigo-500' },
  'Концерты': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/80', dot: 'bg-rose-500' },
  'Мастер-классы': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
  'Спорт': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200/80', dot: 'bg-amber-500' },
  'Выставки': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200/80', dot: 'bg-sky-500' },
  'Образование': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/80', dot: 'bg-purple-500' },
  'Другое': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200/80', dot: 'bg-slate-500' },
};

/** Насыщенные современные градиенты для обложек */
export const CATEGORY_GRADIENTS: Record<Category, string> = {
  'Конференции': 'from-indigo-600 via-indigo-700 to-violet-800',
  'Концерты': 'from-rose-500 via-pink-600 to-purple-700',
  'Мастер-классы': 'from-emerald-600 via-teal-600 to-cyan-700',
  'Спорт': 'from-amber-500 via-orange-600 to-rose-600',
  'Выставки': 'from-sky-600 via-blue-600 to-indigo-700',
  'Образование': 'from-fuchsia-600 via-purple-600 to-indigo-700',
  'Другое': 'from-slate-700 via-slate-800 to-zinc-900',
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
