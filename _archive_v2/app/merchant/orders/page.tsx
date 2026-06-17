import React from "react";
import { Shell } from "@/components/shared/Shell";
import { OrderRow } from "@/components/merchant/OrderRow";
import { MOCK_ORDERS, LISTINGS } from "@/lib/constants";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function MerchantOrdersPage() {
  return (
    <Shell className="max-w-md bg-stone-50 min-h-screen pt-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Antrean</h1>
          <p className="text-stone-500 text-sm">Pesanan menunggu diambil</p>
        </div>
        <Link 
          href="/merchant/post" 
          className="flex flex-col items-center justify-center w-12 h-12 bg-emerald-600 rounded-full shadow-sm text-white hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Jual</span>
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {MOCK_ORDERS.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
            <p className="text-stone-500">Belum ada pesanan masuk</p>
          </div>
        ) : (
          MOCK_ORDERS.map(order => {
            const listing = LISTINGS.find(l => l.id === order.listing_id);
            return (
              <OrderRow 
                key={order.id} 
                order={order} 
                itemName={listing?.name || "Item Tidak Diketahui"} 
              />
            );
          })
        )}
      </div>
    </Shell>
  );
}
