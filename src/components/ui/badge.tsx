import * as React from 'react';
import { cn } from '@/shared/utils';

const TONES = {
  neutral: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200/80',
    dot: 'bg-slate-400',
  },
  success: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50 text-amber-900 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-rose-50 text-rose-800 border-rose-200/80',
    dot: 'bg-rose-500',
  },
  primary: {
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    dot: 'bg-indigo-500',
  },
  purple: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200/80',
    dot: 'bg-purple-500',
  },
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  className,
  tone = 'neutral',
  withDot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; withDot?: boolean }) {
  const current = TONES[tone] ?? TONES.neutral;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight border transition-colors',
        current.bg,
        className,
      )}
      {...props}
    >
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', current.dot)} aria-hidden />}
      {children}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 100
      ? 'bg-rose-500'
      : v >= 85
        ? 'bg-amber-500'
        : 'bg-gradient-to-r from-indigo-500 to-indigo-600';

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60 p-0.5"
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
