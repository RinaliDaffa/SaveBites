"use client";

import React, { useState, useEffect } from "react";
import { formatCountdown } from "@/lib/utils/format";
import { MenuItem } from "@/lib/types";
import { CheckCircle2, AlertCircle } from "lucide-react";

function generateQRGrid(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const grid = [];
  for (let i = 0; i < 64; i++) {
    grid.push((hash & (1 << (i % 32))) !== 0);
  }
  return grid;
}

export function QRTicket({ 
  orderId, 
  listing 
}: { 
  orderId: string; 
  listing: MenuItem;
}) {
  const [countdown, setCountdown] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const cd = formatCountdown(listing.available_until);
      setCountdown(cd);
      setIsExpired(cd === "expired");
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [listing.available_until]);

  const grid = generateQRGrid(orderId);
  // Extract trailing timestamp digits as the code
  const code = orderId.slice(-6).toUpperCase();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      <div className={`p-4 text-center ${isExpired ? "bg-stone-100" : "bg-emerald-50"}`}>
        {isExpired ? (
          <div className="flex items-center justify-center gap-2 text-stone-600 font-medium">
            <AlertCircle className="w-5 h-5" />
            <span>Waktu Pengambilan Habis</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="w-5 h-5" />
            <span>Pesanan Berhasil!</span>
          </div>
        )}
      </div>
      
      <div className="p-8 flex flex-col items-center">
        <div className={`mb-6 p-4 bg-white border-2 border-stone-100 rounded-xl ${isExpired ? "opacity-30 grayscale" : ""}`}>
          <div className="w-48 h-48 grid grid-cols-8 grid-rows-8 gap-0.5">
            {grid.map((isDark, i) => (
              <div 
                key={i} 
                className={isDark ? "bg-stone-900" : "bg-white"}
              />
            ))}
            {/* Corner markers to look more like QR */}
            <div className="col-start-1 col-end-4 row-start-1 row-end-4 border-4 border-stone-900 bg-white" />
            <div className="col-start-6 col-end-9 row-start-1 row-end-4 border-4 border-stone-900 bg-white" />
            <div className="col-start-1 col-end-4 row-start-6 row-end-9 border-4 border-stone-900 bg-white" />
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-stone-500 uppercase tracking-widest mb-1">Kode Pengambilan</p>
          <p className="text-4xl font-bold font-mono tracking-wider text-ink">{code}</p>
        </div>
        
        <div className="w-full h-px bg-stone-100 my-6 border-t border-dashed border-stone-300"></div>
        
        <div className="w-full text-center">
          <p className="text-sm text-stone-500 mb-1">Ambil sebelum</p>
          <p className={`text-xl font-bold ${isExpired ? "text-stone-400 line-through" : "text-orange-600"}`}>
            {countdown === "expired" ? "Kedaluwarsa" : countdown}
          </p>
        </div>
      </div>
    </div>
  );
}
