/**
 * SaveBites V3 — Listings Zustand Store
 * Manages discovery feed, filters, and listing actions.
 */

import { create } from 'zustand';
import type { ListingCard } from '@/lib/types/database';

interface ListingsState {
  nearbyListings: ListingCard[];
  isLoading: boolean;
  error: string | null;
  filters: {
    radius: number;
    maxPrice: number;
    categories: string[];
  };
  sortBy: 'price' | 'discount' | 'expires';
}

interface ListingsActions {
  setListings: (listings: ListingCard[]) => void;
  addListing: (listing: ListingCard) => void;
  removeListing: (id: string) => void;
  updateListing: (id: string, updates: Partial<ListingCard>) => void;
  setFilters: (filters: Partial<ListingsState['filters']>) => void;
  setSortBy: (sortBy: ListingsState['sortBy']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearFilters: () => void;
}

export type ListingsStore = ListingsState & ListingsActions;

export const useListingsStore = create<ListingsStore>()((set) => ({
  nearbyListings: [],
  isLoading: false,
  error: null,
  filters: {
    radius: 2000,
    maxPrice: 100000,
    categories: [],
  },
  sortBy: 'price',

  setListings: (listings) => set({ nearbyListings: listings, error: null }),
  addListing: (listing) => set((state) => ({
    nearbyListings: [...state.nearbyListings, listing],
  })),
  removeListing: (id) => set((state) => ({
    nearbyListings: state.nearbyListings.filter((l) => l.id !== id),
  })),
  updateListing: (id, updates) => set((state) => ({
    nearbyListings: state.nearbyListings.map((l) =>
      l.id === id ? { ...l, ...updates } : l
    ),
  })),
  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters },
  })),
  setSortBy: (sortBy) => set({ sortBy }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearFilters: () => set({
    filters: { radius: 2000, maxPrice: 100000, categories: [] },
  }),
}));

/** Selector for filtered and sorted listings */
export const useFilteredListings = (): ListingCard[] => {
  const { nearbyListings, filters, sortBy } = useListingsStore();

  // Apply filters
  let filtered = nearbyListings.filter((listing) => {
    if (filters.maxPrice > 0 && listing.surplus_price > filters.maxPrice) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(listing.category)) return false;
    return true;
  });

  // Apply sort
  switch (sortBy) {
    case 'price':
      filtered.sort((a, b) => a.surplus_price - b.surplus_price);
      break;
    case 'discount':
      filtered.sort(
        (a, b) =>
          (b.original_price - b.surplus_price) / b.original_price -
          (a.original_price - a.surplus_price) / a.original_price
      );
      break;
    case 'expires':
      filtered.sort((a, b) => new Date(a.available_until).getTime() - new Date(b.available_until).getTime());
      break;
  }

  return filtered;
};
