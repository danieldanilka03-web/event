import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { getCurrentUser } from '@/server/auth/session';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/dialog';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Вход' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === 'admin') redirect('/admin');
    if (user.role === 'organizer') redirect('/organizer');
    redirect('/my-tickets');
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25 mb-3">
          <Ticket className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Добро пожаловать</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">Войдите в свой личный кабинет для доступа к билетам</p>
      </div>

      <Card className="rounded-3xl border border-slate-200/80 bg-white/95 shadow-xl shadow-indigo-950/5">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold">Вход в систему</CardTitle>
          <CardDescription>Используйте учетную запись или быстрый демо-вход</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
