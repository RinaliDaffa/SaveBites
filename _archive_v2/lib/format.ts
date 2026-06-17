/** Format whole-rupiah amounts as Indonesian Rupiah. */
export function formatIDR(amount: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(amount);
}

/** "in 1h 30m" / "in 30 min" / "expired". */
export function formatCountdown(deadline: string | Date): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (remMin === 0) return `in ${hours}h`;
  return `in ${hours}h ${remMin}m`;
}

/** "750 m" / "1.4 km" — meters in, human readable out. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** "Good morning" / "Good afternoon" / "Good evening" based on local hour. */
export function greetingForHour(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Final price after discount %, rounded to whole rupiah. */
export function finalPrice(original: number, discountPct: number): number {
  return Math.round(original * (1 - discountPct / 100));
}
