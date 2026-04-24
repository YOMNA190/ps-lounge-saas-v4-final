-- ============================================================
-- Migration 005: Core Functions
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. SETUP NEW BRANCH (called from Onboarding)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION setup_new_branch(
  p_user_id     UUID,
  p_branch_name TEXT,
  p_address     TEXT DEFAULT NULL,
  p_phone       TEXT DEFAULT NULL
) RETURNS branches LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  branch branches;
  device_names TEXT[] := ARRAY[
    'PS5 #1','PS5 #2','PS5 #3','PS5 #4','PS5 #5',
    'PS4 #6','PS4 #7','PS4 #8','PS4 #9','PS4 #10'
  ];
  d    TEXT;
  i    INTEGER := 1;
  cats JSONB[] := ARRAY[
    '{"name":"مشروبات","icon":"🥤"}'::JSONB,
    '{"name":"سناكس","icon":"🍿"}'::JSONB,
    '{"name":"أخرى","icon":"📦"}'::JSONB
  ];
  cat  JSONB;
  cat_id INTEGER;
BEGIN
  -- 1. Create branch
  INSERT INTO branches(name, owner_id, address, phone, plan, plan_expires_at, onboarding_done)
  VALUES(p_branch_name, p_user_id, p_address, p_phone, 'trial', NOW() + INTERVAL '14 days', TRUE)
  RETURNING * INTO branch;

  -- 2. Link profile to branch + set admin
  UPDATE profiles SET branch_id = branch.id, role = 'admin'
  WHERE id = p_user_id;

  -- 3. Create 10 devices
  FOREACH d IN ARRAY device_names LOOP
    INSERT INTO devices(name, type, price_single, price_multi, branch_id)
    VALUES(
      d,
      CASE WHEN i <= 5 THEN 'PS5' ELSE 'PS4' END,
      CASE WHEN i <= 5 THEN 25   ELSE 15   END,
      CASE WHEN i <= 5 THEN 20   ELSE 12   END,
      branch.id
    );
    i := i + 1;
  END LOOP;

  -- 4. Default expense items (amount=0, user edits later)
  INSERT INTO expenses(branch_id, name, amount, sort_order) VALUES
    (branch.id, 'إيجار المحل',       0, 1),
    (branch.id, 'بضاعة / مستلزمات', 0, 2),
    (branch.id, 'مرتبات',            0, 3),
    (branch.id, 'كهرباء',            0, 4),
    (branch.id, 'إنترنت',            0, 5),
    (branch.id, 'جمعية',             0, 6),
    (branch.id, 'صيانة',             0, 7);

  -- 5. Default inventory categories
  FOREACH cat IN ARRAY cats LOOP
    INSERT INTO inventory_categories(name, icon, branch_id)
    VALUES(cat->>'name', cat->>'icon', branch.id)
    RETURNING id INTO cat_id;
  END LOOP;

  RETURN branch;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. START SESSION (server-side, branch-safe)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION start_session(
  p_device_id   INTEGER,
  p_customer_id UUID    DEFAULT NULL,
  p_mode        TEXT    DEFAULT 'single',
  p_hourly_rate NUMERIC DEFAULT NULL,
  p_game_played TEXT    DEFAULT NULL
) RETURNS sessions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess      sessions;
  my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();

  -- Lock device row
  PERFORM id FROM devices
  WHERE id = p_device_id AND branch_id = my_branch FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_UNAVAILABLE: الجهاز غير موجود في فرعك';
  END IF;

  -- Check no active session
  IF EXISTS(SELECT 1 FROM sessions WHERE device_id = p_device_id AND branch_id = my_branch AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION: يوجد جلسة نشطة بالفعل على هذا الجهاز';
  END IF;

  INSERT INTO sessions(device_id, customer_id, mode, game_played, started_at, staff_id, branch_id)
  VALUES(p_device_id, p_customer_id, p_mode, p_game_played, NOW(), auth.uid(), my_branch)
  RETURNING * INTO sess;

  RETURN sess;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. STOP SESSION (server-side pricing)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION stop_session(p_session_id UUID)
RETURNS sessions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess  sessions;
  dev   devices;
  dur_h NUMERIC;
  rate  NUMERIC;
BEGIN
  SELECT * INTO sess FROM sessions
  WHERE id = p_session_id AND branch_id = get_my_branch_id() AND ended_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: الجلسة غير موجودة أو منتهية';
  END IF;

  SELECT * INTO dev FROM devices WHERE id = sess.device_id;

  dur_h := GREATEST(
    EXTRACT(EPOCH FROM (NOW() - sess.started_at)) / 3600.0,
    1.0/60.0  -- minimum 1 minute
  );

  rate := CASE WHEN sess.mode = 'single' THEN dev.price_single ELSE dev.price_multi END;

  UPDATE sessions SET
    ended_at = NOW(),
    cost     = ROUND(dur_h * COALESCE(rate, 0), 2)
  WHERE id = p_session_id
  RETURNING * INTO sess;

  -- Award loyalty points (1 pt per EGP)
  IF sess.customer_id IS NOT NULL AND sess.cost > 0 THEN
    UPDATE customers SET points = points + FLOOR(sess.cost)
    WHERE id = sess.customer_id;
  END IF;

  RETURN sess;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. UPDATE EXPENSE
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id INTEGER,
  p_amount     NUMERIC,
  p_name       TEXT DEFAULT NULL
) RETURNS expenses LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE exp expenses;
BEGIN
  UPDATE expenses SET
    amount     = p_amount,
    name       = COALESCE(p_name, name),
    updated_at = NOW()
  WHERE id = p_expense_id AND branch_id = get_my_branch_id()
  RETURNING * INTO exp;
  IF NOT FOUND THEN RAISE EXCEPTION 'المصروف غير موجود'; END IF;
  RETURN exp;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. GHOST SESSION REAPER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reap_ghost_sessions()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE reaped INTEGER;
BEGIN
  WITH ghost AS (
    UPDATE sessions SET
      ended_at = started_at + INTERVAL '12 hours',
      cost     = 0,
      notes    = COALESCE(notes||' | ','') ||
                 '[AUTO-CLOSED ghost session at '||NOW()::TEXT||']'
    WHERE ended_at IS NULL AND started_at < NOW() - INTERVAL '12 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO reaped FROM ghost;
  RETURN reaped;
END;
$$;
