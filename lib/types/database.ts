/**
 * Database types generated from Supabase schema.
 * Run `npx supabase gen types typescript --project-id <id> --schema public > types/database.ts`
 * This is a temporary stub.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: 'consumer' | 'merchant';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      merchants: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          name: string;
          description: string | null;
          category: string;
          cuisine: string | null;
          address: string;
          city: string;
          latitude: number;
          longitude: number;
          phone: string | null;
          cover_image_url: string | null;
          logo_url: string | null;
          rating: number | null;
          total_reviews: number;
          opening_hours: Record<string, { open: string; close: string }>;
          is_active: boolean;
          verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['merchants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['merchants']['Insert']>;
      };
      menu_items: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          original_price: number;
          surplus_price: number;
          category: string;
          quantity_available: number;
          portions_per_item: number;
          available_from: string;
          available_until: string;
          is_active: boolean;
          is_sold_out: boolean;
          auto_discount: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['menu_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['menu_items']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          consumer_id: string;
          merchant_id: string;
          status: 'pending' | 'paid' | 'ready' | 'completed' | 'cancelled' | 'expired';
          payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed';
          payment_method: 'qris' | 'gopay' | 'ovo' | 'dana' | 'shopeepay' | 'cash' | null;
          subtotal: number;
          discount_total: number;
          service_fee: number;
          total: number;
          pickup_code: string;
          pickup_deadline: string;
          picked_up_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string;
          menu_item_name: string;
          unit_price: number;
          original_price: number;
          quantity: number;
          line_total: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          merchant_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['favorites']['Row'], 'id' | 'created_at'>;
        Update: Omit<Database['public']['Tables']['favorites']['Row'], 'created_at'>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'flash_sale' | 'order_paid' | 'order_ready' | 'order_completed' | 'order_expired';
          title: string;
          body: string;
          data: Record<string, unknown>;
          read_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
    };
    Functions: {
      search_merchants_nearby: {
        Args: { p_lat: number; p_lng: number; p_radius_km: number };
        Returns: {
          id: string;
          owner_id: string;
          slug: string;
          name: string;
          category: string;
          address: string;
          latitude: number;
          longitude: number;
          distance_km: number;
        }[];
      };
      listings_within_radius: {
        Args: { user_lat: number; user_lng: number; radius_km: number; max_results: number };
        Returns: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          original_price: number;
          surplus_price: number;
          merchant_name: string;
          merchant_latitude: number;
          merchant_longitude: number;
          distance_km: number;
        }[];
      };
    };
    Enums: {
      user_role: 'consumer' | 'merchant';
      order_status: 'pending' | 'paid' | 'ready' | 'completed' | 'cancelled' | 'expired';
      payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed';
      payment_method: 'qris' | 'gopay' | 'ovo' | 'dana' | 'shopeepay' | 'cash';
    };
  };
}
