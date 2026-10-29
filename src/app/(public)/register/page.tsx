import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { getCurrentUser } from '@/server/auth/session';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/dialog';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Регистрация' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect('/');

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25 mb-3">
          <Ticket className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Создание аккаунта</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">Зарегистрируйтесь для мгновенного бронирования билетов</p>
      </div>

      <Card className="rounded-3xl border border-slate-200/80 bg-white/95 shadow-xl shadow-indigo-950/5">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold">Регистрация участника</CardTitle>
          <CardDescription>Заполните контактные данные для получения билетов</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <RegisterForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
