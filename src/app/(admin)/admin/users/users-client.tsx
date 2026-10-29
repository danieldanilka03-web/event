'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
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
          <tr key={user.id} className="border-t border-[var(--border-ui)]">
            <td className="px-4 py-3">
              <p className="font-medium">
                {user.fullName}
                {isSelf && <span className="ml-2 text-sm text-[var(--muted-fg)]">(это вы)</span>}
              </p>
              <p className="text-sm text-[var(--muted-fg)]">{user.email}</p>
            </td>
            <td className="px-4 py-3">
              <RoleSelect user={user} isSelf={isSelf} />
            </td>
            <td className="px-4 py-3">
              {isSelf ? (
                <span className="text-sm text-[var(--muted-fg)]">Нельзя</span>
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
