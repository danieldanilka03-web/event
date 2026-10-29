'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { setUserRoleAction, toggleBlockAction } from '@/server/actions/admin';

type Row = {
  id: string;
  email: string;
  fullName: string;
  role: 'participant' | 'organizer' | 'admin';
  isBlocked: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function RoleSelect({ user, isSelf }: { user: Row; isSelf: boolean }) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleChange(nextRole: Row['role']) {
    startTransition(async () => {
      const result = await setUserRoleAction(null, { userId: user.id, role: nextRole });
      if (result.ok) {
        toast(`Роль пользователя изменена на «${nextRole === 'admin' ? 'Админ' : nextRole === 'organizer' ? 'Организатор' : 'Участник'}»`);
        router.refresh();
      } else {
        toast(result.error, 'danger');
      }
    });
  }

  const roleStyles = {
    admin: 'text-purple-700 bg-purple-50 border-purple-200',
    organizer: 'text-blue-700 bg-blue-50 border-blue-200',
    participant: 'text-slate-700 bg-slate-50 border-slate-200',
  }[user.role];

  return (
    <select
      value={user.role}
      disabled={isPending || isSelf}
      onChange={(e) => handleChange(e.target.value as Row['role'])}
      className={`h-8 rounded-xl border px-2.5 text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100 ${roleStyles}`}
      aria-label={`Роль пользователя ${user.fullName}`}
    >
      <option value="participant">Участник</option>
      <option value="organizer">Организатор</option>
      <option value="admin">Админ</option>
    </select>
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

  if (isSelf) {
    return <span className="text-xs font-medium text-slate-400">—</span>;
  }

  return (
    <Button
      type="button"
      size="xs"
      variant={user.isBlocked ? 'outline' : 'dangerSoft'}
      disabled={isPending}
      onClick={handleClick}
      className="h-8 px-2.5 font-bold"
    >
      {user.isBlocked ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" /> Разблокировать
        </>
      ) : (
        <>
          <Ban className="h-3.5 w-3.5 mr-1" /> Заблокировать
        </>
      )}
    </Button>
  );
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
              <BlockButton user={user} isSelf={isSelf} />
            </td>
          </tr>
        );
      })}
    </>
  );
}
