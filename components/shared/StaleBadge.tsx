import React from "react";
import { formatCountdown } from "@/lib/utils/format";
import { Clock } from "lucide-react";

export function StaleBadge({ targetDate }: { targetDate: string }) {
  const countdown = formatCountdown(targetDate);
  const isExpired = countdown === "expired";

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      isExpired ? "bg-stone-100 text-stone-500" : "bg-orange-100 text-orange-800"
    }`}>
      <Clock className="w-3.5 h-3.5" />
      {isExpired ? "Expired" : `Pickup closes in ${countdown}`}
    </div>
  );
}
