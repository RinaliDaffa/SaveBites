/**
 * SaveBites V3 — Select Component
 * Accessible dropdown with keyboard navigation and click-outside dismissal.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/components/shared/cn';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function Select({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (opt: Option) => {
    onChange?.(opt.value);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (!disabled) setOpen(o => !o);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-stone-700 mb-1.5">{label}</label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border bg-white px-4 py-2.5 text-sm',
          'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none',
          'cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-red-500',
          !error && 'border-stone-300',
        )}
      >
        <span className={cn(!selected && 'text-stone-400')}>
          {selected?.label || placeholder}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-stone-400" />
          : <ChevronDown className="w-4 h-4 text-stone-400" />
        }
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label ?? undefined}
          className="absolute z-50 mt-1 w-full rounded-xl border border-stone-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {options.length === 0 && (
            <div className="px-4 py-2.5 text-sm text-stone-400">No options</div>
          )}
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-stone-50',
                  isSelected && 'bg-emerald-50 text-emerald-700 font-medium',
                )}
              >
                {isSelected && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                {!isSelected && <span className="w-4 flex-shrink-0" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
