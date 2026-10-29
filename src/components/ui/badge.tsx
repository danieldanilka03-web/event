import * as React from 'react';
import { cn } from '@/shared/utils';

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 border border-slate-200/80',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200/80',
  primary: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200/80',
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 100
      ? 'bg-rose-500'
      : v >= 90
        ? 'bg-amber-500'
        : 'bg-gradient-to-r from-indigo-500 to-indigo-600';

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60"
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300 ease-out', tone)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
