'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { updateProfileAction } from '@/server/actions/admin';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

function Submit({ pending }: { pending: boolean }) {
  const { pending: formPending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || formPending}>
      {pending || formPending ? 'Сохраняем…' : 'Сохранить'}
    </Button>
  );
}

export function ProfileForm({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string;
  phone: string | null;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        setError(null);
        setFieldErrors({});
        const result = await updateProfileAction(null, {
          fullName: String(formData.get('fullName') ?? ''),
          phone: String(formData.get('phone') ?? ''),
        });
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        toast('Профиль обновлён');
        router.refresh();
      }}
    >
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Field label="ФИО" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </Field>

      <Field label="Email" htmlFor="email" hint="Email нельзя изменить">
        <Input id="email" value={email} readOnly disabled />
      </Field>

      <Field label="Телефон" htmlFor="phone" error={fieldErrors.phone} hint="Необязательно">
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ''} />
      </Field>

      <Submit pending={pending} />
    </form>
  );
}
