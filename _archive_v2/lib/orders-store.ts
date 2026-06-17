"use client";

import { create } from "zustand";
import { supabaseBrowser } from "./supabase-browser";

export interface OrderRow {
  id: string;
  consumer_id: string;
  listing_id: string;
  merchant_id: string;
  portions: number;
  total_price: number;
  qr_token: string;
  status:
    | "awaiting_payment"
    | "paid"
    | "picked_up"
    | "expired"
    | "cancelled";
  pickup_deadline: string;
  paid_at: string | null;
  picked_up_at: string | null;
  created_at: string;
  updated_at: string;
  listings: {
    id: string;
    title: string;
    image_url: string | null;
    merchant_id: string;
    profiles: { business_name: string | null; address: string | null } | null;
  } | null;
}

interface OrdersState {
  activeOrders: OrderRow[];
  isLoading: boolean;
  error: string | null;
  loadActive: (consumerId: string) => Promise<void>;
  bookListing: (
    consumerId: string,
    listingId: string,
    portions: number
  ) => Promise<OrderRow | null>;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  activeOrders: [],
  isLoading: false,
  error: null,

  async loadActive(consumerId) {
    set({ isLoading: true, error: null });
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from("orders")
      .select(
        "*, listings(id, title, image_url, merchant_id, profiles:merchant_id(business_name, address))"
      )
      .eq("consumer_id", consumerId)
      .in("status", ["paid", "awaiting_payment"])
      .order("created_at", { ascending: false });
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ activeOrders: (data ?? []) as OrderRow[], isLoading: false });
  },

  async bookListing(consumerId, listingId, portions) {
    set({ isLoading: true, error: null });
    const sb = supabaseBrowser();

    // 1. Read listing to validate + compute price
    const { data: listing, error: lerr } = await sb
      .from("listings")
      .select("original_price, discount_pct, portions_left, status, merchant_id")
      .eq("id", listingId)
      .single();
    if (lerr || !listing) {
      set({ error: lerr?.message ?? "Listing not found", isLoading: false });
      return null;
    }
    if (listing.status !== "active" || listing.portions_left < portions) {
      set({ error: "Sold out", isLoading: false });
      return null;
    }

    const finalPerPortion = Math.round(
      listing.original_price * (1 - listing.discount_pct / 100)
    );
    const total = finalPerPortion * portions;
    const pickupDeadline = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    // 2. Insert order
    const { data: order, error: oerr } = await sb
      .from("orders")
      .insert({
        consumer_id: consumerId,
        listing_id: listingId,
        merchant_id: listing.merchant_id,
        portions,
        total_price: total,
        pickup_deadline: pickupDeadline,
        status: "awaiting_payment",
      })
      .select(
        "*, listings(id, title, image_url, merchant_id, profiles:merchant_id(business_name, address))"
      )
      .single();
    if (oerr || !order) {
      set({ error: oerr?.message ?? "Order failed", isLoading: false });
      return null;
    }

    // 3. Decrement portions (best-effort; the real flow would be a server function)
    await sb
      .from("listings")
      .update({ portions_left: listing.portions_left - portions })
      .eq("id", listingId);

    const created = order as OrderRow;
    set((state) => ({
      activeOrders: [created, ...state.activeOrders],
      isLoading: false,
    }));
    return created;
  },
}));
