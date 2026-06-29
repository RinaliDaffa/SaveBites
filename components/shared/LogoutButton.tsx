'use client';

import { useState } from 'react';

interface LogoutButtonProps {
  onLogout: () => Promise<void> | void;
  compact?: boolean;
  label?: string;
}

export default function LogoutButton({ onLogout, compact, label = 'Sign out' }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      await onLogout();
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={loading}
        title={label}
        className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
      >
        {loading ? '…' : '⏻'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
    >
      {loading ? 'Signing out…' : label}
    </button>
  );
}