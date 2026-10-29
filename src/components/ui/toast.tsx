'use client';

import * as React from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/shared/utils';

export type ToastTone = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

type Toast = { id: number; message: string; tone: ToastTone };
type ToastFn = (message: string, tone?: ToastTone) => void;

const ToastContext = React.createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback<ToastFn>((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const toneStyles = {
            success: 'border-emerald-200 bg-white text-emerald-900 shadow-md',
            danger: 'border-rose-200 bg-white text-rose-900 shadow-md',
            warning: 'border-amber-200 bg-white text-amber-900 shadow-md',
            neutral: 'border-slate-200 bg-white text-slate-800 shadow-md',
            info: 'border-indigo-200 bg-white text-indigo-900 shadow-md',
          }[t.tone];

          const Icon = {
            success: CheckCircle2,
            danger: AlertCircle,
            warning: AlertTriangle,
            neutral: Info,
            info: Info,
          }[t.tone];

          const iconColor = {
            success: 'text-emerald-600',
            danger: 'text-rose-600',
            warning: 'text-amber-600',
            neutral: 'text-slate-500',
            info: 'text-indigo-600',
          }[t.tone];

          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-3.5 text-sm transition-all',
                toneStyles,
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconColor)} aria-hidden />
              <span className="flex-1 font-medium leading-snug">{t.message}</span>
              <button
                type="button"
                aria-label="Закрыть уведомление"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
