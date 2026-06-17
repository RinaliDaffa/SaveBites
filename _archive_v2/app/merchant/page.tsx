import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getMerchantListings } from '@/lib/queries/listings';
import { getMerchantPickupQueue } from '@/lib/queries/orders';
import { getMerchantAverageRating } from '@/lib/queries/reviews';
import { getMerchantProfile } from '@/lib/queries/merchant';
import { formatIDR } from '@/lib/format';
import { CancelListingButton } from '@/components/merchant/CancelListingButton';
import { signOutMerchant, cancelListingById } from './actions';

export const dynamic = 'force-dynamic';

function statusBadge(status: string, deadline: string): { label: string; classes: string } {
  if (status === 'cancelled') return { label: 'Cancelled', classes: 'bg-stone-200 text-stone-600' };
  if (status === 'sold_out') return { label: 'Sold out', classes: 'bg-amber-100 text-amber-800' };
  if (status === 'expired' || new Date(deadline) < new Date())
    return { label: 'Expired', classes: 'bg-stone-200 text-stone-600' };
  return { label: 'Active', classes: 'bg-emerald-100 text-emerald-800' };
}

function formatCountdown(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hours}h left` : `${hours}h ${rem}m left`;
}

function StarRow({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span aria-label={`${rating.toFixed(1)} of 5 stars`}>
      {'★'.repeat(full)}
      {half ? '☆' : ''}
      {'·'.repeat(empty)}
    </span>
  );
}

export default async function MerchantDashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const [{ data: profile }, { data: listings }, { data: queue }, avgRating] = await Promise.all([
    getMerchantProfile(user.id),
    getMerchantListings(user.id),
    getMerchantPickupQueue(user.id),
    getMerchantAverageRating(user.id),
  ]);

  const businessName = profile?.business_name ?? profile?.full_name ?? 'Merchant';
  const activeCount = listings.filter(
    (l) => l.status === 'active' && new Date(l.pickup_deadline) > new Date()
  ).length;

  return (
    <main className="min-h-screen bg-stone-50 text-ink">
      <div className="max-w-screen-md mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink">Hi, {businessName} 👋</h1>
            <p className="text-stone-500 text-sm">Manage your surplus food today.</p>
          </div>
          <form action={signOutMerchant}>
            <button
              type="submit"
              className="text-sm font-medium text-stone-600 hover:text-emerald-700 underline underline-offset-4"
            >
              Sign out
            </button>
          </form>
        </header>

        {/* Stat cards */}
        <section className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-ink mt-1">{activeCount}</p>
            <p className="text-xs text-stone-500">listings</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Pickup</p>
            <p className="text-2xl font-bold text-ink mt-1">{queue.length}</p>
            <p className="text-xs text-stone-500">waiting</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Rating</p>
            <p className="text-2xl font-bold text-ink mt-1">{avgRating.toFixed(1)}</p>
            <p className="text-xs text-amber-500">
              <StarRow rating={avgRating} />
            </p>
          </div>
        </section>

        {/* Quick links */}
        <div className="flex gap-2 mb-6 text-sm">
          <Link
            href="/merchant/queue"
            className="flex-1 text-center py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
          >
            Pickup queue
          </Link>
          <Link
            href="/merchant/reviews"
            className="flex-1 text-center py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
          >
            Reviews
          </Link>
        </div>

        {/* Add new listing */}
        <Link
          href="/merchant/listings/new"
          className="block w-full text-center py-3 mb-8 rounded-2xl bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 transition-colors"
        >
          + Add new listing
        </Link>

        {/* Listings */}
        <section>
          <h2 className="font-serif text-lg font-bold text-ink mb-3">Your listings</h2>
          {listings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
              <p className="text-stone-500 text-sm">
                You haven&apos;t posted any surplus yet. Tap &quot;Add new listing&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {listings.map((l) => {
                const final = Math.round(l.original_price * (1 - l.discount_pct / 100));
                const badge = statusBadge(l.status, l.pickup_deadline);
                const cancellable = l.status === 'active' || l.status === 'sold_out';
                return (
                  <article
                    key={l.id}
                    className="bg-white p-4 rounded-2xl border border-stone-200"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink truncate">{l.title}</h3>
                        <p className="text-sm text-stone-500 mt-0.5">
                          {formatIDR(l.original_price)} →{' '}
                          <span className="text-emerald-700 font-semibold">
                            {formatIDR(final)}
                          </span>{' '}
                          <span className="text-stone-400">({l.discount_pct}% off)</span>
                        </p>
                        <p className="text-xs text-stone-500 mt-1">
                          {l.portions_left} portion{l.portions_left === 1 ? '' : 's'} left
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-stone-500">
                        Pickup: {formatCountdown(l.pickup_deadline)}
                      </p>
                      {cancellable && (
                        <CancelListingButton
                          action={cancelListingById}
                          listingId={l.id}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
