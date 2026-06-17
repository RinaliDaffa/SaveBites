"use client";

import React, { useState } from "react";
import { Button } from "@/components/shared/Button";
import { formatRupiah } from "@/lib/utils/format";

export function SurplusForm() {
  const [name, setName] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [discount, setDiscount] = useState("50");
  const [toast, setToast] = useState(false);

  const discountedPrice = originalPrice ? Math.round(Number(originalPrice) * (1 - Number(discount) / 100)) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Posted surplus:", { name, originalPrice, qty, discount });
    setToast(true);
    setTimeout(() => setToast(false), 3000);
    setName("");
    setOriginalPrice("");
    setQty("1");
    setDiscount("50");
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 relative overflow-hidden">
      {toast && (
        <div className="absolute top-0 left-0 right-0 bg-emerald-500 text-white text-center py-2 text-sm font-medium z-10 transition-all">
          Surplus berhasil diunggah!
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nama Menu Surplus</label>
          <input 
            type="text" 
            required 
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Contoh: Nasi Uduk Sisa"
            className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Harga Asli (Rp)</label>
            <input 
              type="number" 
              required 
              min="1000"
              value={originalPrice}
              onChange={e => setOriginalPrice(e.target.value)}
              placeholder="25000"
              className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Jumlah Porsi</label>
            <input 
              type="number" 
              required 
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-3">
            Diskon: <span className="font-bold text-emerald-600">{discount}%</span>
          </label>
          <div className="flex gap-2">
            {["50", "60", "70"].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDiscount(d)}
                className={`flex-1 py-2 rounded-xl border font-medium transition-colors ${
                  discount === d 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {d}%
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center">
          <span className="text-sm text-stone-600">Harga Jual Akhir</span>
          <span className="text-xl font-bold text-emerald-600">
            {formatRupiah(discountedPrice)}
          </span>
        </div>
        
        <Button type="submit" size="lg" className="w-full mt-2">
          Unggah Surplus
        </Button>
      </form>
    </div>
  );
}
