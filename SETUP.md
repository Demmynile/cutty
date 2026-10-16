# Cutty — Setup Guide

## 1. Create a Sanity Project

Go to https://sanity.io/manage and create a new project. Note your **Project ID**.

## 2. Create a Clerk Application (customer & Cutty Pro sign-in)

Customers and Cutty Pro stylists sign in with [Clerk](https://dashboard.clerk.com). The **admin dashboard does not use Clerk**: admins keep their own email + password + authenticator-code login.

1. Create an application in the Clerk dashboard.
2. **User & authentication → Email**: enable *Email address* (sign-up + sign-in), *Password*, and *Verify at sign-up* with **Email verification code**. Enable *Email code* under the sign-in options too (Clerk uses it for new-device checks and password resets).
3. **SSO connections**: enable **Google**. The shared dev credentials work for development; add your own Google OAuth client before production.
4. **Native applications** (Configure → Native applications): enable the Native API, and add the redirect URL `cutty://sso-callback` to the allowlist (in Expo Go the app also uses an `exp://…/--/sso-callback` URL, which is allowed in development instances).
5. Copy the **Publishable key** (mobile) and **Secret key** (admin + realtime) from **API keys**.

Existing customers and stylists don't need anything migrated: the first time someone signs in with Clerk (Google, or an email sign-up with the same address), the API links their old account by verified email, so wallet, points and history carry over. Their old password hash is removed when the account is linked.

## 3. Configure Environment Variables

**Studio** (`apps/studio/.env`):
```
SANITY_STUDIO_PROJECT_ID=your_project_id
SANITY_STUDIO_DATASET=production
```

**Mobile** (`apps/mobile/.env`, see `.env.example`): Sanity project id and dataset (image URLs only — the app holds no Sanity token), `EXPO_PUBLIC_API_URL` (the admin server), `EXPO_PUBLIC_REALTIME_URL` (the chat server) and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

**Admin** (`apps/admin/.env`, see `.env.example`): Sanity token, `AUTH_JWT_SECRET` (admin dashboard sessions only), `CLERK_SECRET_KEY`, Paystack secret key, AI Gateway key, and `REALTIME_INTERNAL_URL` + `REALTIME_INTERNAL_SECRET` for chat.

**Realtime** (`apps/realtime/.env`, see `.env.example`): the same `CLERK_SECRET_KEY` and Sanity token as admin, plus the shared `REALTIME_INTERNAL_SECRET` and `ADMIN_INTERNAL_URL` (e.g. `http://localhost:3002`), which lets Cutty AI answer customers while a stylist is offline (stylists turn this on under Pro → Your profile → Away assistant).

To get a Sanity write token: go to sanity.io/manage → your project → API → Tokens → Add Editor token.

## 4. Install Dependencies

```bash
# From root
npm install

# Or per app
cd apps/studio && npm install
cd apps/mobile && npm install
cd apps/admin && npm install
```

## 5. Run the Apps

```bash
# Sanity Studio (http://localhost:3333)
cd apps/studio && npm run dev

# Admin Dashboard (http://localhost:3001)
cd apps/admin && npm run dev

# Realtime chat server (http://localhost:4000)
npm run realtime

# Waitlist / marketing site (http://localhost:3004), posts sign-ups to the admin API
npm run web

# Mobile App
cd apps/mobile && npm start
```

The realtime server must run on an always-on host in production (Railway, Fly.io, Render): Vercel can't hold WebSocket connections open.

## 6. Seed Initial Data via Studio

Open the Studio and add:
1. **Settings** — shop name, hours, Paystack key
2. **Categories** — product categories
3. **Products** — shop products

There are no shop services or in-house barbers: customers book Cutty Pro stylists (below), found on the map or in search.

## Cutty Pro (stylist accounts)

Barbers and braiders sign up in the mobile app ("Join Cutty Pro" on the welcome screen). Their flow:

1. **Sign up** → account is `pending`. They add a photo, bio, skills, styles, weekly hours, work location and an appointment price and length (customers can't book them until the price is set).
2. **Owner approves the profile** in the admin dashboard (Stylists page). This creates their bookable `barber` record, so customers can find, message and book them.
3. **Shop request** → the stylist submits a shop name and payout bank account (checked with Paystack).
4. **Owner approves the shop** → Cutty creates a Paystack subaccount with the commission from Settings → Cutty Pro Marketplace. Card payments for their products then split automatically.

Stylists run their own chair (confirm, start, complete bookings), confirm sales, see customers with visits and purchases, and award bonus loyalty points within the per-award and monthly limits in Settings. Chat between customers and stylists is live over Socket.IO (`apps/realtime`); stylists get AI-suggested replies and customers can ask Cutty AI inside a thread. Customers' AI searches drive "Recommended for you" on Home.

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

- [x] Customer & stylist sign-in with Clerk (email + Google); admin keeps its own login
- [ ] Clerk: switch to a production instance and your own Google OAuth credentials
- [ ] Wire up real Paystack payment in wallet top-up and checkout
- [ ] Deploy Studio to `sanity.io/manage` (`npm run deploy`)
- [ ] Deploy Admin to Vercel
- [ ] Submit mobile app to App Store / Play Store via EAS Build
- [ ] Set CORS origins in Sanity for production domains
- [ ] Add push notifications (Expo Notifications) for booking confirmations
