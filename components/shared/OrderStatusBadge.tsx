import type { OrderStatus } from '@/lib/types/database';

const COLORS: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  paid: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Paid' },
  ready: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready' },
  completed: { bg: 'bg-stone-200', text: 'text-stone-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
  expired: { bg: 'bg-stone-200', text: 'text-stone-600', label: 'Expired' },
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const c = COLORS[status] ?? { bg: 'bg-stone-100', text: 'text-stone-700', label: status };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}