/**
 * SaveBites V3 — Skeleton Component
 * Loading placeholder with shimmer animation.
 */

'use client';

import React from 'react';
import { cn } from '@/components/shared/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 bg-[length:400%_100%]',
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="h-48 animate-pulse bg-stone-100" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}
