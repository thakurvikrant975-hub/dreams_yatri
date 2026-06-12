# Dreams Yatri — Project Documentation

This is the top-level reference for the Dreams Yatri codebase: what it is, how it's
structured, how auth/RBAC work, the data model, and how to run it locally. For the
booking & payment flow specifically, see [`docs/booking/booking-system.md`](./booking/booking-system.md)
(and the per-phase logs alongside it) — that subsystem is documented in depth there
and is only summarized here.

---

## 1. What this is

Dreams Yatri is a travel-booking platform built as a single Next.js (App Router) app
with two halves that share one codebase and one database:

- **Public website** (`app/(website)`) — destinations, hotels, activities, travel
  packages, blog, package quoting/checkout, and a customer profile/bookings area.
- **Admin/Ops dashboard** (`app/(dashboard)`) — internal staff panel for managing
  content (hotels, packages, activities, regions, blogs), sales/CRM (queries,
  follow-ups, package builder), cab operations, finance (transactions, refunds,
  settlements), and team/role administration.

Both halves run from the same `next dev` / `next build` process; they're split by
route groups and by **two independent NextAuth instances** (see §3).

---

## 2. Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, Server Components + Server Actions) |
| Language | TypeScript, React 19 |
| Database | PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg`) |
| Auth | NextAuth v5 — **two separate instances** (public site + dashboard) |
| Styling/UI | Tailwind CSS, shadcn/Radix UI primitives, `lucide-react` + `@phosphor-icons/react` |
| Forms | `react-hook-form` + `zod` |
| Data fetching (client) | `@tanstack/react-query` |
| Tables | `@tanstack/react-table` |
| Rich text | Tiptap (blog editor) |
| Maps | Leaflet / `react-leaflet`, Mapbox token for geocoding |
| Search | Meilisearch (self-hosted via `docker-compose.yml`) |
| File storage | Cloudflare R2 (S3-compatible, via `@aws-sdk/*`) |
| Payments | Razorpay and PayU (pluggable provider registry) |
| Email | Resend |
| SMS / WhatsApp / OTP | MSG91 |
| Caching / locks | Redis (`ioredis`, `redlock`) |
| State (client) | Zustand |

---

## 3. Authentication — two independent systems

### 3.1 Public site auth (`app/lib/auth.ts`)
- NextAuth instance exported as `{ handlers, auth, signIn, signOut }`.
- Providers: **Google OAuth** and a **Credentials** provider that supports phone +
  OTP (via MSG91) and "magic session" tokens (passwordless link/email flow).
- JWT session, 6-month lifetime.
- Backs the customer-facing `/profile`, `/bookings/*`, blog authoring
  (`/blogs/write`, `/blogs/my-blogs`), and checkout.

### 3.2 Dashboard auth (`app/lib/auth-dashboard.ts`)
- Separate NextAuth instance exported as `{ dashboardAuth, dashboardSignIn,
  dashboardSignOut, dashboardHandlers }`.
- Single **Credentials** provider: email + password (bcrypt), looked up against
  `TeamMember`.
- **Custom session cookie** `dy.dashboard.session-token`, `path: /dashboard`,
  `sameSite: strict` — deliberately namespaced so it never collides with the public
  site's session cookie. JWT session, 8-hour lifetime.
- Sign-in/error page: `/dashboard/login`.

### 3.3 Middleware (`middleware.ts`)
For any `/dashboard/*` request:
- Reads the `dy.dashboard.session-token` JWT.
- Redirects logged-in staff away from `/dashboard/login` → `/dashboard`.
- Redirects unauthenticated requests to `/dashboard/login`.
- Forwards the request path as an `x-pathname` header so Server Components (the
  dashboard layout) can do per-role page-access enforcement (see §4.3).

---

## 4. Authorization / RBAC (dashboard)

Staff access is governed by `TeamRole`, referenced by `TeamMember.teamRoleId`.

```
TeamRole {
  permissions: Json   // data/feature permission grants — see field-registry.ts
  pageAccess:  Json    // string[] of allowed sidebar hrefs ([] = unrestricted)
}
```

Managed under **Dashboard → Team → Roles and Permissions**
(`app/(dashboard)/dashboard/(main)/roles-and-permissions/`):

- `Rolestable.tsx` / `Roledialog.tsx` — list/create/edit roles.
- `PermissionPage.tsx` / `Permissionbuilder.tsx` — **Data Permissions** tab: per-entity
  CRUD-style permission grants, defined in `lib/rbac/permissions.ts` and
  `lib/rbac/field-registry.ts`.
- `SidebarAccessEditor.tsx` — **Sidebar Access** tab: a "Restrict Sidebar
  Navigation" toggle plus checkboxes (grouped exactly like the sidebar, see
  `NAV_GROUPS` below) that populate `pageAccess`.

### 4.1 Sidebar navigation (`lib/rbac/nav-items.ts`)
`NAV_GROUPS` is the single source of truth for the dashboard sidebar, grouped as:

| Group | Example items |
|---|---|
| Overview | Dashboard, Analytics |
| Content Management | Regions, Destinations, Categories, Policies, Blog Reviews |
| Activities | Activities, Categories |
| Hotels | Hotels, Meal Types, Diet Types |
| Packages | Travel Packages |
| Cab management | Vehicle Types, Cab Pricing, Cab Drivers, Verify Cabs, Assign Drivers |
| Marketing | Queries, Email Marketing, Follow ups, References, Coupons, Reviews |
| Sales | Sales Dashboard, Queries Management, Analytics, Follow ups, Package Builder |
| Transactions | Transactions, Failed Transactions, Refunds, Analytics |
| Our Team | Team Members, Activity Logs, Roles and Permissions |
| Booking Management | Package Bookings, Verify Hotels |
| Settings | General |

`AppSidebar` filters these groups/items against `pageAccess` so a restricted
role only sees the pages it's allowed to.

### 4.2 `lib/rbac/nav-hrefs.ts`
An **icon-free** mirror of every href in `NAV_GROUPS` (`ALL_HREFS`) plus
`resolveNavHref(pathname)`. Kept icon-free intentionally: it's imported by the
Server Component layout, and pulling icon libraries (which call `createContext`
at module scope) into the RSC server bundle breaks the build. `nav-items.ts`
re-exports both from here, so the two files must be kept in sync when sidebar
entries are added/removed/renamed.

### 4.3 Server-side page-access enforcement (`(dashboard)/dashboard/(main)/layout.tsx`)
Sidebar filtering alone doesn't stop a direct URL hit, so the layout re-checks on
every request:
1. Load the session + `TeamMember` (with `teamRole.pageAccess`) once.
2. If `pageAccess` is non-empty, resolve the current `x-pathname` (set by
   middleware) via `resolveNavHref`.
3. If the resolved href isn't in `pageAccess`, `redirect()` to the role's first
   allowed page.

---

## 5. Repository layout

```
app/
├── (website)/            # Public site route group
│   ├── page.tsx           # Home
│   ├── destination/[slug]  region/[slug]  hotels/  packages/
│   ├── blogs/             # public blog + authoring (write/edit/my-blogs)
│   ├── book/[quoteId]     # checkout (price-locked quote → payment)
│   ├── bookings/[id]      # booking status / invoice / voucher / pay
│   ├── profile/           # customer profile, travel history, payments
│   └── (footer-pages)/    # about, careers, faqs, policies, etc.
│
├── (dashboard)/dashboard/
│   ├── (auth)/login        # staff login
│   └── (main)/             # everything behind dashboardAuth + RBAC
│       ├── layout.tsx       # auth + RBAC gate, sidebar, header
│       ├── (cabs)/          # cab-pricing, vehicles, cab-drivers, assign-drivers
│       ├── (marketing)/     # queries, email-marketing, coupons, follow-ups, references
│       ├── (sales)/         # sales-query, package-builder, sales-package, follow-ups
│       ├── (transactions)/  # transactions, failed, refunds, settlements, analytics
│       ├── hotels/ activities/ packages/ regions/ destinations/ categories/ policies/
│       ├── team-members/ roles-and-permissions/ activity-logs/
│       ├── package-bookings/ verify-cabs/ verify-hotels/ assign-driver/
│       └── lib/rbac/        # permissions, field-registry, nav-items, nav-hrefs
│
├── actions/               # Server Actions, grouped by domain
│   ├── packages/           # CRUD + pricing + itinerary builder + gallery + search
│   ├── payment/            # booking creation, finalize, cancel, change-date, reconcile, reminders
│   ├── quote/              # signed price-lock quotes (create/get/sign)
│   ├── blogs/ destinations/ regions/ enquiry/ search/
│
├── api/                   # Route handlers
│   ├── auth/[...nextauth]            # public NextAuth
│   ├── dashboard-auth/[...nextauth]  # dashboard NextAuth
│   ├── payments/payu  webhooks/{payu,razorpay}
│   ├── cron/{reconcile-payments,balance-reminders}
│   ├── geo/{countries,states,cities}  locations/*
│   ├── hotels/[slug]  search  upload  user/*
│
├── lib/                   # Shared libraries
│   ├── auth.ts auth-dashboard.ts auth-dashboard-actions.ts
│   ├── db.ts              # Prisma client
│   ├── money.ts           # integer-paise money helpers
│   ├── payments/          # provider registry (Razorpay, PayU)
│   ├── booking/           # booking domain helpers
│   ├── search/meili.ts    # Meilisearch client
│   ├── r2/                # Cloudflare R2 upload/delete
│   ├── email-templates/  seo/  tiptap/  validators/
│   └── redis.ts           # Redis client (cache + distributed locks)
│
├── services/
│   ├── notifications/     # booking emails, WhatsApp/SMS notify, system actor
│   ├── payment-policy/ cancellation-policy/ fulfillment/
│   └── api/                # typed API client wrappers
│
├── repositories/          # data-access repositories (e.g. travel-preference)
├── components/            # shared UI (forms, modals, nav, blog, seo, skeletons)
├── home/                  # homepage sections
└── generated/prisma/      # generated Prisma client (do not edit)

prisma/
├── schema.prisma          # full data model (see §6)
├── migrations/            # SQL migration history
├── seed.ts                # `npm run db:seed` entry point
└── seed/                   # department / team-role / team-member / sales-query seeders

docs/
└── booking/               # in-depth booking & payment system docs (phases 1–9)

scripts/                   # one-off + recurring scripts (reindex, reconcile, e2e, tests)
```

---

## 6. Data model (Prisma)

`prisma/schema.prisma` (~2,300 lines). Grouped by domain:

### Identity & customer
- `User`, `Account`, `Session`, `VerificationToken` — NextAuth public-site tables.
- `Otp`, `MagicSession`, `PendingContactVerification` — phone/email verification flows.
- `TravelPreference`, `LeadProfile` — customer profile/preference data.

### Staff & RBAC
- `Department`, `TeamRole`, `TeamMember` — internal staff + roles
  (`permissions` / `pageAccess` JSON, see §4).
- `ActivityLog` — audit trail of staff actions (`LogAction`/`LogStatus`/`LogSeverity`).

### Content: regions, destinations, categories, policies, blog
- `Location`, `custom_regions`, `destinations`, `categories`, `tags`, `policies`
  (`PolicyType`).
- `blog_posts`, `blog_categories`, `blog_tags`, `blog_post_categories`,
  `blog_post_tags` (`BlogStatus`).

### Hotels
- `hotels`, `hotel_images`, `hotel_image_categories`, `hotel_rooms`,
  `hotel_room_images`.
- Pricing: `hotel_room_pricing`, `hotel_room_pricing_season`,
  `hotel_room_pricing_season_occupancy`, `hotel_room_occupancy_prices`.
- Meals: `meal_types`, `diet_types`, `hotel_meal_pricing`,
  `hotel_meal_pricing_season`.
- `hotel_child_policies` (`RoomSharingType`, `MealType`, `FoodPreference`,
  `MealPlan`).

### Activities
- `activities`, `activity_categories`, `activity_images`.
- `activity_variants`, `activity_variant_pricing`, `activity_variant_season`,
  `activity_variant_season_pricing`, `activity_addons`.

### Travel packages
- `packages`, `package_images`, `package_durations`, `package_tags`,
  `package_categories`.
- Routing: `package_routes`, `route_stops`, `transfer_routes`,
  `itinerary_transfers`.
- Itinerary: `package_itineraries`, `itinerary_attractions`, `itinerary_stays`,
  `itinerary_activities`, `itinerary_notes`, `package_stay_categories`.
- Pricing: `package_pricing`, `package_cab_options`, `package_cab_types`,
  `package_cab_segments`, `pricing_rules`.
- `package_policy_map`, `package_gallery` (`GallerySourceType`).
- Quoting: `package_quote` (`QuoteStatus`) — short-lived signed price locks (§ booking docs).
- Custom packages: `custom_packages` (`CustomPackageStatus`), `custom_itineraries`.

### Cabs
- `vehicles` (`VehicleType`, `FuelType`), `cab_drivers` (`SalaryType`),
  `vehicle_rates` (`VehicleRateType`).
- `cab_pricing`, `cab_pricing_season` (`CabPricingType`).

### Bookings & payments
- `Booking` (`BookingStatus`, `TripType`, `GroupType`, `BudgetTier`,
  `TripDuration`, `TravelMonth`) — the central booking record.
- `BookingHotel`, `BookingCab`, `BookingActivity`, `BookingMeal`,
  `BookingTraveller` (`TravellerType`), `TripDocument` (`DocumentType`).
- `PackageBookingHotel`, `ReplacementOffer`, `BookingTimeline`
  (`TimelineAction`).
- `Payment` (`PaymentStatus`, `PaymentMethod`, `PaymentGateway`, `PaymentPlan`,
  `PaymentPurpose`), `PaymentInstallment` (`InstallmentType`,
  `InstallmentStatus`), `WebhookEvent` (`WebhookStatus`).

### CRM / sales queries
- `package_queries` (`QueryStatus`, `QuerySource`, `ReferralSource`,
  `FulfillmentStatus`), `QueryFollowUp`, `QueryNote`, `QueryTimeline`,
  `RejectionReason`.

---

## 7. Booking & payment system

Fully documented in [`docs/booking/booking-system.md`](./booking/booking-system.md)
and `docs/booking/booking-system-phase{1-9}.md`. Summary:

> **Quote (lock the price) → checkout details → create Booking + gateway order →
> customer pays → gateway webhook confirms → invoice/voucher + ops handoff.**

Core principles: server-authoritative pricing (browser never sends amounts),
integer-paise money math (`app/lib/money.ts`), webhook-as-source-of-truth for
payment confirmation, idempotency via unique DB constraints, and immutable
snapshots of quoted/booked pricing. Supports cancellation (policy-based refunds)
and travel-date changes (re-pricing). Safety nets: a reconciliation cron for
missed webhooks and a balance-due reminder cron (`app/api/cron/*`,
`scripts/cron/...`, `npm run cron:reconcile`).

Payment providers are pluggable via `app/lib/payments/registry.ts`
(`razorpay.provider.ts`, `payu.provider.ts`), selected by `PAYMENT_PROVIDER`.

---

## 8. Search

Meilisearch (self-hosted, `docker-compose.yml` → `getmeili/meilisearch:v1.11` on
port 7700). Client wrapper in `app/lib/search/meili.ts`; indexing entry point
`scripts/reindex-locations.ts` (`npm run reindex:locations`). Used for
destination/location search (`app/api/search`, `app/actions/search`,
`app/api/locations/search`).

---

## 9. Notifications

`app/services/notifications/`:
- `booking-emails.ts` — transactional emails (confirmation, receipts) via Resend
  (`RESEND_API_KEY`, `MAIL_FROM`).
- `booking-notify.ts` — WhatsApp/SMS via MSG91 (`MSG91_*`), gated by
  `NOTIFICATIONS_ENABLED`.
- `system-actor.ts` — attributes system-generated timeline/activity-log entries.
- Ops alerts go to `OPS_EMAIL`.

---

## 10. File storage

Cloudflare R2 (S3-compatible) via `app/lib/r2/{r2,r2upload,r2delete}.ts` and
`@aws-sdk/{client-s3,lib-storage,s3-request-presigner}`. Used for hotel/activity/
package images, blog images, profile avatars, and staff document uploads
(`app/api/upload`, `app/api/user/avatar`).

---

## 11. Environment variables

Set in `.env` (not committed). Required keys by area:

| Area | Variables |
|---|---|
| Core | `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| OTP / WhatsApp (MSG91) | `MSG91_API_KEY`, `MSG91_COMPANY_ID`, `MSG91_TOKEN_AUTH`, `MSG91_WA_TEMPLATE_ID`, `NEXT_PUBLIC_MSG91_TOKEN_AUTH`, `NEXT_PUBLIC_MSG91_WIDGET_ID` |
| Email | `RESEND_API_KEY`, `MAIL_FROM`, `OPS_EMAIL` |
| Notifications | `NOTIFICATIONS_ENABLED` |
| Payments | `PAYMENT_PROVIDER`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `PAYU_KEY`, `PAYU_SALT`, `PAYU_BASE_URL` |
| Quote signing | `QUOTE_SECRET`, `QUOTE_TTL_MINUTES` |
| Reconciliation / cron | `CRON_SECRET`, `RECON_STALE_MINUTES` |
| Search | `MEILI_HOST`, `MEILI_MASTER_KEY` |
| Cache / locks | `REDIS_URL` |
| Maps | `NEXT_PUBLIC_MAPBOX_TOKEN` |

---

## 12. Scripts (`package.json`)

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run seed:locations` | Seed location data |
| `npm run seed:blogs` | Seed blog posts/categories |
| `npm run reindex:locations` | Rebuild the Meilisearch location index |
| `npm run cron:reconcile` | Run payment-reconciliation cron logic locally |
| `npm test` | Run all `test:*` scripts (money, policy, cancellation, notifications, checkout, Razorpay, payments, quote) |
| `npm run e2e:phase{4-9}` | End-to-end booking-system phase scripts |

Prisma seeding (`prisma.config.ts` → `prisma/seed.ts`) covers departments, team
roles, team members, and sales queries (`prisma/seed/*.ts`).

---

## 13. Local development setup

1. `npm install`
2. Create `.env` with the variables in §11 (at minimum `DATABASE_URL`,
   `AUTH_SECRET`).
3. `npx prisma migrate deploy` (or `dev`) to apply migrations.
4. `npx prisma db seed` to populate departments/roles/team members/sample data.
5. (Optional) `docker compose up -d meilisearch` for search, then
   `npm run reindex:locations`.
6. `npm run dev` → app on `http://localhost:3000`.
   - Public site: `/`
   - Staff dashboard: `/dashboard/login`

---

## 14. Notes for future contributors

- **Two auth systems are intentional** — never merge the dashboard session
  cookie with the public site's; the `path: /dashboard` + distinct cookie name
  is the isolation boundary.
- **Server Component bundle is restricted React** — any module imported by a
  layout/page that calls `createContext` at module scope (most icon libraries)
  must not be imported into Server Components. Keep icon-bearing modules
  (`nav-items.ts`) separate from icon-free data modules consumed server-side
  (`nav-hrefs.ts`), as already done for the dashboard sidebar/RBAC.
- **Money is always integer paise** on anything that touches a payment gateway
  (`app/lib/money.ts`) — never do float arithmetic on amounts.
- **`pageAccess` enforcement happens in two places** — the sidebar (UX) and the
  dashboard layout (`redirect()` guard, §4.3). Both must stay in sync with
  `ALL_HREFS`/`NAV_GROUPS` when sidebar routes change.
