# Cutty — Setup Guide

## 1. Create a Sanity Project

Go to https://sanity.io/manage and create a new project. Note your **Project ID**.

## 2. Configure Environment Variables

**Studio** (`apps/studio/.env`):
```
SANITY_STUDIO_PROJECT_ID=your_project_id
SANITY_STUDIO_DATASET=production
```

**Mobile** (`apps/mobile/.env`):
```
EXPO_PUBLIC_SANITY_PROJECT_ID=your_project_id
EXPO_PUBLIC_SANITY_DATASET=production
EXPO_PUBLIC_SANITY_TOKEN=your_sanity_write_token
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_key
```

**Admin** (`apps/admin/.env.local`):
```
NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=your_sanity_write_token
NEXT_PUBLIC_ADMIN_PASSWORD=your_secure_password
```

To get a Sanity write token: go to sanity.io/manage → your project → API → Tokens → Add Editor token.

## 3. Install Dependencies

```bash
# From root
npm install

# Or per app
cd apps/studio && npm install
cd apps/mobile && npm install
cd apps/admin && npm install
```

## 4. Run the Apps

```bash
# Sanity Studio (http://localhost:3333)
cd apps/studio && npm run dev

# Admin Dashboard (http://localhost:3001)
cd apps/admin && npm run dev

# Mobile App
cd apps/mobile && npm start
```

## 5. Seed Initial Data via Studio

Open the Studio and add:
1. **Settings** — shop name, hours, Paystack key
2. **Barbers** — at least one barber profile
3. **Services** — haircut services with prices
4. **Categories** — product categories
5. **Products** — shop products

## Architecture

```
cutty/
├── apps/
│   ├── mobile/        Expo + NativeWind (customer app)
│   ├── admin/         Next.js 15 (admin dashboard)
│   └── studio/        Sanity Studio (CMS / backend)
└── packages/
    └── types/         Shared TypeScript types
```

## Feature Overview

| Feature | Mobile | Admin |
|---------|--------|-------|
| Booking flow (4-step wizard) | ✅ | ✅ View/manage |
| E-commerce shop | ✅ | ✅ View/manage |
| Loyalty points & tiers | ✅ Earn/redeem | ✅ Overview |
| Wallet (top-up, pay) | ✅ | ✅ Transactions |
| Discount codes | ✅ Apply | ✅ Manage |
| Customer profiles | ✅ | ✅ Full list |
| Payment management | — | ✅ All txns |

## Production Checklist

- [ ] Replace demo auth with Firebase/Supabase/Clerk
- [ ] Wire up real Paystack payment in wallet top-up and checkout
- [ ] Deploy Studio to `sanity.io/manage` (`npm run deploy`)
- [ ] Deploy Admin to Vercel
- [ ] Submit mobile app to App Store / Play Store via EAS Build
- [ ] Set CORS origins in Sanity for production domains
- [ ] Add push notifications (Expo Notifications) for booking confirmations
