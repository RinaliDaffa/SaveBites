/**
 * SaveBites V3 — Landing Page
 * Hero section, value prop, and CTAs for both consumers and merchants.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Leaf, ArrowRight, MapPin, Coins, Sparkles } from 'lucide-react';
import { Button } from '@/components/primitives/Button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span>🛡️</span> SaveBites
        </div>
        <div className="flex gap-3">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">Masuk</Button>
          </Link>
          <Link href="/auth/register">
            <Button variant="primary" size="sm">Mulai</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
          <Leaf className="w-4 h-4" />
          Melawan sampah makanan, satu hidangan demi satu hidangan
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-stone-900 leading-tight max-w-3xl">
          Selamatkan makanan.
<br />
          Selamatkan uang.
<br />
          <span className="text-emerald-600">Selamatkan bumi.</span>
        </h1>

        <p className="mt-6 text-lg text-stone-500 max-w-xl">
          Temukan makanan surplus dari restoran terdekat dengan harga diskon besar — atau jual makanan muakamu untuk mengurangi sampah dan menambah penghasilan.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link href="/auth/register">
            <Button variant="primary" size="lg">
              Mulai sebagai Konsumen <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button variant="outline" size="lg">
              Mulai sebagai Merchant
            </Button>
          </Link>
        </div>
      </section>

      {/* Value Props */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
              <MapPin className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-semibold text-stone-900 mb-2">Makanan Surplus Terdekat</h3>
            <p className="text-stone-500">
              Temukan hidangan surplus dari restoran tepercaya dalam jarak berjalan kaki. Didukung oleh kedekatan GPS secara real-time.
            </p>
          </div>

          <div className="text-center p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-4">
              <Coins className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-semibold text-stone-900 mb-2">Hemat Hingga 70%</h3>
            <p className="text-stone-500">
              Beli makanan yang akan terbuang sia-sia dengan diskon hingga 70% dari harga ritel. Makanan enak seharusnya tidak mahal.
            </p>
          </div>

          <div className="text-center p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-semibold text-stone-900 mb-2">Kurangi Sampah Makanan</h3>
            <p className="text-stone-500">
              Setiap hidangan surplus yang disimpan adalah makanan yang tidak berakhir di tempat pembuangan akhir. Bergabunglah dengan gerakan untuk melawan kelaparan dan perubahan iklim.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-24 bg-stone-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-stone-900 mb-12">Cara Kerja</h2>
          <div className="grid sm:grid-cols-4 gap-8">
            {[
              { emoji: '📱', label: 'Jelajahi', desc: 'Temukan makanan surplus di dekatmu' },
              { emoji: '💳', label: 'Bayar', desc: 'Bayar dengan aman secara online' },
              { emoji: '✅', label: 'Konfirmasi', desc: 'Dapatkan kode QR kamu' },
              { emoji: '🍱', label: 'Ambil', desc: 'Ambil di konter' },
            ].map((step) => (
              <div key={step.label} className="text-center">
                <div className="text-4xl mb-2">{step.emoji}</div>
                <div className="font-semibold text-stone-900">{step.label}</div>
                <div className="text-sm text-stone-500">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-sm text-stone-400 max-w-7xl mx-auto">
        © {new Date().getFullYear()} SaveBites — Melawan sampah makanan di Yogyakarta dan sekitarnya.
      </footer>
    </div>
  );
}
