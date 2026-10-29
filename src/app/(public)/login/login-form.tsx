'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ShieldAlert, Sparkles, UserCheck, Briefcase } from 'lucide-react';
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
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const toast = useToast();

  function selectDemoUser(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setFieldErrors({});
  }

  return (
    <form
      className="space-y-4"
      action={async () => {
        setPending(true);
        setError(null);
        setFieldErrors({});
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);
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
      {/* Кнопки быстрого выбора роли для демонстрации / защиты диплома */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Быстрый вход для демонстрации (тестовые роли):</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => selectDemoUser('admin@example.com', 'Password123!')}
            className="flex flex-col items-center justify-center rounded-lg border border-purple-200 bg-white p-2 text-xs font-medium text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition shadow-2xs active:scale-95"
            title="Администратор (доступ ко всем событиям, блокировка и роли пользователей)"
          >
            <ShieldAlert className="h-4 w-4 mb-1 text-purple-600" />
            <span>Админ</span>
          </button>

          <button
            type="button"
            onClick={() => selectDemoUser('organizer1@example.com', 'Password123!')}
            className="flex flex-col items-center justify-center rounded-lg border border-blue-200 bg-white p-2 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition shadow-2xs active:scale-95"
            title="Организатор (свои мероприятия, схема зала, лист ожидания, участники)"
          >
            <Briefcase className="h-4 w-4 mb-1 text-blue-600" />
            <span>Организатор</span>
          </button>

          <button
            type="button"
            onClick={() => selectDemoUser('participant1@example.com', 'Password123!')}
            className="flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition shadow-2xs active:scale-95"
            title="Участник (каталог, покупка билетов, выбор места, лист ожидания)"
          >
            <UserCheck className="h-4 w-4 mb-1 text-emerald-600" />
            <span>Участник</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>

      <Field label="Пароль" htmlFor="password" error={fieldErrors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
