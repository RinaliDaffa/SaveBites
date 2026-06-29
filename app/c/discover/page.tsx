/**
 * SaveBites V3 — Consumer Discovery Page
 * Map + List hybrid layout. Shows nearby surplus meals with filters.
 *
 * Data source: /api/discovery/nearby (POST) which calls getNearbyListings()
 * from lib/queries/listings. Falls back to URL params ?lat=&lng= when
 * geolocation permission is denied.
 */

'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { ListingCard } from '@/components/shared/ListingCard';
import { FiltersBar } from '@/components/shared/FiltersBar';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Button } from '@/components/primitives/Button';
import { Skeleton, CardSkeleton } from '@/components/primitives/Skeleton';
import { trpc } from '@/lib/trpc/trpc';
import { createClient } from '@/lib/supabase/client';
import type { ListingCard as ListingCardType } from '@/lib/types/database';
import { useRouter, useSearchParams } from 'next/navigation';

const DiscoverContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [listings, setListings] = useState<ListingCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(['all']);
  const [selectedRadius, setSelectedRadius] = useState(2000);
  const [selectedMaxPrice, setSelectedMaxPrice] = useState(50000);
  const [sortBy, setSortBy] = useState('expiring');

  const fetchListings = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const data = await trpc.discovery.getNearby({
        lat, lng, radius: selectedRadius, maxPrice: selectedMaxPrice,
        limit: 20, sortBy: sortBy as 'cheapest' | 'nearest' | 'expiring',
      });
      setListings(data);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRadius, selectedMaxPrice, sortBy]);

  // Get coordinates: check URL params first, then geolocation
  useEffect(() => {
    const urlLat = searchParams.get('lat');
    const urlLng = searchParams.get('lng');

    if (urlLat && urlLng) {
      const lat = parseFloat(urlLat);
      const lng = parseFloat(urlLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        fetchListings(lat, lng);
        return;
      }
    }

    // Fallback: try browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchListings(pos.coords.latitude, pos.coords.longitude),
        () => {
          // Default to Yogyakarta center
          fetchListings(-7.7972, 110.3688);
        }
      );
    } else {
      fetchListings(-7.7972, 110.3688);
    }
  }, [fetchListings, searchParams]);

  // Subscribe to Supabase Realtime for listings changes.
  // Invalidates and re-fetches whenever a listing is inserted, updated, or deleted.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('public:listings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listings' },
        () => {
          // Trigger a fresh fetch using the current stored coords.
          // We coalesce to the yogyakarta default when no coords are known.
          const urlLat = searchParams.get('lat');
          const urlLng = searchParams.get('lng');
          let lat = urlLat ? parseFloat(urlLat) : -7.7972;
          let lng = urlLng ? parseFloat(urlLng) : 110.3688;
          fetchListings(lat, lng);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchListings, searchParams]);

  // Filter listings based on search query
  const filtered = listings.filter(l => {
    const title = typeof l.title === 'string' ? l.title.toLowerCase() : '';
    const merchant = typeof l.merchant_name === 'string' ? l.merchant_name.toLowerCase() : '';
    return title.includes(searchQuery.toLowerCase()) || merchant.includes(searchQuery.toLowerCase());
  });

  // Convert ListingCard data to props the ListingCard component expects
  const cardProps = filtered.map((l) => ({
    key: l.id,
    id: l.id,
    title: l.title,
    imageUrl: l.image_url ?? undefined,
    merchantName: l.merchant_name || 'Restaurant',
    merchantDistance: Math.round(l.distance_km * 1000), // convert km -> meters
    originalPrice: l.original_price,
    surplusPrice: l.surplus_price,
    availableQuantity: l.quantity_available,
    expiresAt: new Date(l.available_until).getTime(),
    category: l.category || 'other',
    onClick: () => router.push(`/c/listing/${l.id}`),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Discover</h1>
            <div className="flex items-center gap-1 text-sm text-stone-500 mt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pesan surplus di lingkunganmu</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex gap-3 mb-4">
          <Input
            placeholder="Cari makanan atau restoran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            className="flex-1"
          />
        </div>

        {showFilters && (
          <Card className="mb-4">
            <Card.Body>
              <FiltersBar
                selectedCategories={selectedCategories}
                selectedRadius={selectedRadius}
                selectedMaxPrice={selectedMaxPrice}
                sortBy={sortBy}
                onCategoryChange={setSelectedCategories}
                onRadiusChange={setSelectedRadius}
                onMaxPriceChange={setSelectedMaxPrice}
                onSortChange={setSortBy}
              />
            </Card.Body>
          </Card>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🍽️</div>
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Tidak ada pesanan ditemukan</h3>
          <p className="text-stone-500">Coba sesuaikan filter atau gerakkan lebih dekat ke restoran.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {cardProps.map((props) => (
            <ListingCard {...props} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-10 text-center">Memuat...</div>}>
      <DiscoverContent />
    </Suspense>
  );
}
