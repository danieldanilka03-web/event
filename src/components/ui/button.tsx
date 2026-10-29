import * as React from 'react';
import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] select-none',
  {
    variants: {
      variant: {
        default: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-xs hover:shadow',
        outline: 'border border-[var(--border-ui)] bg-white text-[var(--foreground)] hover:bg-slate-50 shadow-2xs',
        soft: 'bg-indigo-50 text-[var(--primary)] hover:bg-indigo-100',
        ghost: 'text-[var(--foreground)] hover:bg-slate-100',
        danger: 'bg-[var(--danger)] text-white hover:bg-red-700 shadow-xs hover:shadow',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs hover:shadow',
        link: 'text-[var(--primary)] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2 text-xs rounded-lg',
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-[15px]',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
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
