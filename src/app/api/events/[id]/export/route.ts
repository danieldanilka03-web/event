import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { getEventById, getEventParticipants } from '@/server/db/queries';
import { formatEventDate, formatEventTime } from '@/shared/format';

export const dynamic = 'force-dynamic';

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
    return new NextResponse('Доступ запрещён', { status: 403 });
  }

  const { id } = await params;
  const event = await getEventById(id);
  if (!event || (user.role !== 'admin' && event.organizerId !== user.id)) {
    return new NextResponse('Мероприятие не найдено или нет прав организатора', { status: 404 });
  }

  const participants = await getEventParticipants(id);

  // Формируем CSV с заголовками
  const headers = [
    '№',
    'ФИО участника',
    'Email',
    'Телефон',
    'Ряд',
    'Место',
    'Категория места',
    'Статус записи',
    'Контроль входа',
    'Время входа',
    'Дата регистрации',
    'Номер билета (ID)',
  ];

  const lines = [headers.map(escapeCsv).join(';')];

  participants.forEach((p, index) => {
    const isCheckedIn = Boolean(p.checkedInAt);
    const row = [
      index + 1,
      p.fullName,
      p.email,
      p.phone ?? '',
      p.rowLabel ?? '',
      p.seatNumber ?? '',
      p.seatCategory === 'vip' ? 'VIP' : p.seatCategory ? 'Стандарт' : '',
      p.status === 'active' ? 'Активна' : 'Отменена',
      isCheckedIn ? 'Прошёл контроль' : 'Ожидается',
      p.checkedInAt ? `${formatEventDate(p.checkedInAt)} ${formatEventTime(p.checkedInAt)}` : '',
      `${formatEventDate(p.createdAt)} ${formatEventTime(p.createdAt)}`,
      p.id,
    ];
    lines.push(row.map(escapeCsv).join(';'));
  });

  // \uFEFF — UTF-8 BOM для автоматического открытия кириллицы в Excel
  const csvContent = '\uFEFF' + lines.join('\r\n');

  const sanitizedTitle = event.title
    .replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_')
    .slice(0, 30);
  const filename = `participants_${sanitizedTitle}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
