import { Shield, Users, FolderKanban } from 'lucide-react';
import type { SidebarItem } from '@/components/layout/dashboard-shell';

export const adminNav: SidebarItem[] = [
  { href: '/admin', label: 'Статистика', icon: <Shield className="h-4 w-4" aria-hidden /> },
  { href: '/admin/users', label: 'Пользователи', icon: <Users className="h-4 w-4" aria-hidden /> },
  { href: '/admin/events', label: 'Мероприятия', icon: <FolderKanban className="h-4 w-4" aria-hidden /> },
];
