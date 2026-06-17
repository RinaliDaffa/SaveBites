import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getOrderById,
  type OrderWithListing,
} from "@/lib/supabase-services";
import { formatCountdown, formatIDR } from "@/lib/format";

function AwaitingPaymentView({ order }: { order: OrderWithListing }) {
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-6 text-center">
      <div className="text-3xl mb-2">⏳</div>
      <h1 className="text-xl font-serif font-bold text-ink">
        Payment pending
      </h1>
      <p className="text-stone-500 text-sm mt-1">
        Complete payment to receive your pickup ticket.
      </p>
      <button
        type="button"
        disabled
        className="mt-4 w-full bg-stone-200 text-stone-500 font-semibold py-3 rounded-xl cursor-not-allowed"
      >
        Payment integration pending
      </button>
      <button
        type="button"
        className="mt-3 w-full text-sm text-stone-500 hover:text-stone-700"
      >
        Cancel order
      </button>
    </div>
  );
}

function PaidTicketView({ order }: { order: OrderWithListing }) {
  const listing = order.listings;
  const merchant = listing?.profiles ?? order.profiles;
  return (
    <>
      <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col items-center">
        <p className="text-xs uppercase tracking-widest text-stone-500">
          Pickup ticket
        </p>
        <p className="text-sm text-stone-700 mt-1 mb-4">
          Show this to the merchant
        </p>
        <div
          className="w-64 h-64 border border-stone-300 rounded-xl flex flex-col items-center justify-center bg-white"
          aria-label="QR code placeholder"
        >
          <div className="grid grid-cols-8 grid-rows-8 gap-0.5 w-48 h-48">
            {Array.from({ length: 64 }).map((_, i) => {
              const dark = (order.qr_token.charCodeAt(i % order.qr_token.length) + i) % 3 !== 0;
              return (
                <div
                  key={i}
                  className={dark ? "bg-stone-900" : "bg-white"}
                />
              );
            })}
          </div>
        </div>
        <p className="mt-4 text-xs text-stone-400 font-mono break-all text-center max-w-xs">
          {order.qr_token}
        </p>
      </div>

      <div className="mt-4 bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="font-semibold text-ink">
          {merchant?.business_name ?? "Restaurant"}
        </h2>
        {merchant?.address ? (
          <p className="text-sm text-stone-500 mt-1 flex items-start gap-1">
            <span aria-hidden>📍</span>
            <span>{merchant.address}</span>
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-stone-500">Pickup before</p>
            <p className="font-semibold text-orange-700">
              {formatCountdown(order.pickup_deadline)}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Portions</p>
            <p className="font-semibold text-ink">{order.portions}</p>
          </div>
          <div>
            <p className="text-stone-500">Total paid</p>
            <p className="font-semibold text-emerald-600">
              {formatIDR(order.total_price)}
            </p>
          </div>
          {listing ? (
            <div>
              <p className="text-stone-500">Item</p>
              <p className="font-semibold text-ink truncate">{listing.title}</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function PickedUpView() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
      <div className="text-4xl mb-2">🎉</div>
      <h1 className="text-xl font-serif font-bold text-ink">
        Already picked up
      </h1>
      <p className="text-stone-500 text-sm mt-2">Enjoy your meal!</p>
    </div>
  );
}

function ExpiredView() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
      <div className="text-4xl mb-2">⌛</div>
      <h1 className="text-xl font-serif font-bold text-ink">Expired</h1>
      <p className="text-stone-500 text-sm mt-2">
        This ticket's pickup window has passed.
      </p>
    </div>
  );
}

function CancelledView() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
      <div className="text-4xl mb-2">❌</div>
      <h1 className="text-xl font-serif font-bold text-ink">Cancelled</h1>
      <p className="text-stone-500 text-sm mt-2">This order was cancelled.</p>
    </div>
  );
}

function NotYourOrderView() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
      <div className="text-4xl mb-2">🔒</div>
      <h1 className="text-xl font-serif font-bold text-ink">Not your order</h1>
      <p className="text-stone-500 text-sm mt-2">
        You can only view your own tickets.
      </p>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ order?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  // Allow either /app/tickets/[id] or ?order=id to resolve the order id
  const orderId = sp?.order ?? id;

  const { data: order, error } = await getOrderById(orderId);
  if (error || !order) return notFound();

  // Auth check via server client
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="max-w-md mx-auto w-full px-4 py-5">
        <NotYourOrderView />
      </div>
    );
  }
  if (order.consumer_id !== user.id) {
    return (
      <div className="max-w-md mx-auto w-full px-4 py-5">
        <NotYourOrderView />
      </div>
    );
  }

  let body: React.ReactNode;
  switch (order.status) {
    case "awaiting_payment":
      body = <AwaitingPaymentView order={order} />;
      break;
    case "paid":
      body = <PaidTicketView order={order} />;
      break;
    case "picked_up":
      body = <PickedUpView />;
      break;
    case "expired":
      body = <ExpiredView />;
      break;
    case "cancelled":
      body = <CancelledView />;
      break;
    default:
      body = null;
  }

  return (
    <div className="max-w-md mx-auto w-full px-4 py-5">
      <div className="mb-4">
        <Link
          href="/app/tickets"
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          ← Back to tickets
        </Link>
      </div>
      {body}
    </div>
  );
}
