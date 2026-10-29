'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-50 text-[var(--danger)]">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
      <p className="text-[var(--muted-fg)]">
        Не удалось загрузить страницу. Попробуйте повторить попытку — если ошибка сохранится,
        проверьте подключение к базе данных.
      </p>
      <Button onClick={reset}>Попробовать снова</Button>
    </div>
  );
}
