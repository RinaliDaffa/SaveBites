import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getMerchantPickupQueue } from '@/lib/queries/orders';
import { formatIDR } from '@/lib/format';
import { ConfirmPickupButton } from '@/components/merchant/ConfirmPickupButton';
import { ConfirmPickupInput } from '@/components/merchant/ConfirmPickupInput';

export const dynamic = 'force-dynamic';

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs}h ago` : `${hrs}h ${rem}m ago`;
}

export default async function QueuePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: orders } = await getMerchantPickupQueue(user.id);

  return (
    <main className="min-h-screen bg-stone-50 text-ink">
      <div className="max-w-screen-md mx-auto px-4 py-6">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink">Pickup Queue</h1>
            <p className="text-stone-500 text-sm">Orders awaiting pickup</p>
          </div>
          <Link
            href="/merchant"
            className="text-sm font-medium text-stone-600 hover:text-emerald-700"
          >
            Back to dashboard
          </Link>
        </header>

        <ConfirmPickupInput />

        <div className="flex flex-col gap-3 mt-4">
          {(orders?.length ?? 0) === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
              <p className="text-stone-500 text-sm">
                No orders waiting for pickup right now. &#127793;
              </p>
            </div>
          ) : (
            orders!.map((order) => {
              const listing = order.listings as Record<string, unknown> & {
                title?: string;
              } | null;
              return (
                <article
                  key={order.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-ink truncate">
                        {listing?.title || 'Unknown item'}
                      </h4>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {order.portions} portion{order.portions > 1 ? 's' : ''} &middot;{' '}
                        {formatIDR(order.total_price)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                        <span>#{order.id.slice(0, 8)}</span>
                        <span>{timeSince(order.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <ConfirmPickupButton qrToken={order.qr_token} />
                </article>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
