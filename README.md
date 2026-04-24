# 🎮 PS Lounge Manager — SaaS v4

نظام إدارة متكامل لقاعات البلايستيشن — Cloud-Native · Multi-Tenant · Mobile-First

---

## ⚡ إعداد سريع

### 1. متطلبات
- Node.js 18+
- حساب Supabase (مجاني)
- حساب Vercel (مجاني)

### 2. إعداد Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ مشروع جديد
2. من **SQL Editor**، شغّل الـ migrations **بالترتيب**:

```
supabase/migrations/001_initial_schema.sql      ← الجداول الأساسية
supabase/migrations/002_inventory_shifts_pos.sql ← المخزن والشيفتات
supabase/migrations/003_shift_pin_loyalty.sql   ← PIN والولاء والتحليلات
supabase/migrations/004_internet_cards.sql      ← كروت الإنترنت
supabase/migrations/005_functions.sql           ← الدوال الأساسية
```

> ⚠️ **مهم:** شغّلهم واحد واحد بالترتيب — لا تجمعهم كلهم مرة واحدة

3. من **Authentication → Settings**:
   - قم بتفعيل **Email confirmations** أو إلغاؤه حسب احتياجك
   - أضف URL موقعك في **Redirect URLs**:
     ```
     https://your-site.vercel.app/**
     ```

### 3. تثبيت المشروع

```bash
git clone <your-repo>
cd ps-lounge-saas-v4

npm install

cp .env.example .env.local
# افتح .env.local وضع قيمتين:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

npm run dev
```

### 4. رفع على Vercel

```bash
npm run build          # تأكد من البناء بدون أخطاء
npm i -g vercel
vercel --prod
```

في Vercel Dashboard → Settings → Environment Variables أضف:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 🚀 أول مرة تدخل

1. **سجّل حساب جديد** من صفحة تسجيل الدخول
2. **Onboarding:** أدخل اسم المحل والعنوان
3. النظام هينشئ تلقائياً: فرعك + 10 أجهزة + مصاريف افتراضية
4. **تجربة مجانية 14 يوم** — لا يلزم كارت بنكي

---

## 🏗️ الميزات

| الميزة | الوصف |
|--------|-------|
| 🎮 الأجهزة | 10 PS4/PS5 · Real-time · Server-side timing |
| 📋 الجلسات | تتبع كامل · تكلفة محسوبة server-side |
| 🛒 البضاعة | POS كاشير · مخزن · تنبيه نقص |
| 📶 كروت النت | WE/فودافون/اتصالات/أورانج · FIFO |
| ⏰ الشيفتات | PIN أمان · تسوية الكاش |
| 👥 العملاء | CRM · نظام ولاء · مكافآت |
| 💰 المصاريف | قابلة للتعديل · P&L تلقائي |
| 📊 التحليلات | إيرادات · أكثر الألعاب · Top عملاء |
| ⚙️ الإعدادات | بيانات المحل · كلمة المرور |
| 🔐 Auth | تسجيل · دخول · نسيت كلمة المرور |

---

## 🔒 الأمان

- **RLS** على كل الجداول — عزل كامل بين المحلات
- **Server-side timing** — PostgreSQL NOW() فقط
- **Branch isolation** — كل محل يشوف بياناته فقط
- **RBAC** — Admin/Staff roles
- **Double-click guard** — منع تكرار الجلسات

---

## 📁 هيكل المشروع

```
src/
├── App.tsx                    ← Routing + Auth guards
├── main.tsx                   ← Providers setup
├── components/
│   ├── TrialGuard.tsx         ← Trial expiry enforcement
│   ├── alerts/AlertsBell.tsx
│   └── devices/
│       ├── DeviceCard.tsx
│       └── StartSessionModal.tsx
├── hooks/
│   ├── useDevices.ts
│   └── useDashboard.ts
├── lib/
│   ├── auth-context.tsx       ← Auth + signUp + resetPassword
│   ├── branch-context.tsx     ← Branch isolation
│   ├── supabase.ts
│   ├── sessions.ts
│   ├── shifts.ts
│   ├── inventory.ts
│   ├── cards.ts
│   ├── analytics.ts
│   └── errors.ts
├── pages/                     ← All 10 pages
└── types/index.ts             ← All TypeScript types
```

---

## 🛠️ Tech Stack

- **React 18** + TypeScript + Vite
- **Supabase** (PostgreSQL + RLS + Realtime + Auth)
- **Tailwind CSS** — Mobile-first
- **Recharts** — Analytics charts
- **Sonner** — Toast notifications
- **date-fns** — Date formatting

---

*PS Lounge Manager v4 · Built with Supabase + React*
