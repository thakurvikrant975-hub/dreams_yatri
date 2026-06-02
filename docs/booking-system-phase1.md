# Booking System — Build Spec & Progress

> Durable record so work survives context compaction. Update the **Status** column as steps complete.

## Goal
Production-ready package booking + payment system (Razorpay + PayU). Core principle:
**recompute price server-side → snapshot immutably → charge a policy-derived amount →
confirm only on verified webhooks → reconcile.** Never trust money from the client.

## Pricing engine (existing)
`app/services/package-pricing.service.ts` → `computePackagePrice(input)`:
- inputs: `package_id, duration_id, route_id, stay_category_id, adults, children, infants, child_ages, cab_type_ids, travel_date`
- date-sensitive (hotel seasons, cab weekday/weekend, meals, activities) and occupancy-sensitive.
- build-up: `base_cost (hotel+meal+activity+cab) → +margin% → +GST% → final_price`; `price_per_adult = final/adults`.
- returns full `FullPricingBreakdown`; `missing_pricing_config` flag when no pricing row.

## Existing schema we reuse later
`Booking` (has totalAmount, paidAmount, advancePaidAmount, balanceDueAmount, balanceDueDate,
paymentStatus, status machine), `Payment` (gateway/order/payment/signature/refund),
`BookingHotel/Cab/Meal` (component snapshots), `BookingTimeline`, `package_queries` (leads).
`PaymentGateway` enum already has RAZORPAY, PAYU, PHONEPE, OFFLINE.

## Phases (overall)
1. **Quote + snapshot** (signed, short-lived) — IN PROGRESS
2. Schema additions (priceSnapshot on Booking, BookingTraveller, payment schedule, WebhookEvent, paise)
3. Payment-policy engine (deposit vs full by travel-date proximity) — pure, tested
4. One gateway happy path (Razorpay) — idempotent, webhook-authoritative
5. Failure & reconciliation (webhook truth, recon job, balance reminders cron)
6. Second gateway (PayU) behind a PaymentProvider interface
7. Refunds / cancellation / date-change (policy curves)
8. Invoicing, comms, vouchers, ops handoff

## Phase 1 — Decisions (locked)
- Quote is **DB-backed AND signed** (not stateless token).
- **TTL = 15 min**, env-configurable (`QUOTE_TTL_MINUTES`).
- **travelDate REQUIRED** for a quote.
- **Guests allowed** (`user_id` optional).
- Endpoint accepts **only selectors + pax + date** — never money. Server re-derives.
- Review route name: **`/book/[quoteId]`**.
- Env: `QUOTE_SECRET` (HMAC), `QUOTE_TTL_MINUTES`.

## Phase 1 — Steps & Status
| Step | Description | Status |
|------|-------------|--------|
| 1.1 | `package_quote` model + `QuoteStatus` enum + migration + client | ✅ DONE |
| 1.2 | Shared Zod input schema (selectors+pax+date; travelDate≥today; childAges.length===children; caps) | ✅ DONE |
| 1.3 | Signing util: `signQuote`/`verifyQuote` (HMAC-SHA256 over canonical snapshot) + `computeInputsHash` | ✅ DONE |
| 1.4 | `createQuote` service: validate → computePackagePrice → reject missing_pricing_config → snapshot → sign → persist (TTL) → return safe breakdown | ✅ DONE |
| 1.5 | `getQuote` (lazy expiry + verify) + `isQuoteFresh` (recompute & compare total → drift) | ✅ DONE |
| 1.6 | Server actions `createPackageQuote` / `getPackageQuote` (types in non-'use server' file) | ✅ DONE |
| 1.7 | Wire PricingCard "Book" → createPackageQuote → router.push(`/book/[quoteId]`); guard no travelDate | ✅ DONE |
| 1.8 | `/book/[quoteId]` review page: locked snapshot + countdown to expires_at + expired/drift states; payment placeholder (Phase 2) | ✅ DONE |
| 1.9 | env (QUOTE_SECRET, QUOTE_TTL_MINUTES), lazy-expiry policy, unit tests for pure pieces, e2e pass | ✅ DONE |

## Step 1.1 — what was done
- `prisma/schema.prisma`: added `QuoteStatus` enum + `package_quote` model (after `package_pricing`).
  - Fields: id(cuid), package_id/duration_id/route_id/stay_category_id (Int, loose), *_slug (String),
    adults/children/infants, child_ages[]/cab_type_ids[], travel_date, currency, breakdown(Json),
    base_cost/margin_amount/gst_amount/total_amount/price_per_adult(Decimal 10,2),
    inputs_hash, signature, status(QuoteStatus default ACTIVE), expires_at, user_id?, created_at, updated_at.
  - indexes: package_id, status, expires_at, inputs_hash, user_id. `@@map("package_quote")`.
