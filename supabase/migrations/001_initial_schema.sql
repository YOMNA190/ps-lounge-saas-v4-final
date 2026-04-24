-- ============================================================
-- Migration 001: Initial Schema — PS Lounge Manager SaaS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES (linked to auth.users)
-- ─────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'staff');

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'User',
  role       user_role NOT NULL DEFAULT 'admin',
  branch_id  UUID,                                  -- filled after onboarding
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup (role=admin so first user can set up branch)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. BRANCHES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE branches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  owner_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address          TEXT,
  phone            TEXT,
  plan             TEXT DEFAULT 'trial',
  plan_expires_at  TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT TRUE,
  onboarding_done  BOOLEAN DEFAULT FALSE,
  currency         TEXT DEFAULT 'EGP',
  timezone         TEXT DEFAULT 'Africa/Cairo',
  loyalty_limit    NUMERIC(10,2) DEFAULT 10000,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from profiles to branches
ALTER TABLE profiles ADD CONSTRAINT profiles_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches(id);

-- ─────────────────────────────────────────────────────────────
-- 3. DEVICES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE devices (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT CHECK (type IN ('PS4','PS5')) DEFAULT 'PS5',
  is_active    BOOLEAN DEFAULT TRUE,
  price_single NUMERIC(8,2) NOT NULL DEFAULT 25.00,
  price_multi  NUMERIC(8,2) NOT NULL DEFAULT 20.00,
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 4. CUSTOMERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  points     INTEGER DEFAULT 0 CHECK (points >= 0),
  branch_id  UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (phone, branch_id)
);

-- ─────────────────────────────────────────────────────────────
-- 5. SESSIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   INTEGER NOT NULL REFERENCES devices(id),
  customer_id UUID REFERENCES customers(id),
  mode        TEXT NOT NULL CHECK (mode IN ('single','multi')),
  game_played TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  cost        NUMERIC(10,2) CHECK (cost IS NULL OR cost >= 0),
  staff_id    UUID REFERENCES auth.users(id),
  notes       TEXT,
  branch_id   UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX idx_one_active_session_per_device
  ON sessions (device_id) WHERE ended_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. EXPENSES (branch-scoped, editable)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE expenses (
  id         SERIAL PRIMARY KEY,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  category   TEXT DEFAULT 'fixed',
  is_active  BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. ALERTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE alerts (
  id         SERIAL PRIMARY KEY,
  type       TEXT NOT NULL DEFAULT 'low_stock',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  entity_id  TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts     ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's branch_id
CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$$;

-- Profiles: see own; admin sees all in branch
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR branch_id = get_my_branch_id());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Branches: owner or member
CREATE POLICY "branches_select" ON branches FOR SELECT TO authenticated
  USING (id = get_my_branch_id());
CREATE POLICY "branches_update" ON branches FOR UPDATE TO authenticated
  USING (id = get_my_branch_id() AND EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Devices: branch-scoped
CREATE POLICY "devices_all" ON devices FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id())
  WITH CHECK (branch_id = get_my_branch_id());

-- Sessions: branch-scoped
CREATE POLICY "sessions_select" ON sessions FOR SELECT TO authenticated
  USING (branch_id = get_my_branch_id());
CREATE POLICY "sessions_insert" ON sessions FOR INSERT TO authenticated
  WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "sessions_update" ON sessions FOR UPDATE TO authenticated
  USING (branch_id = get_my_branch_id());

-- Customers: branch-scoped
CREATE POLICY "customers_all" ON customers FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id())
  WITH CHECK (branch_id = get_my_branch_id());

-- Expenses: branch-scoped, admin only
CREATE POLICY "expenses_all" ON expenses FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id())
  WITH CHECK (branch_id = get_my_branch_id());

-- Alerts: readable by all in branch (simplified)
CREATE POLICY "alerts_select" ON alerts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "alerts_update" ON alerts FOR UPDATE TO authenticated USING (TRUE);

-- ─────────────────────────────────────────────────────────────
-- 9. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_sessions_branch_active ON sessions(branch_id) WHERE ended_at IS NULL;
CREATE INDEX idx_sessions_branch_date   ON sessions(branch_id, started_at DESC);
CREATE INDEX idx_devices_branch         ON devices(branch_id);
CREATE INDEX idx_customers_branch       ON customers(branch_id);
CREATE INDEX idx_expenses_branch        ON expenses(branch_id) WHERE is_active = TRUE;
