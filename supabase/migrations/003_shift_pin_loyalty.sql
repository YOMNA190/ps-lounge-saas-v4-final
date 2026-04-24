-- ============================================================
-- Migration 003: Shift PIN + Loyalty System + Views
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. SHIFT PIN on profiles
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shift_pin TEXT;

-- Set staff PIN (admin only)
CREATE OR REPLACE FUNCTION set_staff_pin(p_staff_id UUID, p_pin TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can set PINs';
  END IF;
  UPDATE profiles SET shift_pin = crypt(p_pin, gen_salt('bf')) WHERE id = p_staff_id;
END;
$$;

-- End shift with PIN verification
CREATE OR REPLACE FUNCTION end_shift(
  p_shift_id     UUID,
  p_pin          TEXT,
  p_closing_cash NUMERIC,
  p_cash_taken   NUMERIC,
  p_cash_left    NUMERIC
) RETURNS shifts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  shift_rec shifts;
  staff_rec profiles;
  sess_rev  NUMERIC;
  sale_rev  NUMERIC;
BEGIN
  SELECT * INTO shift_rec FROM shifts
  WHERE id = p_shift_id AND branch_id = get_my_branch_id() AND ended_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الشيفت غير موجود أو منتهي بالفعل';
  END IF;

  -- Verify PIN (skip if null — allows admin bypass)
  SELECT * INTO staff_rec FROM profiles WHERE id = shift_rec.staff_id;
  IF staff_rec.shift_pin IS NOT NULL THEN
    IF NOT (crypt(p_pin, staff_rec.shift_pin) = staff_rec.shift_pin) THEN
      RAISE EXCEPTION 'PIN غير صحيح';
    END IF;
  END IF;

  -- Calculate revenues
  SELECT COALESCE(SUM(cost),0) INTO sess_rev
  FROM sessions WHERE staff_id = shift_rec.staff_id
    AND branch_id = shift_rec.branch_id
    AND started_at >= shift_rec.started_at AND ended_at IS NOT NULL;

  SELECT COALESCE(SUM(total),0) INTO sale_rev
  FROM sales WHERE staff_id = shift_rec.staff_id
    AND branch_id = shift_rec.branch_id
    AND created_at >= shift_rec.started_at;

  UPDATE shifts SET
    ended_at         = NOW(),
    closing_cash     = p_closing_cash,
    cash_taken       = p_cash_taken,
    cash_left        = p_cash_left,
    expected_cash    = opening_cash + sess_rev + sale_rev,
    cash_difference  = p_closing_cash - (opening_cash + sess_rev + sale_rev),
    sessions_revenue = sess_rev,
    sales_revenue    = sale_rev,
    total_revenue    = sess_rev + sale_rev
  WHERE id = p_shift_id
  RETURNING * INTO shift_rec;

  RETURN shift_rec;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. LOYALTY: customer monthly spending view
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW customer_monthly_spending AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.points,
  COALESCE(b.loyalty_limit, 10000) AS monthly_spend_limit,
  TO_CHAR(NOW() AT TIME ZONE 'Africa/Cairo', 'YYYY-MM') AS current_month,
  COALESCE(sess.sessions_spend, 0) AS sessions_spend,
  COALESCE(pos.products_spend, 0)  AS products_spend,
  COALESCE(sess.sessions_spend, 0) + COALESCE(pos.products_spend, 0) AS total_spend,
  COALESCE(sess.total_hours, 0)    AS total_hours_this_month,
  GREATEST(
    COALESCE(b.loyalty_limit, 10000) -
    (COALESCE(sess.sessions_spend, 0) + COALESCE(pos.products_spend, 0)), 0
  ) AS limit_remaining,
  (COALESCE(sess.sessions_spend, 0) + COALESCE(pos.products_spend, 0))
    >= COALESCE(b.loyalty_limit, 10000) AS limit_exceeded,
  FALSE AS reward_claimed_this_month,
  ARRAY[]::TEXT[] AS reward_earned_months
FROM customers c
LEFT JOIN branches b ON b.id = c.branch_id
LEFT JOIN (
  SELECT customer_id,
    SUM(COALESCE(cost, 0)) AS sessions_spend,
    SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0) AS total_hours
  FROM sessions
  WHERE ended_at IS NOT NULL
    AND DATE_TRUNC('month', started_at AT TIME ZONE 'Africa/Cairo')
      = DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Cairo')
  GROUP BY customer_id
) sess ON sess.customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(total) AS products_spend
  FROM sales
  WHERE DATE_TRUNC('month', created_at AT TIME ZONE 'Africa/Cairo')
    = DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Cairo')
  GROUP BY customer_id
) pos ON pos.customer_id = c.id
WHERE c.branch_id = get_my_branch_id();