- DB: table+enum+indexes created via `prisma db execute` (NOT db push — avoids unrelated drift).
- Migration recorded: `prisma/migrations/20260602100000_add_package_quote/` + `migrate resolve --applied`.
- `prisma generate` done — `db.package_quote` available.

## Step 1.2 — what was done
- `app/actions/quote/schema.ts` (plain module, NOT 'use server' — importable client+server).
- `quoteInputSchema`: selectors (4 positive-int ids) + slugs (4) + pax + `child_ages[]` + `cab_type_ids[]` + `travel_date`.
  - caps in `QUOTE_LIMITS` (adults≤20, children≤20, infants≤10, cabs≤20, child age 0–17).
  - `travel_date`: regex YYYY-MM-DD → real-calendar-date check (rejects 2026-02-30) → `>= todayISO()` (server-local).
  - `superRefine`: `child_ages.length === children`.
  - exports `QuoteInput` (z.input), `QuoteParsed` (z.output), `QuoteErrors`.
- Note: `children`/`infants`/`child_ages`/`cab_type_ids` have `.default()`, so they're optional on input, present on output.

## Step 1.3 — what was done
- `app/actions/quote/signing.ts` (`import "server-only"`).
- `computeInputsHash(QuoteParsed)` → SHA-256 over explicit canonical string; `child_ages` & `cab_type_ids` **sorted** (order-insensitive).
- `signQuote(payload)` / `verifyQuote(payload, sig)` → HMAC-SHA256 (hex) over `QuoteSignaturePayload`
  = `{inputs_hash, currency, base_cost, margin_amount, gst_amount, total_amount, price_per_adult, expires_at}`.
  Money fields are 2-dp **strings** (matches DB Decimal repr) so float formatting can't change signed bytes.
  `verifyQuote` uses `timingSafeEqual` (length-guarded; rejects empty/garbage hex).
- `money2dp(v)` helper = `Number(v).toFixed(2)` for building the payload.
- Reads `QUOTE_SECRET` (throws if <16 chars). Added to `.env`: `QUOTE_SECRET`, `QUOTE_TTL_MINUTES=15`.
- Smoke-tested: order-insensitive hash, pax-sensitive hash, good-sig verifies, tampered total/expiry/garbage/empty all rejected.

## Step 1.4 — what was done
- `app/actions/quote/create-quote.service.ts` (`server-only`). `createQuote(rawInput, { userId? })`.
- Flow: `quoteInputSchema.safeParse` (→ fieldErrors) → `computePackagePrice` (try/catch) →
  reject `missing_pricing_config` → money via `money2dp` (2-dp strings) → `inputs_hash` + `expires_at` (now + TTL) →
  `signQuote` → `db.package_quote.create` (full breakdown frozen as JSON) → return **SafeQuote**.
- **SafeQuote** excludes base_cost/margin (no cost build-up leaks): exposes total/per_adult/gst_amount/gst_percentage + slugs + pax + dates + status + expires_at.
- TTL from `QUOTE_TTL_MINUTES` (default 15). `travel_date` stored as UTC-midnight DateTime. currency hard-set "INR".
- **money contract**: amounts ALWAYS go through `money2dp(...)` before signing AND storage, so Step 1.5 verify (reading Prisma Decimal → `money2dp`) reproduces identical signed bytes. (Prisma `Decimal.toString()` drops trailing zeros — never sign that directly.)
- Live DB insert deferred to wiring (1.7/1.9): `server-only` throws in a standalone tsx script. tsc clean; crypto already smoke-tested.

## Step 1.5 — what was done
- `app/actions/quote/get-quote.service.ts` (`server-only`).
- `getQuote(id)` → `GetQuoteResult`:
  - integrity = recompute `computeInputsHash` from stored selectors **must equal** stored `inputs_hash`
    (catches selector tampering) **AND** `verifyQuote` over the money snapshot (catches money/expiry tampering). Either fails → `{success:false, reason:'invalid'}`.
  - lazy expiry: `ACTIVE` + past `expires_at` → flips to `EXPIRED` in DB on read (no cron). Returns `SafeQuote` with live status.
  - `gst_percentage` pulled from the frozen `breakdown` JSON.
- `isQuoteFresh(id)` → `{fresh, lockedTotal, currentTotal, drift}` (non-mutating). Recomputes today's price for the locked inputs; `missing_pricing_config` now ⇒ `fresh:false, currentTotal:null`. Used at payment time / review load to refuse a stale lock.
- All Decimal reads go through `money2dp(row.x.toString())` so verify reproduces the signed bytes.

