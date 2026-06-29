/**
 * SaveBites V3 — Button Component
 * Reusable button with variant, size, and loading states.
 */

'use client';

import React from 'react';
import { cn } from '@/components/shared/cn';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-sm',
  secondary: 'bg-stone-100 text-stone-700 hover:bg-stone-200',
  outline: 'bg-transparent border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50',
  ghost: 'bg-transparent text-stone-600 hover:bg-stone-100',
  danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className, disabled, iconLeft, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && iconLeft}
      {children}
    </button>
  );
});
