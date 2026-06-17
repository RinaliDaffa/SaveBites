'use client';

import React from 'react';

interface Props {
  // Server actions invoked via <form action={…}> must return void; the result
  // is read by callers via the return-value channel separately if needed.
  action: (formData: FormData) => Promise<void> | void;
  listingId: string;
}

export function CancelListingButton({ action, listingId }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="listingId" value={listingId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm('Cancel this listing?')) e.preventDefault();
        }}
        className="text-xs font-medium text-stone-500 hover:text-red-600 underline underline-offset-4"
      >
        Cancel
      </button>
    </form>
  );
}
