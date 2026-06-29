/**
 * SaveBites V3 — Badge Component
 * Small colored pill for status/category indicators.
 */

'use client';

import React from 'react';
import { cn } from '@/components/shared/cn';

type Variant = 'success' | 'warning' | 'error' | 'neutral' | 'emerald';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<Variant, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  neutral: 'bg-stone-100 text-stone-600',
  emerald: 'bg-emerald-100 text-emerald-700',
};

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide',
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
