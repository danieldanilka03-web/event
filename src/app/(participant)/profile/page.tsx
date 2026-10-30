import type { Metadata } from 'next';
import { Info, User as UserIcon, Shield, Mail, Calendar } from 'lucide-react';
import { requireUser } from '@/server/auth/guards';
import { formatEventDate } from '@/shared/format';
import { ROLE_LABEL } from '@/shared/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Профиль' };
export const dynamic = 'force-dynamic';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Профиль: карточка пользователя */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 text-white font-black text-xl shadow-md shadow-indigo-500/20">
            {initials(user.fullName) || 'У'}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                {user.fullName}
              </h1>
              <Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>
              {user.isBlocked && <Badge tone="danger">Заблокирован</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                На платформе с {formatEventDate(user.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Данные аккаунта</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm fullName={user.fullName} email={user.email} phone={user.phone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Роль и доступ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Роль в системе</span>
              <Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Статус аккаунта</span>
              <Badge tone={user.isBlocked ? 'danger' : 'success'}>
                {user.isBlocked ? 'Заблокирован' : 'Активен'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Дата регистрации</span>
              <span className="font-semibold text-slate-800">{formatEventDate(user.createdAt)}</span>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-xs text-indigo-900 leading-relaxed">
              <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Роль организатора назначается администратором платформы. Самостоятельно изменить свою роль нельзя.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
