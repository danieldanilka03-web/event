'use client';

import * as React from 'react';
import { cn } from '@/shared/utils';
import { Button } from './button';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>}
        {children && <div className="mt-4 text-sm">{children}</div>}
        <div className="mt-6 flex justify-end gap-2.5">
          {footer ?? (
            <Button variant="outline" onClick={onClose}>
              Закрыть
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm = () => {},
  title,
  description,
  confirmLabel = 'Подтвердить',
  destructive,
  pending,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        footer ?? (
          <>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button
              variant={destructive ? 'danger' : 'default'}
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? 'Выполняется…' : confirmLabel}
            </Button>
          </>
        )
      }
    >
      <p className="leading-relaxed text-slate-600">{description}</p>
      {children}
    </Dialog>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden">
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Закрыть">
            ×
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/60" role="tablist">
      {items.map((item) => {
        const isSelected = value === item.value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-150',
              isSelected
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60',
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-bold transition-colors',
                  isSelected
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'bg-slate-200 text-slate-600',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-slate-200/80', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200/90 bg-slate-50/50 px-6 py-14 text-center">
      {icon && <div className="text-slate-400">{icon}</div>}
      <p className="text-base font-bold text-slate-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500 leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
