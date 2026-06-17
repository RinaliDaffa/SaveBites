import React from "react";

export function DiscountBadge({ percent }: { percent: number }) {
  if (percent <= 0) return null;
  return (
    <div className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-xs">
      -{percent}%
    </div>
  );
}
