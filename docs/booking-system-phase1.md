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
| 1.3 | Signing util: `signQuote`/`verifyQuote` (HMAC-SHA256 over canonical snapshot) + `computeInputsHash` | ⬜ TODO |
| 1.4 | `createQuote` service: validate → computePackagePrice → reject missing_pricing_config → snapshot → sign → persist (TTL) → return safe breakdown | ⬜ TODO |
| 1.5 | `getQuote` (lazy expiry + verify) + `isQuoteFresh` (recompute & compare total → drift) | ⬜ TODO |
| 1.6 | Server actions `createPackageQuote` / `getPackageQuote` (types in non-'use server' file) | ⬜ TODO |
| 1.7 | Wire PricingCard "Book" → createPackageQuote → router.push(`/book/[quoteId]`); guard no travelDate | ⬜ TODO |
| 1.8 | `/book/[quoteId]` review page: locked snapshot + countdown to expires_at + expired/drift states; payment placeholder (Phase 2) | ⬜ TODO |
| 1.9 | env (QUOTE_SECRET, QUOTE_TTL_MINUTES), lazy-expiry policy, unit tests for pure pieces, e2e pass | ⬜ TODO |

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

## Gotchas / conventions to remember
- Prisma v7 client needs the `PrismaPg` adapter (see `app/lib/db.ts`); a bare `new PrismaClient()` throws.
- `'use server'` files may export only async functions — put Zod schemas/types in a separate plain module.
- Decimal → store/charge integer **paise** at gateway time (Phase 2); Decimal rupees for display.
- After any schema change: `npx prisma generate` + restart dev server (stale client silently breaks pricing).
- tsc has a pre-existing-but-now-resolved note: `.next/dev/types/validator.ts` route validator can lag new routes until next `next dev`/`build`.
