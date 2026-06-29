// SaveBites V3 — Pricing logic
// No delivery. No delivery fee. No markup.
// R4: Flat IDR 3,000 platform service fee.

import { SERVICE_FEE_FLAT_IDR } from '@/lib/constants';

export type PriceBreakdown = {
  subtotal: number;
  discountTotal: number;
  serviceFee: number;
  total: number;
  savings: number;
  savingsPct: number;
};

/** Calculate the flat service fee. */
export function calcServiceFee(): number {
  return SERVICE_FEE_FLAT_IDR;
}

export function computePricing(
  originalPrice: number,
  surplusPrice: number,
  quantity: number
): PriceBreakdown {
  const subtotal = surplusPrice * quantity;
  const fullPrice = originalPrice * quantity;
  const discountTotal = fullPrice - subtotal;
  const serviceFee = calcServiceFee();
  const total = subtotal + serviceFee;
  const savings = fullPrice - total;
  const savingsPct = fullPrice > 0 ? Math.round((savings / fullPrice) * 100) : 0;
  return { subtotal, discountTotal, serviceFee, total, savings, savingsPct };
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function discountPercent({ originalPrice, surplusPrice }: { originalPrice: number; surplusPrice: number }): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - surplusPrice) / originalPrice) * 100);
}
