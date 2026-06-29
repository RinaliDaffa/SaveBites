/**
 * SaveBites V3 — Merchant Listings Client Component
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Pause, Play, Trash2 } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { formatIDR, discountPercent } from '@/lib/utils/pricing';
import type { Listing } from '@/lib/types/database';

interface Props {
  listings: Listing[];
}

export default function MerchantListingsClient({ listings }: Props) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const filteredListings = listings.filter(item => {
    if (activeFilter === 'Active') return item.is_active && !item.is_sold_out;
    if (activeFilter === 'Paused') return !item.is_active;
    if (activeFilter === 'Sold Out') return item.is_sold_out;
    return true;
  });

  const doMutation = useCallback(async (id: string, action: 'pause' | 'resume' | 'delete') => {
    setMutatingId(id);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: action !== 'delete' ? JSON.stringify({ action }) : undefined,
      });
      if (!res.ok) throw new Error('Mutation failed');
      window.location.reload();
    } catch {
      alert(`Gagal ${action} listing`);
    } finally {
      setMutatingId(null);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Daftar Menu</h1>
        <Link href="/m/listings/new">
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-2" /> Tambah Menu
          </Button>
        </Link>
      </div>

      {/* Tab filters */}
      <div className="flex gap-1 mb-6 bg-stone-100 rounded-xl p-1 w-fit">
        {['All', 'Active', 'Paused', 'Sold Out'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === activeFilter ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500 hover:bg-stone-200'
            }`}
          >
            {filter === 'All' ? 'Semua' : filter === 'Active' ? 'Aktif' : filter === 'Paused' ? 'Dihentikan' : 'Habis'}
          </button>
        ))}
      </div>

      {filteredListings.length === 0 && listings.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#128230;</div>
          <h3 className="text-lg font-semibold text-stone-900 mb-1">Belum ada listing</h3>
          <p className="text-sm text-stone-500 mb-4">Buat listing surplus meal pertama Anda untuk mulai berjualan.</p>
          <Link href="/m/listings/new">
            <Button variant="primary"><Plus className="w-4 h-4 mr-2" />Buat Listing Pertama</Button>
          </Link>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center py-20 text-stone-500">
          <p>Tidak ada listing {activeFilter === 'All' ? '' : activeFilter.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredListings.map(item => {
            const dp = discountPercent({ originalPrice: item.original_price, surplusPrice: item.surplus_price });
            return (
              <Card key={item.id}>
                <Card.Body>
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 bg-stone-100 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl">
                      {item.category === 'Rice Dishes' ? '&#127860;' : item.category === 'Bakery' ? '&#127856;' : '&#128230;'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-stone-900">{item.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {item.category && <Badge variant="neutral" className="text-xs">{item.category}</Badge>}
                            {getStatusBadge(item)}
                          </div>
                        </div>
                        <span className="font-bold text-emerald-600">{formatIDR(item.surplus_price)}</span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                        <span>{dp}% off</span>
                        <span>Asli: {formatIDR(item.original_price)}</span>
                        <span>Sisa: {item.quantity_available}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-100">
                    {item.is_active && (
                      <Button
                        variant="ghost" size="sm" className="text-xs"
                        onClick={() => doMutation(item.id, 'pause')}
                        disabled={mutatingId === item.id}
                      >
                        <Pause className="w-3.5 h-3.5 mr-1" /> Hentikan
                      </Button>
                    )}
                    {!item.is_active && (
                      <Button
                        variant="ghost" size="sm" className="text-xs"
                        onClick={() => doMutation(item.id, 'resume')}
                        disabled={mutatingId === item.id}
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Lanjutkan
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm" className="text-xs text-red-600"
                      onClick={() => doMutation(item.id, 'delete')}
                      disabled={mutatingId === item.id}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getStatusBadge(item: Listing) {
  if (item.is_sold_out) return <Badge variant="error">Habis</Badge>;
  if (!item.is_active) return <Badge variant="neutral">Dihentikan</Badge>;
  if (new Date(item.available_until) < new Date()) return <Badge variant="error">Kadaluarsa</Badge>;
  return <Badge variant="success">Aktif</Badge>;
}
