'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { setUserRoleAction, toggleBlockAction } from '@/server/actions/admin';

type Row = {
  id: string;
  email: string;
  fullName: string;
  role: 'participant' | 'organizer' | 'admin';
  isBlocked: boolean;
};

function RoleSelect({ user, isSelf }: { user: Row; isSelf: boolean }) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const toast = useToast();
  const [roleValue, setRoleValue] = React.useState(user.role);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await setUserRoleAction(null, { userId: user.id, role: roleValue });
      if (result.ok) {
        toast('Роль обновлена');
        router.refresh();
      } else toast(result.error, 'danger');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Select
        name="role"
        value={roleValue}
        onChange={(e) => setRoleValue(e.target.value as Row['role'])}
        disabled={isPending || isSelf}
        aria-label={`Роль пользователя ${user.fullName}`}
        className="h-9 w-36"
      >
        <option value="participant">Участник</option>
        <option value="organizer">Организатор</option>
        <option value="admin">Админ</option>
      </Select>
      <Button type="submit" size="sm" disabled={isPending || isSelf}>
        {isPending ? '…' : 'Сменить'}
      </Button>
    </form>
  );
}

function BlockButton({ user, isSelf }: { user: Row; isSelf: boolean }) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleBlockAction(null, { userId: user.id, block: !user.isBlocked });
      if (result.ok) {
        toast(user.isBlocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
        router.refresh();
      } else toast(result.error, 'danger');
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={user.isBlocked ? 'outline' : 'danger'}
      disabled={isPending || isSelf}
      onClick={handleClick}
      aria-label={user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
    >
      {user.isBlocked ? (
        <>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {isPending ? '…' : 'Разблокировать'}
        </>
      ) : (
        <>
          <Ban className="h-4 w-4" aria-hidden /> {isPending ? '…' : 'Заблокировать'}
        </>
      )}
    </Button>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function AdminUsersClient({
  users,
  currentUserId,
}: {
  users: Row[];
  currentUserId: string;
}) {
  return (
    <>
      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        return (
          <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-xs font-bold text-white shadow-2xs">
                  {initials(user.fullName)}
                </span>
                <div>
                  <p className="font-bold text-slate-900">
                    {user.fullName}
                    {isSelf && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                        Вы
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3.5 whitespace-nowrap">
              <RoleSelect user={user} isSelf={isSelf} />
            </td>
            <td className="px-4 py-3.5 whitespace-nowrap">
              {isSelf ? (
                <span className="text-xs font-medium text-slate-400">—</span>
              ) : (
                <BlockButton user={user} isSelf={isSelf} />
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
