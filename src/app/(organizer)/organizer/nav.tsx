import { LayoutDashboard, CalendarPlus, FolderKanban } from 'lucide-react';
import type { SidebarItem } from '@/components/layout/dashboard-shell';

export const organizerNav: SidebarItem[] = [
  {
    href: '/organizer',
    label: 'Дашборд',
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden />,
  },
  {
    href: '/organizer/events',
    label: 'Мои мероприятия',
    icon: <FolderKanban className="h-4 w-4" aria-hidden />,
  },
  {
    href: '/organizer/events/new',
    label: 'Создать событие',
    icon: <CalendarPlus className="h-4 w-4" aria-hidden />,
  },
];