## Step 1.6 — what was done
- `app/actions/quote/actions.ts` (`'use server'`) — exports ONLY async fns:
  - `createPackageQuote(input)` → resolves session via `getAuthenticatedUser`, passes `userId` to `createQuote`.
  - `getPackageQuote(id)` → `getQuote`.
  - `checkQuoteFreshness(id)` → `isQuoteFresh` (for the review page / payment guard).
- Types stay in the service modules; this file imports them with `import type` only (no type re-exports, per the 'use server' rule). Client components `import type` straight from the service files — erased at build, so the `server-only` guard isn't tripped.

## Step 1.7 — what was done
- `PackageBookingProvider`: context now also exposes `packageId/durationId/routeId/stayCategoryId` (needed to build a quote).
- New shared hook `components/useBookQuote.ts` → `{ book, booking, error }`. Builds the QuoteInput from booking context + route slugs (`useParams`), guards missing `travelDate`, calls `createPackageQuote`, on success `router.push('/book/[id]')`, else surfaces `error`.
- `PricingCard` + `MobileFooterBar` both call `useBookQuote` — single source of truth, both Book buttons live now (loading state + inline error).
- NOTE: `/book/[quoteId]` route is built in Step 1.8 — until then the Book button 404s.

## Step 1.8 — what was done
- Route `app/(website)/book/[quoteId]/` (under `(website)` → gets `data-layout` + Providers; renders own Header/Footer like `/packages`).
- `page.tsx` (server, `force-dynamic`, `robots: noindex`): `getPackageQuote(id)` → branches:
  - `invalid` / `not_found` → `StatusScreen` (friendly message + CTA to /packages).
  - success → fetch `packages.{title,thumbnail}` by slug + `checkQuoteFreshness` (only when ACTIVE) → `<BookReview>`.
- `BookReview.tsx` (client): countdown band, trip summary (title/thumb/duration_label/stay/dep date/travellers), **locked** price summary (per-adult/gst/total), drift warning banner if not fresh, payment placeholder (disabled — Phase 2). Flips to an "expired — get a fresh price" panel when status≠ACTIVE OR the countdown hits 0.
- `QuoteCountdown.tsx` (client): MM:SS to `expires_at`, urgent (red) ≤60s, fires `onExpire`.
- Re-quote link = `/packages/{package_slug}/{duration_slug}/{route_slug}/{stay_slug}`.
- SafeQuote gained `duration_label` + `stay_category_label` (from frozen breakdown) for display; getQuote reads them from breakdown JSON (slug fallback).

## Step 1.9 — what was done
- **Env** (in `.env`, gitignored): `QUOTE_SECRET` (≥16 chars; HMAC key), `QUOTE_TTL_MINUTES=15`. signing.ts throws if QUOTE_SECRET missing/short; createQuote defaults TTL→15 if unset/invalid.
- **Unit tests**: `scripts/test-quote.ts` + npm script `test:quote` (`tsx --conditions=react-server --env-file=.env`). The `react-server` condition resolves `server-only` to a no-op so signing.ts is importable in tsx. 25 assertions (schema rules + hash order-insensitivity + sign/verify tamper rejection) — all green.
- **Lazy expiry**: confirmed — getQuote flips ACTIVE→EXPIRED on read past expires_at (no cron in Phase 1).
- **Backend e2e** (throwaway script, since removed) against the real Manali package: create→get(verify)→isQuoteFresh(drift 0)→tamper total→getQuote rejected `invalid`→cleanup. All passed.
- NOTE: browser render of `/book/[quoteId]` (live countdown + states) to be eyeballed by the user; backend pipeline proven.

## Phase 1 — COMPLETE ✅
All 9 steps done. Quote+snapshot system live end-to-end: signed, DB-backed, TTL'd, integrity-checked, drift-aware, wired from the Book button to a review page with a payment placeholder. Next: **Phase 2** (schema additions — priceSnapshot on Booking, BookingTraveller, payment schedule, WebhookEvent, paise).

## Gotchas / conventions to remember
- Prisma v7 client needs the `PrismaPg` adapter (see `app/lib/db.ts`); a bare `new PrismaClient()` throws.
- `'use server'` files may export only async functions — put Zod schemas/types in a separate plain module.
- Decimal → store/charge integer **paise** at gateway time (Phase 2); Decimal rupees for display.
- After any schema change: `npx prisma generate` + restart dev server (stale client silently breaks pricing).
- tsc has a pre-existing-but-now-resolved note: `.next/dev/types/validator.ts` route validator can lag new routes until next `next dev`/`build`.
