/**
 * Format Indonesian Rupiah. No decimal places.
 * 15000 -> "Rp 15.000"
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Apply a percentage discount. e.g. (20000, 50) -> 10000.
 */
export function applyDiscount(price: number, percent: number): number {
  return Math.round(price * (1 - percent / 100));
}

/**
 * Format ISO 8601 / Date -> "21:00" (24h, Asia/Jakarta).
 * Server: pass `timeZone: "Asia/Jakarta"` to toLocaleString.
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

/**
 * "in 2h 15m" / "in 45m" / "expired". For pickup countdown.
 */
export function formatCountdown(target: string | Date, now: Date = new Date()): string {
  const ms = new Date(target).getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}
