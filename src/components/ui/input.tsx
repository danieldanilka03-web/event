import * as React from 'react';
import { cn } from '@/shared/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-[var(--border-ui)] bg-white px-3 text-[15px] text-[var(--foreground)]',
        'placeholder:text-[var(--muted-fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-indigo-200',
        'disabled:cursor-not-allowed disabled:bg-slate-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-xl border border-[var(--border-ui)] bg-white px-3 py-2 text-[15px]',
      'placeholder:text-[var(--muted-fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-indigo-200',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-10 w-full rounded-xl border border-[var(--border-ui)] bg-white px-3 text-[15px]',
      'focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-indigo-200',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-[var(--muted-fg)]">{hint}</p>}
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
