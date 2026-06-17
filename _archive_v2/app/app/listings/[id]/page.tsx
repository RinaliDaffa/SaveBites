import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingById } from "@/lib/supabase-services";
import {
  finalPrice,
  formatCountdown,
  formatIDR,
} from "@/lib/format";
import { BookForm } from "./book-form";

export default async function ConsumerListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: listing, error } = await getListingById(id);
  if (error || !listing) return notFound();

  const isSoldOut =
    listing.status !== "active" || listing.portions_left <= 0;
  const price = finalPrice(listing.original_price, listing.discount_pct);
  const merchant = listing.profiles;

  return (
    <div className="max-w-md mx-auto w-full px-4 py-5 pb-28">
      <div className="mb-4">
        <Link
          href="/app/listings"
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          ← Back to listings
        </Link>
      </div>

      <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white">
        <div className="h-48 bg-stone-200 relative flex items-center justify-center">
          {listing.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.image_url}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-stone-500">
              <span className="text-5xl">🍱</span>
              <span className="mt-2 text-xs font-semibold tracking-widest">
                {listing.title.slice(0, 3).toUpperCase()}
              </span>
            </div>
          )}
          {listing.discount_pct > 0 ? (
            <div className="absolute top-3 right-3 bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-full">
              -{listing.discount_pct}%
            </div>
          ) : null}
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink leading-tight">
              {listing.title}
            </h1>
            {listing.description ? (
              <p className="text-stone-500 text-sm mt-1">
                {listing.description}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-4 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="flex-1">
              <p className="text-xs text-stone-500 mb-0.5">Surplus price</p>
              <p className="text-2xl font-bold text-emerald-600 leading-none">
                {formatIDR(price)}
              </p>
            </div>
            <div className="w-px h-10 bg-stone-200" />
            <div className="flex-1 text-right">
              <p className="text-xs text-stone-500 mb-0.5">Original</p>
              <p className="text-base font-medium text-stone-400 line-through">
                {formatIDR(listing.original_price)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <span aria-hidden>🏪</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-ink truncate">
                  {merchant?.business_name ?? "Restaurant"}
                </p>
                {merchant?.address ? (
                  <p className="text-sm text-stone-500 truncate">
                    📍 {merchant.address}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                <span aria-hidden>⏰</span>
              </div>
              <div>
                <p className="font-medium text-ink">Pickup deadline</p>
                <p className="text-sm text-orange-700">
                  {formatCountdown(listing.pickup_deadline)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                <span aria-hidden>🍽️</span>
              </div>
              <div>
                <p className="font-medium text-ink">Portions left</p>
                <p className="text-sm text-stone-600">
                  {listing.portions_left} of {listing.portions_total}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-16 z-30 px-4 pb-4">
        <div className="max-w-md mx-auto">
          {isSoldOut ? (
            <div className="bg-stone-200 text-stone-700 text-center font-semibold py-3.5 rounded-2xl">
              Sold out
            </div>
          ) : (
            <BookForm
              listingId={listing.id}
              portionsLeft={listing.portions_left}
              originalPrice={listing.original_price}
              discountPct={listing.discount_pct}
            />
          )}
        </div>
      </div>
    </div>
  );
}
