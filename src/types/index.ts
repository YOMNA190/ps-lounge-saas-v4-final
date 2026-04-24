// ============================================================
// Global TypeScript Types — PlayStation Lounge Manager SaaS
// ============================================================

export type UserRole = 'admin' | 'staff';
export type DeviceType = 'PS4' | 'PS5';
export type SessionMode = 'single' | 'multi';

export interface Profile {
  branch_id: string | null;
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Device {
  id: number;
  name: string;
  type: DeviceType;
  is_active: boolean;
  price_single: number;
  price_multi: number;
  created_at: string;
  // Joined from active sessions
  active_session?: Session | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  points: number;
  created_at: string;
}

export interface Session {
  id: string;
  device_id: number;
  customer_id: string | null;
  mode: SessionMode;
  game_played: string | null;
  started_at: string;
  ended_at: string | null;
  cost: number | null;
  staff_id: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  device?: Device;
  customer?: Customer;
  staff?: Profile;
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

// Analytics
export interface DailyDeviceRevenue {
  device_id: number;
  device_name: string;
  device_type: DeviceType;
  day: string;
  session_count: number;
  total_revenue: number;
  avg_session_cost: number;
  total_hours: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  phone: string | null;
  points: number;
  session_count: number;
  total_hours: number;
  total_spent: number;
  month: string;
}

export interface TopGame {
  game_played: string;
  play_count: number;
  total_hours: number;
}

// Dashboard summary (admin only)
export interface DashboardSummary {
  gross_revenue: number;
  total_expenses: number;
  net_profit: number;
  active_sessions: number;
  total_sessions_today: number;
  revenue_today: number;
}

export interface StartSessionPayload {
  device_id: number;
  mode: SessionMode;
  game_played?: string;
  customer_id?: string;
  notes?: string;
}

// Fixed expenses constants
export const FIXED_EXPENSES = [
  { name: 'إيجار المحل',       amount: 21800 },
  { name: 'بضاعة / مستلزمات', amount: 17000 },
  { name: 'صيانة',             amount:  2200 },
  { name: 'إنترنت',            amount:  1500 },
  { name: 'جمعية',             amount:  4000 },
  { name: 'مرتبات',            amount:  3500 },
  { name: 'كهرباء',            amount:  4000 },
] as const;

export const TOTAL_FIXED_EXPENSES = FIXED_EXPENSES.reduce((sum, e) => sum + e.amount, 0); // 54,000

export const POPULAR_GAMES = [
  'FIFA 26', 'FC 25', 'eFootball / PES', 'Call of Duty',
  'GTA V', 'Red Dead Redemption 2', 'Mortal Kombat 1',
  'WWE 2K24', 'Tekken 8', 'Fortnite', 'Apex Legends',
  'God of War', 'Spider-Man 2', 'NBA 2K25', 'أخرى',
] as const;

// ─────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────
export interface InventoryCategory {
  id: number; name: string; icon: string; created_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  barcode: string | null;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  min_stock_qty: number;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: InventoryCategory;
}

export interface ProductProfitSummary extends Product {
  category_name: string;
  margin_per_unit: number;
  margin_pct: number;
  total_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
}

// ─────────────────────────────────────────────────────────────
// POS / SALES
// ─────────────────────────────────────────────────────────────
export interface SaleItem {
  id?: number;
  product_id: number;
  qty: number;
  unit_price: number;
  unit_cost: number;
  subtotal?: number;
  product?: Product;
}

export interface Sale {
  id: string;
  session_id: string | null;
  customer_id: string | null;
  staff_id: string | null;
  total: number;
  notes: string | null;
  created_at: string;
  items?: SaleItem[];
  customer?: Customer;
}

// ─────────────────────────────────────────────────────────────
// SHIFTS
// ─────────────────────────────────────────────────────────────
export interface Shift {
  id: string;
  staff_id: string;
  started_at: string;
  ended_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  sessions_revenue: number;
  sales_revenue: number;
  total_revenue: number;
  notes: string | null;
  created_at: string;
  staff?: Profile;
}

// ─────────────────────────────────────────────────────────────
// PACKAGES
// ─────────────────────────────────────────────────────────────
export interface Package {
  id: number;
  name: string;
  description: string | null;
  device_type: string | null;
  mode: 'single' | 'multi' | 'both';
  duration_mins: number;
  price: number;
  is_active: boolean;
  valid_days: string[];
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// RESERVATIONS
// ─────────────────────────────────────────────────────────────
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Reservation {
  id: string;
  device_id: number;
  customer_id: string | null;
  package_id: number | null;
  reserved_at: string;
  duration_mins: number;
  mode: SessionMode;
  status: ReservationStatus;
  notes: string | null;
  created_at: string;
  device?: Device;
  customer?: Customer;
  package?: Package;
}

// ─────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────
export interface Alert {
  id: number;
  type: 'low_stock' | 'long_session' | 'shift_reminder';
  title: string;
  message: string;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// v4 — Customer Monthly Spending
// ─────────────────────────────────────────────────────────────
export interface CustomerMonthlySpending {
  id: string
  name: string
  phone: string | null
  points: number
  monthly_spend_limit: number
  reward_earned_months: string[]
  current_month: string
  sessions_spend: number
  products_spend: number
  total_spend: number
  limit_remaining: number
  limit_exceeded: boolean
  reward_claimed_this_month: boolean
  total_hours_this_month: number
}

// v4 — Enhanced Shift
export interface ShiftV4 extends Shift {
  pin_verified: boolean
  cash_taken: number
  cash_left: number
}

// ─────────────────────────────────────────────────────────────
// INTERNET CARDS
// ─────────────────────────────────────────────────────────────
export type CardStatus = 'available' | 'sold' | 'void'
export type CardPaymentMethod = 'vodafone_cash' | 'instapay' | 'cash'

export interface CardType {
  id: number
  name: string
  provider: string       // 'WE' | 'فودافون' | 'اتصالات' | 'أورانج'
  data_amount: string    // '10 جيجا' | '20 جيجا'
  validity_days: number
  cost_price: number
  sell_price: number
  low_stock_alert: number
  is_active: boolean
  created_at: string
}

export interface CardInventorySummary extends CardType {
  margin: number
  available_count: number
  sold_count: number
  void_count: number
  is_low_stock: boolean
}

export interface Card {
  id: string
  type_id: number
  serial_code: string | null
  status: CardStatus
  sold_at: string | null
  sold_to: string | null
  sold_by: string | null
  sale_price: number | null
  payment_method: CardPaymentMethod | null
  payment_ref: string | null
  notes: string | null
  created_at: string
  card_type?: CardType
  customer?: Customer
}

export interface CardSaleReport {
  sale_date: string
  provider: string
  card_name: string
  data_amount: string
  qty_sold: number
  total_revenue: number
  total_cost: number
  total_profit: number
  payment_method: CardPaymentMethod
}

export const CARD_PROVIDERS = ['WE', 'فودافون', 'اتصالات', 'أورانج'] as const
export const PAYMENT_METHODS: Record<CardPaymentMethod, string> = {
  vodafone_cash: '📱 فودافون كاش',
  instapay:      '💳 إنستاباي',
  cash:          '💵 كاش',
}

// ─────────────────────────────────────────────────────────────
// MULTI-TENANCY
// ─────────────────────────────────────────────────────────────
export type BranchPlan = 'trial' | 'basic' | 'pro'

export interface Branch {
  id: string
  name: string
  owner_id: string
  address: string | null
  phone: string | null
  plan: BranchPlan
  plan_expires_at: string | null
  is_active: boolean
  onboarding_done: boolean
  currency: string
  timezone: string
  loyalty_limit: number
  created_at: string
}

// Update Profile to include branch_id
// (extend existing interface)
export interface ProfileWithBranch extends Profile {
  branch_id: string | null
}
