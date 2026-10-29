import { z } from 'zod';
import { CATEGORIES } from '@/shared/constants';

const categoryEnum = z.enum(CATEGORIES);

export const registerSchema = z.object({
  email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
  fullName: z.string().trim().min(2, 'Введите ФИО').max(120, 'Слишком длинное ФИО'),
  phone: z
    .string()
    .trim()
    .max(30, 'Слишком длинный номер')
    .optional()
    .or(z.literal('')),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов').max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Введите ФИО').max(120, 'Слишком длинное ФИО'),
  phone: z.string().trim().max(30, 'Слишком длинный номер').optional().or(z.literal('')),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const eventSchema = z
  .object({
    title: z.string().trim().min(3, 'Введите название').max(160, 'Слишком длинное название'),
    description: z.string().trim().min(10, 'Описание должно быть не короче 10 символов'),
    category: categoryEnum,
    location: z.string().trim().min(3, 'Введите место проведения').max(200),
    startDate: z.string().min(1, 'Укажите дату и время'),
    maxSeats: z.coerce
      .number({ error: 'Укажите количество мест' })
      .int('Количество мест должно быть целым числом')
      .min(1, 'Минимум 1 место')
      .max(10000, 'Слишком много мест'),
    fixedSeating: z
      .union([z.literal('on'), z.literal('off'), z.boolean()])
      .transform((v) => v === true || v === 'on')
      .catch(false),
  })
  .refine((data) => !Number.isNaN(Date.parse(data.startDate)), {
    message: 'Некорректная дата',
    path: ['startDate'],
  });
export type EventInput = z.infer<typeof eventSchema>;

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: categoryEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const eventStatusSchema = z.enum(['draft', 'published', 'cancelled']);
export type EventStatusInput = 'draft' | 'published' | 'cancelled';

export const roleSchema = z.enum(['participant', 'organizer', 'admin']);

export const idSchema = z.string().uuid('Некорректный идентификатор');
