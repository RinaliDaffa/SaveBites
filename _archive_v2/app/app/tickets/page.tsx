"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrdersStore, type OrderRow } from "@/lib/orders-store";
import { getCurrentUser } from "@/lib/supabase-browser";
import { formatCountdown, formatIDR } from "@/lib/format";

function statusBadge(status: OrderRow["status"]) {
  if (status === "paid") {
    return (
      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
        PAID · PICKUP READY
      </span>
    );
  }
  return (
    <span className="bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
      AWAITING PAYMENT
    </span>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const listing = order.listings;
  const merchant = listing?.profiles ?? null;
  const countdown = formatCountdown(order.pickup_deadline);
  return (
    <Link
      href={`/app/tickets/${order.id}`}
      className="block bg-white border border-stone-200 rounded-2xl p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink truncate">
            {listing?.title ?? "Listing"}
          </h3>
          <p className="text-xs text-stone-500 truncate">
            {merchant?.business_name ?? "Restaurant"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-emerald-600">
            {formatIDR(order.total_price)}
          </p>
          <p className="text-[11px] text-stone-500">
            {order.portions} portion{order.portions === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-orange-700 font-medium">
          ⏰ {countdown}
        </span>
        {statusBadge(order.status)}
      </div>
    </Link>
  );
}

export default function TicketsListPage() {
  const orders = useOrdersStore((s) => s.activeOrders);
  const isLoading = useOrdersStore((s) => s.isLoading);
  const error = useOrdersStore((s) => s.error);
  const loadActive = useOrdersStore((s) => s.loadActive);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser().then((user) => {
      if (cancelled) return;
      setSignedIn(Boolean(user));
      setAuthReady(true);
      if (user) {
        void loadActive(user.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadActive]);

  return (
    <div className="max-w-screen-md mx-auto w-full px-4 py-5">
      <div className="mb-5">
        <h1 className="text-2xl font-serif font-bold text-ink">My Tickets 🎟️</h1>
        <p className="text-sm text-stone-500 mt-1">
          Active reservations awaiting pickup.
        </p>
      </div>

      {!authReady ? (
        <div className="text-stone-500 text-sm">Loading…</div>
      ) : !signedIn ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">🔒</div>
          <p className="text-stone-700 font-medium">Sign in to see your tickets</p>
        </div>
      ) : isLoading ? (
        <div className="text-stone-500 text-sm">Loading tickets…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-tomato rounded-2xl p-4 text-sm">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">🎟️</div>
          <p className="text-stone-700 font-medium">No active tickets yet.</p>
          <p className="text-sm text-stone-500 mt-1">
            Browse listings to claim a surplus meal.
          </p>
          <Link
            href="/app/listings"
            className="inline-block mt-4 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700"
          >
            Find food
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
