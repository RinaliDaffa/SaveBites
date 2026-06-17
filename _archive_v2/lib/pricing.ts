export function priceFor(
  originalPrice: number,
  discountPct: number
): number {
  return Math.round(originalPrice * (100 - discountPct)) / 100;
}