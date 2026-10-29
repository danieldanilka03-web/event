'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/shared/utils';

type DropdownContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left" ref={menuRef}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownTrigger must be used within DropdownMenu');

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        ctx.setOpen((v) => !v);
      }}
      className={cn('inline-flex cursor-pointer select-none', className)}
      role="button"
      aria-haspopup="true"
      aria-expanded={ctx.open}
    >
      {children}
    </div>
  );
}

export function DropdownContent({
  children,
  align = 'right',
  className,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownContent must be used within DropdownMenu');

  if (!ctx.open) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-1.5 min-w-[190px] rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-100',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  href,
  destructive = false,
  disabled = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const ctx = React.useContext(DropdownContext);

  const baseStyle = cn(
    'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-150 cursor-pointer select-none',
    destructive
      ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900',
    disabled && 'pointer-events-none opacity-50',
    className,
  );

  function handleClick() {
    if (disabled) return;
    if (onClick) onClick();
    ctx?.setOpen(false);
  }

  if (href) {
    return (
      <Link href={href} className={baseStyle} onClick={() => ctx?.setOpen(false)} role="menuitem">
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={baseStyle} onClick={handleClick} disabled={disabled} role="menuitem">
      {children}
    </button>
  );
}

export function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1 border-t border-slate-100', className)} role="separator" />;
}
