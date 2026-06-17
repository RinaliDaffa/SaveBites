import Link from "next/link";
import {
  getConsumerProfile,
  getNearbyListings,
  type NearbyListing,
} from "@/lib/supabase-services";
import {
  finalPrice,
  formatCountdown,
  formatDistance,
  formatIDR,
  greetingForHour,
} from "@/lib/format";

function emojiFallback(title: string): string {
  const cleaned = title.trim();
  if (cleaned.length === 0) return "🍱";
  const first = cleaned[0]!.toUpperCase();
  if (cleaned.length >= 3) {
    return cleaned.slice(0, 3).toUpperCase();
  }
  return first;
}

function ListingCard({ listing }: { listing: NearbyListing }) {
  const price = finalPrice(listing.original_price, listing.discount_pct);
  const distance = formatDistance(listing.distance_m ?? 0);
  const countdown = formatCountdown(listing.pickup_deadline);
  const soldOut = listing.portions_left <= 0;

  return (
    <Link
      href={`/app/listings/${listing.id}`}
      className={`block bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow ${
        soldOut ? "opacity-60" : ""
      }`}
    >
      <div className="h-32 bg-stone-200 relative flex items-center justify-center">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-stone-500">
            <span className="text-3xl">🍱</span>
            <span className="mt-1 text-xs font-semibold tracking-widest">
              {emojiFallback(listing.title)}
            </span>
          </div>
        )}
        {listing.discount_pct > 0 ? (
          <div className="absolute top-2 right-2 bg-emerald-600 text-white font-bold text-xs px-2 py-1 rounded-full">
            -{listing.discount_pct}%
          </div>
        ) : null}
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <h3 className="font-semibold text-sm leading-snug text-ink line-clamp-2">
          {listing.title}
        </h3>
        <p className="text-xs text-stone-500 truncate">
          📍 {listing.business_name ?? "Restaurant"} · {distance}
        </p>
        <div className="flex items-center justify-between mt-1">
          <div className="flex flex-col">
            <span className="text-emerald-600 font-bold text-sm">
              {formatIDR(price)}
            </span>
            <span className="text-stone-400 text-xs line-through">
              {formatIDR(listing.original_price)}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-orange-600 font-medium">
              ⏰ {countdown}
            </div>
            <div className="text-[11px] text-stone-500">
              {listing.portions_left} portions left
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function ConsumerListingsPage() {
  const { data: profile } = await getConsumerProfile();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const greeting = greetingForHour(new Date().getHours());

  const lat = profile?.last_lat ?? null;
  const lng = profile?.last_lng ?? null;

  let listings: NearbyListing[] = [];
  let queryError: string | null = null;

  if (lat !== null && lng !== null) {
    const { data, error } = await getNearbyListings(lat, lng, 2000);
    if (error) {
      queryError = error.message;
    } else {
      listings = data;
    }
  }

  return (
    <div className="max-w-screen-md mx-auto w-full px-4 py-5">
      <div className="mb-5">
        <h1 className="text-2xl font-serif font-bold text-ink">
          Good {greeting}, {firstName}! Hungry? 🍱
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Surplus meals from restaurants near you.
        </p>
      </div>

      {queryError ? (
        <div className="bg-red-50 border border-red-200 text-tomato rounded-2xl p-4 text-sm">
          Couldn't load listings: {queryError}
        </div>
      ) : lat === null || lng === null ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">📍</div>
          <p className="text-stone-700 font-medium">
            Enable location to see nearby food
          </p>
          <p className="text-sm text-stone-500 mt-1">
            We use your location to find surplus meals within 2 km.
          </p>
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">🌱</div>
          <p className="text-stone-700 font-medium">
            No surplus food nearby right now. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