-- Claim reward RPC
CREATE OR REPLACE FUNCTION claim_customer_reward(p_customer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  spending RECORD;
BEGIN
  SELECT * INTO spending FROM customer_monthly_spending WHERE id = p_customer_id;
  IF NOT FOUND OR NOT spending.limit_exceeded THEN
    RAISE EXCEPTION 'العميل لم يصل للحد المطلوب';
  END IF;
  -- Award 100 bonus points
  UPDATE customers SET points = points + 100 WHERE id = p_customer_id;
  RETURN jsonb_build_object(
    'total_spend',  spending.total_spend,
    'total_hours',  spending.total_hours_this_month,
    'reward',       'يوم مجاني'
  );
END;
$$;

-- Restock product
CREATE OR REPLACE FUNCTION restock_product(
  p_product_id INTEGER,
  p_qty        INTEGER,
  p_notes      TEXT DEFAULT NULL,
  p_staff_id   UUID DEFAULT NULL
) RETURNS products LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE prod products;
BEGIN
  UPDATE products SET stock_qty = stock_qty + p_qty, updated_at = NOW()
  WHERE id = p_product_id AND branch_id = get_my_branch_id()
  RETURNING * INTO prod;
  IF NOT FOUND THEN RAISE EXCEPTION 'المنتج غير موجود'; END IF;
  RETURN prod;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. ANALYTICS VIEWS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_device_revenue AS
SELECT
  s.device_id,
  d.name  AS device_name,
  d.type  AS device_type,
  DATE(s.started_at AT TIME ZONE 'Africa/Cairo') AS day,
  COUNT(*)                                        AS session_count,
  COALESCE(SUM(s.cost), 0)                       AS total_revenue,
  COALESCE(AVG(s.cost), 0)                       AS avg_session_cost,
  COALESCE(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600.0), 0) AS total_hours
FROM sessions s
JOIN devices d ON d.id = s.device_id
WHERE s.ended_at IS NOT NULL
  AND s.branch_id = get_my_branch_id()
GROUP BY s.device_id, d.name, d.type, DATE(s.started_at AT TIME ZONE 'Africa/Cairo');

CREATE OR REPLACE VIEW top_customers_monthly AS
SELECT
  c.id, c.name, c.phone, c.points,
  COUNT(s.id)                                   AS session_count,
  COALESCE(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600.0), 0) AS total_hours,
  COALESCE(SUM(s.cost), 0)                      AS total_spent,
  TO_CHAR(NOW(), 'YYYY-MM')                     AS month
FROM customers c
LEFT JOIN sessions s ON s.customer_id = c.id
  AND s.ended_at IS NOT NULL
  AND DATE_TRUNC('month', s.started_at) = DATE_TRUNC('month', NOW())
WHERE c.branch_id = get_my_branch_id()
GROUP BY c.id, c.name, c.phone, c.points
ORDER BY total_spent DESC
LIMIT 10;

CREATE OR REPLACE VIEW top_games_monthly AS
SELECT
  game_played,
  COUNT(*)                                     AS play_count,
  COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0), 0) AS total_hours
FROM sessions
WHERE ended_at IS NOT NULL
  AND game_played IS NOT NULL
  AND DATE_TRUNC('month', started_at) = DATE_TRUNC('month', NOW())
  AND branch_id = get_my_branch_id()
GROUP BY game_played
ORDER BY play_count DESC
LIMIT 10;
