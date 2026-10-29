'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { loginAction } from '@/server/actions/auth';
import { safeRedirectPath } from '@/shared/utils';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

function Submit({ pending }: { pending: boolean }) {
  const { pending: formPending } = useFormStatus();
  const isPending = pending || formPending;
  return (
    <Button type="submit" className="w-full" size="lg" disabled={isPending}>
      {isPending ? 'Входим…' : 'Войти'}
    </Button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const next = safeRedirectPath(rawNext, '/my-tickets');
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const toast = useToast();

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        setError(null);
        setFieldErrors({});
        const result = await loginAction(null, formData);
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        toast('Вы вошли в систему');
        router.push(next);
        router.refresh();
      }}
    >
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Пароль" htmlFor="password" error={fieldErrors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Submit pending={pending} />

      <p className="text-center text-sm text-[var(--muted-fg)]">
        Нет аккаунта?{' '}
        <Link
          href={rawNext ? `/register?next=${encodeURIComponent(rawNext)}` : '/register'}
          className="text-[var(--primary)] hover:underline"
        >
          Зарегистрируйтесь
        </Link>
      </p>
    </form>
  );
}
