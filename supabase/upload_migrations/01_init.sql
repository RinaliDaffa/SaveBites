-- ============================================================
-- SaveBites DB - Init Migration
-- Copy ALL of this into Supabase SQL Editor and Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('consumer', 'professional', 'merchant');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'ready', 'completed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'unpaid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('qris', 'bank_transfer', 'ewallet');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_attempt_status AS ENUM ('pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'refund', 'partial_refund', 'chargeback', 'failure');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text,
  role user_role NOT NULL DEFAULT 'consumer',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

-- MERCHANTS
CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_description text NOT NULL DEFAULT '',
  photos jsonb[] NOT NULL DEFAULT '{}',
  opening_hours jsonb NOT NULL DEFAULT '{"monday":{"open":"09:00","close":"17:00"},"tuesday":{"open":"09:00","close":"17:00"},"wednesday":{"open":"09:00","close":"17:00"},"thursday":{"open":"09:00","close":"17:00"},"friday":{"open":"09:00","close":"17:00"},"saturday":{"open":"09:00","close":"17:00"},"sunday":{"open":"10:00","close":"16:00"}}',
  is_verified boolean NOT NULL DEFAULT false,
  rating numeric(3,2) DEFAULT 0,
  total_reviews int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchants_select_public" ON merchants;
CREATE POLICY "merchants_select_public" ON merchants FOR SELECT USING (true);

DROP POLICY IF EXISTS "merchants_insert_owner" ON merchants;
CREATE POLICY "merchants_insert_owner" ON merchants FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "merchants_update_owner" ON merchants;
CREATE POLICY "merchants_update_owner" ON merchants FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "merchants_delete_owner" ON merchants;
CREATE POLICY "merchants_delete_owner" ON merchants FOR DELETE USING (auth.uid() = owner_id);

-- LISTINGS
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  consumer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  original_price numeric(10,2) NOT NULL,
  discounted_price numeric(10,2) NOT NULL,
  quantity int NOT NULL,
  units text NOT NULL,
  images text[] NOT NULL DEFAULT '{}',
  category text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  expiry_at timestamptz NOT NULL,
  views_count int NOT NULL DEFAULT 0,
  bookmark_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_select_public" ON listings;
CREATE POLICY "listings_select_public" ON listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "listings_insert_merchant" ON listings;
CREATE POLICY "listings_insert_merchant" ON listings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM merchants m WHERE m.id = listings.merchant_id AND m.owner_id = auth.uid()));

DROP POLICY IF EXISTS "listings_update_merchant" ON listings;
CREATE POLICY "listings_update_merchant" ON listings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM merchants m WHERE m.id = listings.merchant_id AND m.owner_id = auth.uid()));

DROP POLICY IF EXISTS "listings_delete_merchant" ON listings;
CREATE POLICY "listings_delete_merchant" ON listings FOR DELETE
  USING (EXISTS (SELECT 1 FROM merchants m WHERE m.id = listings.merchant_id AND m.owner_id = auth.uid()));

-- ORDERS
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1000 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number text NOT NULL DEFAULT 'SB-' || nextval('order_number_seq'),
  consumer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  quantity int NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  pickup_code char(6),
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_method payment_method,
  payment_proof text,
  reserved_at timestamptz,
  confirmed_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_consumer" ON orders;
CREATE POLICY "orders_select_consumer" ON orders FOR SELECT USING (auth.uid() = consumer_id);

DROP POLICY IF EXISTS "orders_select_merchant" ON orders;
CREATE POLICY "orders_select_merchant" ON orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM merchants m WHERE m.id = orders.merchant_id AND m.owner_id = auth.uid()));

-- REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  consumer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  merchant_reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
CREATE POLICY "reviews_select_public" ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert_consumer" ON reviews;
CREATE POLICY "reviews_insert_consumer" ON reviews FOR INSERT WITH CHECK (auth.uid() = consumer_id);

DROP POLICY IF EXISTS "reviews_update_consumer" ON reviews;
CREATE POLICY "reviews_update_consumer" ON reviews FOR UPDATE USING (auth.uid() = consumer_id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_listings_merchant ON listings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_expiry ON listings(expiry_at);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_orders_consumer ON orders(consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_reserved ON orders(reserved_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reviews_merchant ON reviews(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants(owner_id);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_merchants_updated_at ON merchants;
CREATE TRIGGER trg_merchants_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_listings_updated_at ON listings;
CREATE TRIGGER trg_listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(nullif(new.raw_user_meta_data->>'role', ''), 'consumer');
  IF v_role NOT IN ('consumer', 'professional', 'merchant') THEN
    v_role := 'consumer';
  END IF;
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, COALESCE(nullif(new.raw_user_meta_data->>'full_name', ''), ''), v_role::user_role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
