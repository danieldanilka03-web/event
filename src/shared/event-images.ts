import type { Category } from './constants';

export type PresetImage = {
  url: string;
  label: string;
  category: Category;
};

export const CATEGORY_PRESET_IMAGES: Record<Category, PresetImage[]> = {
  'Конференции': [
    {
      url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      label: 'IT-конференция и зал',
      category: 'Конференции',
    },
    {
      url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80',
      label: 'Спикер на главной сцене',
      category: 'Конференции',
    },
    {
      url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
      label: 'Бизнес-форум и нетворкинг',
      category: 'Конференции',
    },
  ],
  'Концерты': [
    {
      url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      label: 'Музыкальный фестиваль',
      category: 'Концерты',
    },
    {
      url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
      label: 'Живой рок-концерт',
      category: 'Концерты',
    },
    {
      url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
      label: 'Клубный концерт и софиты',
      category: 'Концерты',
    },
  ],
  'Мастер-классы': [
    {
      url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
      label: 'Живопись и творчество',
      category: 'Мастер-классы',
    },
    {
      url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80',
      label: 'Керамика и гончарное дело',
      category: 'Мастер-классы',
    },
    {
      url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
      label: 'Кулинарный воркшоп',
      category: 'Мастер-классы',
    },
  ],
  'Спорт': [
    {
      url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
      label: 'Футбольный стадион',
      category: 'Спорт',
    },
    {
      url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
      label: 'Легкоатлетический марафон',
      category: 'Спорт',
    },
    {
      url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
      label: 'Баскетбольная арена',
      category: 'Спорт',
    },
  ],
  'Выставки': [
    {
      url: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=1200&q=80',
      label: 'Современное искусство',
      category: 'Выставки',
    },
    {
      url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      label: 'Художественная галерея',
      category: 'Выставки',
    },
    {
      url: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1200&q=80',
      label: 'Музейная экспозиция',
      category: 'Выставки',
    },
  ],
  'Образование': [
    {
      url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
      label: 'Студенческий лекторий',
      category: 'Образование',
    },
    {
      url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
      label: 'Семинар и практикум',
      category: 'Образование',
    },
  ],
  'Другое': [
    {
      url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
      label: 'Городской праздник',
      category: 'Другое',
    },
    {
      url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80',
      label: 'Вечернее шоу и огни',
      category: 'Другое',
    },
  ],
};

export const ALL_PRESETS: PresetImage[] = Object.values(CATEGORY_PRESET_IMAGES).flat();

/**
 * Возвращает подходящее тематическое фото для события:
 * Если задан пользовательский imageUrl — возвращает его.
 * Иначе детерминированно выбирает качественное тематическое фото на основе категории и ID события.
 */
export function getEventImageUrl(event: { imageUrl?: string | null; category?: string; id?: string }): string {
  if (event.imageUrl && event.imageUrl.trim().length > 0) {
    return event.imageUrl.trim();
  }

  const category = (event.category ?? 'Другое') as Category;
  const presets = CATEGORY_PRESET_IMAGES[category] ?? CATEGORY_PRESET_IMAGES['Другое'];
  if (!presets || presets.length === 0) {
    return CATEGORY_PRESET_IMAGES['Другое'][0].url;
  }

  if (!event.id) {
    return presets[0].url;
  }

  // Детерминированный выбор пресета по хешу ID события, чтобы обложка была стабильной
  let hash = 0;
  for (let i = 0; i < event.id.length; i++) {
    hash = (hash << 5) - hash + event.id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % presets.length;
  return presets[index].url;
}
