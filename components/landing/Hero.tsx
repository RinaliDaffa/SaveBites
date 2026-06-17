import React from "react";
import { Button } from "@/components/shared/Button";
import { ArrowRight, Store } from "lucide-react";

export function Hero() {
  return (
    <div className="flex flex-col items-center text-center pt-16 pb-24 px-4 min-h-screen justify-center bg-stone-50">
      <div className="inline-block bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold mb-6">
        SaveBites MVP Demo
      </div>
      
      <h1 className="font-serif text-5xl md:text-6xl font-bold text-ink mb-6 leading-tight max-w-2xl">
        Makan Enak,<br />
        <span className="text-emerald-600">Setengah Harga.</span>
      </h1>
      
      <p className="text-lg md:text-xl text-stone-500 mb-12 max-w-xl">
        Selamatkan makanan berlebih dari restoran favoritmu sebelum mereka tutup. Harga miring, perut kenyang, kurangi sampah makanan.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Button href="/consumer" size="lg" className="flex-1">
          Saya Lapar
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <Button href="/merchant/post" variant="outline" size="lg" className="flex-1 bg-white">
          Saya Restoran
          <Store className="w-5 h-5 ml-2 text-stone-500" />
        </Button>
      </div>
    </div>
  );
}
