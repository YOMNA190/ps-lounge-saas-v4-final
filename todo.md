# PS Lounge SaaS v4 — Security Hardening Implementation

## Phase 1: Database Layer (SQL Migration)
- [x] Create SQL migration file with all security constraints
  - [x] Unique index on sessions (device_id, status) to prevent duplicate active sessions
  - [x] CHECK constraints for positive prices, durations, loyalty points
  - [x] Performance indexes on sessions (device_id, status, start_time, customer_id)
  - [x] Audit log table with append-only RLS policies
  - [x] Audit trigger on sessions table
  - [x] Ghost session reaper function (auto-close after 12 hours)
  - [x] Server-side start_session function with row locking
  - [x] Server-side stop_session function with server-calculated pricing

## Phase 2: Error Handling & Utilities
- [x] Create src/lib/errors.ts with error sanitization
  - [x] DB_ERROR_CODES mapping for custom PostgreSQL errors
  - [x] POSTGRES_ERROR_CODES mapping for standard PostgreSQL errors
  - [x] sanitizeError() function to convert errors to Arabic messages
  - [x] isRetryableError() helper function
  - [x] AppError interface definition
- [x] Create client/src/lib/errors.ts with matching error handling
- [x] Create client/src/lib/auth.ts with role-based access control helpers

## Phase 3: Session Operations
- [x] Update src/lib/sessions.ts
  - [x] Replace startSession to use RPC with server-side function
  - [x] Replace stopSession to use RPC with server-side function
  - [x] Add calculateSessionPrice utility for client-side display
  - [x] Remove any direct .update() or .insert() calls on sessions table

## Phase 4: Realtime & Hooks
- [x] Update src/hooks/useDevices.ts
  - [x] Add branch_id filter to Realtime subscription
  - [x] Add isGhostRisk() helper to detect sessions > 6 hours
  - [x] Export isGhostRisk for use in components

## Phase 5: React Components
- [x] Update src/components/devices/DeviceCard.tsx
  - [x] Add isProcessing state for double-click guard
  - [x] Wrap session handlers with processing guard
  - [x] Disable buttons while processing
  - [x] Add ghost session warning badge (> 6 hours)
  - [x] Use sanitizeError for error messages
- [x] Update src/components/devices/StartSessionModal.tsx
  - [x] Remove client-side price calculation from payload
  - [x] Keep price display for UX but don't send to server

## Phase 6: Authentication & Authorization
- [x] Update src/lib/auth.ts
  - [x] Add requireAdmin() type guard function
  - [x] Add requireStaff() type guard function
  - [x] Add canAccessFinancialData() type guard function
  - [x] Add canManageSessions() type guard function
  - [x] Add canViewAuditLogs() type guard function

## Phase 7: Testing
- [x] Create src/lib/__tests__/pricing.test.ts
  - [x] Test minimum 1-minute charge
  - [x] Test ceiling rounding on partial minutes
  - [x] Test exact hour calculations
  - [x] Test 30-minute calculations
  - [x] Test negative duration handling
  - [x] Test zero hourly rate handling
  - [x] Test high-value sessions
  - [x] Test floating point precision
- [x] Vitest already in package.json devDependencies
- [x] Add test:watch script to package.json

## Phase 8: Verification & Deployment
- [ ] Apply SQL migration to Supabase database (migration file ready at drizzle/migrations/001_security_hardening.sql)
- [ ] Verify RLS enabled on all tables (audit_log table with append-only RLS)
- [ ] Verify unique index created (unique index on sessions(device_id, status))
- [ ] Test start_session RPC call (implemented with server-side locking)
- [ ] Test stop_session RPC call (implemented with server-calculated pricing)
- [ ] Test DeviceCard double-click guard (isProcessing state prevents duplicate clicks)
- [ ] Test ghost warning appearance (isGhostRisk helper detects sessions > 6 hours)
- [x] Run pricing unit tests: `pnpm test` (27 tests PASSED in client/src/lib/__tests__/pricing.test.ts)
- [x] Resolve TypeScript compilation errors (fixed divideColor errors, supabase env types)
- [x] Create checkpoint (saved at manus-webdev://95a2aaa1)
- [x] Create UI Screenshots Guide (UI_SCREENSHOTS_GUIDE.md with 5 mockups)

## Deployment Instructions

### Step 1: Apply SQL Migration
```sql
-- Copy contents of drizzle/migrations/001_security_hardening.sql
-- Execute in Supabase SQL Editor
```

### Step 2: Verify Database Changes
- [ ] Check unique index on sessions table
- [ ] Verify audit_log table exists
- [ ] Test start_session RPC function
- [ ] Test stop_session RPC function

### Step 3: Deploy to Production
- [ ] Run `pnpm build`
- [ ] Deploy to Supabase/Vercel
- [ ] Run smoke tests

## Notes
- All error messages must be in Arabic
- Multi-tenancy: branch_id filtering required on Realtime subscriptions
- Financial data: server-side calculations are authoritative
- Client-side pricing is display-only, never sent to server
- Row-level locking prevents race conditions on start/stop
- Audit log is append-only for forensic trail
- All TypeScript errors resolved (0 TS errors)
- 27 unit tests passing for pricing logic
- UI mockups created for all customer-facing interfaces
