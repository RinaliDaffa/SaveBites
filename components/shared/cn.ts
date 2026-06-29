/**
 * SaveBites V3 — cn() utility
 * Tailwind CSS class merging using clsx + tailwind-merge.
 */

import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes.
 * Usage: cn('text-red', 'text-{red-500:color}')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
