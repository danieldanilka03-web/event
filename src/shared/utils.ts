import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function absoluteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (base) return new URL(path, base).toString();
  if (typeof window !== 'undefined') return new URL(path, window.location.origin).toString();
  return `https://example.com${path}`;
}

export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function safeRedirectPath(target: string | null | undefined, fallback: string = '/'): string {
  if (!target || typeof target !== 'string') return fallback;
  if (target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) {
    return target;
  }
  return fallback;
}
