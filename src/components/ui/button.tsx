import * as React from 'react';
import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200/60 hover:shadow-md hover:shadow-indigo-300/60 hover:-translate-y-0.5',
        gradient:
          'bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/35 hover:-translate-y-0.5',
        outline:
          'border border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300 shadow-2xs',
        soft:
          'bg-indigo-50/90 text-indigo-700 border border-indigo-100 hover:bg-indigo-100/90',
        ghost:
          'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900',
        danger:
          'bg-rose-600 text-white hover:bg-rose-700 shadow-xs hover:shadow-md hover:shadow-rose-500/20 hover:-translate-y-0.5',
        dangerSoft:
          'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100',
        success:
          'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs hover:shadow-md hover:shadow-emerald-500/20 hover:-translate-y-0.5',
        successSoft:
          'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100',
        link:
          'text-indigo-600 underline-offset-4 hover:underline p-0 h-auto font-medium',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-lg',
        sm: 'h-9 px-3 text-xs tracking-tight',
        md: 'h-10 px-4 text-sm tracking-tight',
        lg: 'h-12 px-6 text-[15px] rounded-2xl',
        icon: 'h-9 w-9 rounded-xl',
        'icon-sm': 'h-7 w-7 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export function ButtonLink({
  className,
  variant,
  size,
  href,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string;
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}

export { buttonVariants };
