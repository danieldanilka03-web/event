import * as React from 'react';
import { cn } from '@/shared/utils';

const TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  primary: 'bg-indigo-100 text-indigo-700',
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 100 ? 'bg-[var(--danger)]' : v >= 90 ? 'bg-[var(--warning)]' : 'bg-[var(--primary)]';
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${v}%` }} />
    </div>
  );
}
