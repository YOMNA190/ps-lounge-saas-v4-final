-- ============================================================
-- Migration 002: Inventory + Shifts + POS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. INVENTORY CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE inventory_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT DEFAULT '📦',
  branch_id  UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. PRODUCTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE products (
  id            SERIAL PRIMARY KEY,
  category_id   INTEGER REFERENCES inventory_categories(id),
  name          TEXT NOT NULL,
  barcode       TEXT,
  cost_price    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  stock_qty     INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  min_stock_qty INTEGER NOT NULL DEFAULT 5,
  unit          TEXT DEFAULT 'قطعة',
  is_active     BOOLEAN DEFAULT TRUE,
  branch_id     UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. SALES (POS)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id),
  customer_id UUID REFERENCES customers(id),
  staff_id    UUID REFERENCES auth.users(id),
  total       NUMERIC(10,2) DEFAULT 0,
  notes       TEXT,
  branch_id   UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id         SERIAL PRIMARY KEY,
  sale_id    UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost  NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal   NUMERIC(10,2) GENERATED ALWAYS AS (qty * unit_price) STORED
);

-- Auto-update sale total + reduce stock
CREATE OR REPLACE FUNCTION after_sale_item_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update sale total
  UPDATE sales SET total = (
    SELECT COALESCE(SUM(subtotal), 0) FROM sale_items WHERE sale_id = NEW.sale_id
  ) WHERE id = NEW.sale_id;
  -- Reduce stock
  UPDATE products SET stock_qty = GREATEST(stock_qty - NEW.qty, 0)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_sale_item
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION after_sale_item_insert();

-- ─────────────────────────────────────────────────────────────
-- 4. SHIFTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE shifts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID NOT NULL REFERENCES auth.users(id),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  opening_cash     NUMERIC(10,2) DEFAULT 0,
  closing_cash     NUMERIC(10,2),
  expected_cash    NUMERIC(10,2),
  cash_difference  NUMERIC(10,2),
  cash_taken       NUMERIC(10,2) DEFAULT 0,
  cash_left        NUMERIC(10,2) DEFAULT 0,
  sessions_revenue NUMERIC(10,2) DEFAULT 0,
  sales_revenue    NUMERIC(10,2) DEFAULT 0,
  total_revenue    NUMERIC(10,2) DEFAULT 0,
  notes            TEXT,
  branch_id        UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 5. PACKAGES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE packages (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  device_type   TEXT,
  mode          TEXT DEFAULT 'both' CHECK (mode IN ('single','multi','both')),
  duration_mins INTEGER NOT NULL DEFAULT 60,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  valid_days    TEXT[] DEFAULT ARRAY['SU','MO','TU','WE','TH','FR','SA'],
  branch_id     UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 6. RESERVATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     INTEGER REFERENCES devices(id),
  customer_id   UUID REFERENCES customers(id),
  package_id    INTEGER REFERENCES packages(id),
  reserved_at   TIMESTAMPTZ NOT NULL,
  duration_mins INTEGER NOT NULL DEFAULT 60,
  mode          TEXT CHECK (mode IN ('single','multi')) DEFAULT 'single',
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes         TEXT,
  branch_id     UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_inventory_categories" ON inventory_categories FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "branch_products"   ON products   FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "branch_sales"      ON sales      FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "branch_sale_items" ON sale_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM sales WHERE id = sale_items.sale_id AND branch_id = get_my_branch_id()));
CREATE POLICY "branch_shifts"     ON shifts     FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "branch_packages"   ON packages   FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "branch_reservations" ON reservations FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());

-- ─────────────────────────────────────────────────────────────
-- 8. INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_products_branch   ON products(branch_id) WHERE is_active = TRUE;
CREATE INDEX idx_sales_branch_date ON sales(branch_id, created_at DESC);
CREATE INDEX idx_shifts_branch     ON shifts(branch_id);
CREATE INDEX idx_shifts_active     ON shifts(branch_id) WHERE ended_at IS NULL;
