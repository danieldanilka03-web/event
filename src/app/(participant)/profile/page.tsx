import type { Metadata } from 'next';
import { requireUser } from '@/server/auth/guards';
import { formatEventDate } from '@/shared/format';
import { ROLE_LABEL } from '@/shared/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Профиль' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">Профиль</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted-fg)]">Роль</span>
              <Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted-fg)]">Статус</span>
              <Badge tone={user.isBlocked ? 'danger' : 'success'}>
                {user.isBlocked ? 'Заблокирован' : 'Активен'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted-fg)]">Дата регистрации</span>
              <span className="font-medium">{formatEventDate(user.createdAt)}</span>
            </div>
            <p className="rounded-lg bg-slate-50 p-3 text-[var(--muted-fg)]">
              Роль организатора назначает администратор. Самостоятельно изменить роль нельзя.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
