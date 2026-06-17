import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  getMerchantReviews,
  getMerchantAverageRating,
} from '@/lib/queries/reviews';

export const dynamic = 'force-dynamic';

function stars(rating: number): string {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function ReviewsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const [{ data: reviews }, avgRating] = await Promise.all([
    getMerchantReviews(user.id),
    getMerchantAverageRating(user.id),
  ]);

  return (
    <main className="min-h-screen bg-stone-50 text-ink">
      <div className="max-w-screen-md mx-auto px-4 py-6">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink">Reviews</h1>
            <p className="text-stone-500 text-sm">What consumers are saying</p>
          </div>
          <Link
            href="/merchant"
            className="text-sm font-medium text-stone-600 hover:text-emerald-700"
          >
            Back to dashboard
          </Link>
        </header>

        <section className="bg-white p-6 rounded-2xl border border-stone-200 mb-6 text-center">
          <p className="text-sm text-stone-500 uppercase tracking-wide font-medium">
            Average rating
          </p>
          <p className="text-4xl font-bold text-ink mt-1">
            {avgRating.toFixed(1)}
            <span className="text-stone-400 text-lg font-normal"> / 5</span>
          </p>
          <p className="text-amber-500 text-xl mt-1">{stars(avgRating)}</p>
          <p className="text-xs text-stone-500 mt-1">
            from {reviews.length} review{reviews.length === 1 ? '' : 's'}
          </p>
        </section>

        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
            <p className="text-stone-500 text-sm">No reviews yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => {
              const reviewer = r.profiles?.full_name ?? 'Anonymous';
              return (
                <article
                  key={r.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-semibold text-ink">{reviewer}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {formatDate(r.created_at)}
                      </p>
                    </div>
                    <p className="text-amber-500 text-lg shrink-0">
                      {stars(r.rating)}
                    </p>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-stone-700 mt-3 leading-relaxed">
                      {r.comment}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
