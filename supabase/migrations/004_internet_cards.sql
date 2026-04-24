-- ============================================================
-- Migration 004: Internet Cards
-- ============================================================

CREATE TYPE card_status AS ENUM ('available', 'sold', 'void');
CREATE TYPE card_payment_method AS ENUM ('vodafone_cash', 'instapay', 'cash');

CREATE TABLE card_types (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  provider          TEXT NOT NULL,
  data_amount       TEXT NOT NULL DEFAULT '10 جيجا',
  validity_days     INTEGER DEFAULT 30,
  cost_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  sell_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_alert   INTEGER DEFAULT 3,
  is_active         BOOLEAN DEFAULT TRUE,
  branch_id         UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id        INTEGER NOT NULL REFERENCES card_types(id),
  serial_code    TEXT,
  status         card_status DEFAULT 'available',
  sold_at        TIMESTAMPTZ,
  sold_to        UUID REFERENCES customers(id),
  sold_by        UUID REFERENCES auth.users(id),
  sale_price     NUMERIC(10,2),
  payment_method card_payment_method,
  payment_ref    TEXT,
  notes          TEXT,
  branch_id      UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_type_status ON cards(type_id, status);
CREATE INDEX idx_cards_branch      ON cards(branch_id, status);

-- ─────────────────────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW card_inventory_summary AS
SELECT
  ct.id, ct.name, ct.provider, ct.data_amount, ct.validity_days,
  ct.cost_price, ct.sell_price, ct.sell_price - ct.cost_price AS margin,
  ct.low_stock_alert, ct.is_active,
  COUNT(c.id) FILTER (WHERE c.status = 'available') AS available_count,
  COUNT(c.id) FILTER (WHERE c.status = 'sold')      AS sold_count,
  COUNT(c.id) FILTER (WHERE c.status = 'void')      AS void_count,
  (COUNT(c.id) FILTER (WHERE c.status = 'available')) <= ct.low_stock_alert AS is_low_stock
FROM card_types ct
LEFT JOIN cards c ON c.type_id = ct.id
WHERE ct.is_active = TRUE AND ct.branch_id = get_my_branch_id()
GROUP BY ct.id, ct.name, ct.provider, ct.data_amount, ct.validity_days,
         ct.cost_price, ct.sell_price, ct.low_stock_alert, ct.is_active;

CREATE OR REPLACE VIEW card_sales_report AS
SELECT
  DATE(c.sold_at AT TIME ZONE 'Africa/Cairo') AS sale_date,
  ct.provider, ct.name AS card_name, ct.data_amount,
  COUNT(c.id)                         AS qty_sold,
  SUM(c.sale_price)                   AS total_revenue,
  SUM(ct.cost_price)                  AS total_cost,
  SUM(c.sale_price - ct.cost_price)   AS total_profit,
  c.payment_method
FROM cards c
JOIN card_types ct ON ct.id = c.type_id
WHERE c.status = 'sold' AND c.sold_at IS NOT NULL
  AND c.branch_id = get_my_branch_id()
GROUP BY DATE(c.sold_at AT TIME ZONE 'Africa/Cairo'),
         ct.provider, ct.name, ct.data_amount, c.payment_method
ORDER BY sale_date DESC;

-- ─────────────────────────────────────────────────────────────
-- SELL CARD (atomic, FIFO, branch-scoped)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sell_card(
  p_type_id        INTEGER,
  p_customer_id    UUID    DEFAULT NULL,
  p_payment_method TEXT    DEFAULT 'cash',
  p_payment_ref    TEXT    DEFAULT NULL,
  p_sale_price     NUMERIC DEFAULT NULL,
  p_notes          TEXT    DEFAULT NULL
) RETURNS cards LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  card      cards;
  ctype     card_types;
  remaining INTEGER;
  my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();

  SELECT * INTO ctype FROM card_types
  WHERE id = p_type_id AND is_active = TRUE AND branch_id = my_branch;
  IF NOT FOUND THEN RAISE EXCEPTION 'نوع الكارت غير موجود'; END IF;

  SELECT * INTO card FROM cards
  WHERE type_id = p_type_id AND status = 'available' AND branch_id = my_branch
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION 'لا توجد كروت متاحة من هذا النوع'; END IF;

  UPDATE cards SET
    status = 'sold', sold_at = NOW(),
    sold_to = p_customer_id, sold_by = auth.uid(),
    sale_price = COALESCE(p_sale_price, ctype.sell_price),
    payment_method = p_payment_method::card_payment_method,
    payment_ref = p_payment_ref, notes = p_notes
  WHERE id = card.id RETURNING * INTO card;

  SELECT COUNT(*) INTO remaining
  FROM cards WHERE type_id = p_type_id AND status = 'available' AND branch_id = my_branch;

  IF remaining <= ctype.low_stock_alert THEN
    INSERT INTO alerts(type, title, message, entity_id)
    VALUES('low_stock','كروت منخفضة: '||ctype.name,
           'متبقي '||remaining||' كارت — يرجى إعادة التخزين', p_type_id::TEXT)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN card;
END;
$$;

-- RESTOCK
CREATE OR REPLACE FUNCTION restock_cards(
  p_type_id  INTEGER,
  p_quantity INTEGER,
  p_serials  TEXT[] DEFAULT NULL
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i INTEGER; serial TEXT; my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();
  IF p_serials IS NOT NULL AND array_length(p_serials,1) > 0 THEN
    FOREACH serial IN ARRAY p_serials LOOP
      INSERT INTO cards(type_id, serial_code, branch_id) VALUES(p_type_id, serial, my_branch);
    END LOOP;
    RETURN array_length(p_serials,1);
  ELSE
    FOR i IN 1..p_quantity LOOP
      INSERT INTO cards(type_id, branch_id) VALUES(p_type_id, my_branch);
    END LOOP;
    RETURN p_quantity;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE card_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_card_types" ON card_types FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "branch_cards" ON cards FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
