/**
 * SaveBites V3 — Consumer Listing Detail Page (Server Component)
 *
 * Fetches listing + merchant data server-side, renders all static
 * content inline, and delegates quantity-selector / booking to a tiny
 * client island. Zero client-side fetching (no useEffect/useSWR).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Star, MapPin, Clock, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getListingById } from '@/lib/queries/listings';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import BookingIsland from './booking-island';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/c/listing/${id}`);
  }

  // Server-side data fetch (uses Supabase directly)
  const listing = await getListingById(id);

  if (!listing) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🍽️</div>
        <h2 className="text-xl font-bold text-stone-900">Listing tidak ditemukan</h2>
        <p className="text-stone-500 mb-4">
          Maaf, makanan surplus yang kamu cari sudah tidak tersedia.
        </p>
        <Link
          href="/c/discover"
          className="text-emerald-600 font-medium hover:underline"
        >
          Cari Makanan Surplus
        </Link>
      </div>
    );
  }

  const dp = _discountPercent(listing.original_price, listing.surplus_price);
  const merchant = listing.merchant ?? null;
  const reviewCount = merchant?.total_reviews ?? 0;
  const ratingAvg = merchant?.rating ?? 0;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Back nav */}
      <Link
        href="/c/discover"
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Discover
      </Link>

      {/* Hero image */}
      <div className="rounded-2xl overflow-hidden bg-stone-100 aspect-square mb-4">
        <img
          src={
            listing.image_url ||
            `https://placehold.co/600x600/e7e5e4/78716c?text=${encodeURIComponent(listing.title)}`
          }
          alt={listing.title}
          className="w-full h-full object-cover"
          style={{ minWidth: 0 }}
        />
      </div>

      {/* Title + Merchant + Rating */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-stone-900">{listing.title}</h1>
        {merchant?.name && (
          <p className="text-sm text-stone-500 mt-1">oleh {merchant.name}</p>
        )}
        <div className="flex items-center gap-1 mt-2">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium">
            {ratingAvg > 0 ? ratingAvg.toFixed(1) : '—'}
          </span>
          <span className="text-sm text-stone-400">({reviewCount})</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-2 flex-wrap mb-4">
        {listing.category && <Badge variant="neutral">{listing.category}</Badge>}
        {dp > 0 && <Badge variant="emerald">{dp}% OFF</Badge>}
        {listing.dietary_tags &&
          (listing.dietary_tags as string[]).map((tag: string) => (
            <Badge key={tag} variant="success">
              {tag}
            </Badge>
          ))}
      </div>

      {/* Description */}
      {listing.description && (
        <Card className="mb-4">
          <Card.Body>
            <p className="text-sm text-stone-600 leading-relaxed">{listing.description}</p>
          </Card.Body>
        </Card>
      )}

      {/* Pricing */}
      <Card className="mb-4">
        <Card.Body>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-stone-500">Harga Asli</span>
              <span className="text-sm line-through text-stone-400">
                {_formatRupiah(listing.original_price)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-stone-100">
              <span className="text-sm font-medium text-emerald-700">Harga Hemat</span>
              <span className="text-xl font-bold text-emerald-600">
                {_formatRupiah(listing.surplus_price)}
              </span>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Meta info */}
      <div className="space-y-2 mb-4 text-sm text-stone-500">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>Dekat Anda</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Tersedia sampai {new Date(listing.available_until).toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Booking Island — interactive only */}
      <BookingIsland
        listingId={listing.id}
        quantityAvailable={listing.quantity_available}
        surplusPrice={listing.surplus_price}
      />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function _discountPercent(original: number, surplus: number): number {
  if (original <= surplus) return 0;
  return Math.round(((original - surplus) / original) * 100);
}

function _formatRupiah(value: number | string | null | undefined): string {
  if (value == null) return 'Rp 0';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}
