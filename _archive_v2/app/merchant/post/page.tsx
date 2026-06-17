import React from "react";
import { Shell } from "@/components/shared/Shell";
import { SurplusForm } from "@/components/merchant/SurplusForm";
import Link from "next/link";
import { ListChecks } from "lucide-react";

export default function MerchantPostPage() {
  return (
    <Shell className="max-w-md bg-stone-50 min-h-screen pt-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Jual Surplus</h1>
          <p className="text-stone-500 text-sm">Unggah makanan sisa hari ini</p>
        </div>
        <Link 
          href="/merchant/orders" 
          className="flex flex-col items-center justify-center w-12 h-12 bg-white rounded-full shadow-sm border border-stone-200 text-stone-600 hover:text-emerald-600 transition-colors"
        >
          <ListChecks className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Antrean</span>
        </Link>
      </div>
      
      <SurplusForm />
    </Shell>
  );
}
