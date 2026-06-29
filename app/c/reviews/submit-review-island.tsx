/**
 * SaveBites V3 — Submit Review Client Island
 *
 * Form for submitting a star rating + comment for a merchant.
 * Resolves a completed order for this user/merchant to satisfy the
 * reviews schema's foreign-key + unique-constraint.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { createReviewAction } from '@/lib/actions/reviews';

export default function SubmitReviewIsland({
  merchantId,
}: {
  merchantId: string;
}) {
  const router = useRouter();

  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedRating === 0) return;
    setError(null);

    startTransition(async () => {
      try {
        // Resolve a completed order id for this user/merchant via API.
        const res = await fetch(`/api/reviews/eligible-order?merchantId=${merchantId}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? 'Tidak ada pesanan yang bisa diulas.');
        }
        const { orderId } = (await res.json()) as { orderId?: string };
        if (!orderId) {
          throw new Error('Tidak ada pesanan selesai untuk merchant ini.');
        }

        const fd = new FormData();
        fd.set('orderId', orderId);
        fd.set('rating', String(selectedRating));
        fd.set('comment', comment);

        const result = await createReviewAction(fd);
        if (!result.success) {
          throw new Error(result.error ?? 'Gagal mengirim ulasan');
        }
        setSubmitted(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      }
    });
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-3">⭐</div>
        <h2 className="text-lg font-bold text-stone-900">Terima kasih atas ulasannya!</h2>
        <p className="text-sm text-stone-500 mt-1">
          Ulasanmu membantu komunitas SaveBites.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <Card.Header>Tinggalkan Ulasan</Card.Header>
      <Card.Body>
        <div className="space-y-4">
          {/* Star rating */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              Penilaianmu
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none"
                  aria-label={`${star} stars`}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoverRating || selectedRating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-stone-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              Ulasan (opsional)
            </label>
            <textarea
              className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              rows={3}
              placeholder="Bagikan pengalamanmu..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={selectedRating === 0 || isPending}
          >
            {isPending ? 'Mengirim...' : 'Kirim Ulasan'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
