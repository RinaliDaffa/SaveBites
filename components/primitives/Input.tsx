/**
 * SaveBites V3 — Input Component
 * Standard text input with label, error display, and optional icon.
 */

'use client';

import React from 'react';
import { cn } from '@/components/shared/cn';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
            {icon}
          </div>
        )}
        <input
          className={cn(
            'w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900',
            'placeholder:text-stone-400',
            'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            icon && 'pl-10',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
