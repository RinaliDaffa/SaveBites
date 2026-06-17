"use client";

import React, { useState } from "react";
import { formatRupiah } from "@/lib/utils/format";
import { Check, User, Hash } from "lucide-react";

export function OrderRow({ order, itemName }: { order: { id: string; quantity: number; consumer_name: string; pickup_code: string; total_price: number; status: string; }; itemName: string }) {
  const [pickedUp, setPickedUp] = useState(order.status === "picked_up");

  return (
    <div className={`p-4 rounded-xl border transition-colors ${
      pickedUp ? "bg-stone-50 border-stone-200 opacity-60" : "bg-white border-emerald-100 shadow-sm"
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className={`font-semibold text-lg ${pickedUp ? "text-stone-500 line-through" : "text-ink"}`}>
            {order.quantity}x {itemName}
          </h4>
          <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {order.consumer_name}
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {order.pickup_code}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-bold ${pickedUp ? "text-stone-400" : "text-emerald-600"}`}>
            {formatRupiah(order.total_price)}
          </div>
          <div className="text-xs text-stone-400 mt-1 uppercase font-medium">
            {pickedUp ? "Selesai" : "Menunggu"}
          </div>
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => setPickedUp(!pickedUp)}
        className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
          pickedUp 
            ? "bg-stone-200 text-stone-600 hover:bg-stone-300" 
            : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
        }`}
      >
        <Check className="w-4 h-4" />
        {pickedUp ? "Batal Selesai" : "Tandai Diambil"}
      </button>
    </div>
  );
}
