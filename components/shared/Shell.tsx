import Link from "next/link";
import React from "react";

export function Shell({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-screen-md mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-bold text-emerald-600">
            SaveBites
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-stone-600">
            <Link href="/consumer" className="hover:text-emerald-600 transition-colors">
              Pesan
            </Link>
            <Link href="/merchant/post" className="hover:text-emerald-600 transition-colors">
              Jual Surplus
            </Link>
          </nav>
        </div>
      </header>
      <main className={`flex-1 max-w-screen-md mx-auto w-full px-4 py-6 ${className}`}>
        {children}
      </main>
    </div>
  );
}
