/**
 * SaveBites V3 — Modal Component
 * Accessible overlay modal with backdrop blur.
 */

'use client';

import React from 'react';
import { cn } from '@/components/shared/cn';
import { X } from 'lucide-react';

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, size = 'md', className, children, ...props }: ModalProps) {
  if (!open) return null;

  const SIZE_MAP = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-xl p-6',
          SIZE_MAP[size],
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-bold text-stone-900">{title}</h2>}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>
      </div>
    </div>
  );
}
