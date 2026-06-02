# Booking System — Phase 4: Razorpay Happy Path

> Durable record so work survives context compaction. Update the **Status** column as steps complete.
> Phases 1–3 COMPLETE and merged to `main`. Phase 4 work happens on branch `feat/booking-payment-phase4`.

## Goal
The **first real money path**: turn an ACTIVE quote into a **Booking + Razorpay order**, collect the
**first payment** (deposit or full, per the Phase 3 policy), and confirm it **authoritatively from the
verified webhook** — idempotent end-to-end. Scope = ONE gateway (Razorpay), happy path. Balance
collection, refunds, reconciliation jobs, and the 2nd gateway are later phases.

## Core principle (carried through)
Client never sends money. Server re-derives the amount from the quote + policy, creates the order, and
**only the verified webhook flips payment truth** (Payment PAID, Booking paymentStatus, installment
PAID). The browser callback is defense-in-depth / UX only — never the source of truth. Dedupe every
webhook via `WebhookEvent @@unique([gateway, eventId])`.

## Builds on (existing)
- Phase 1: `getQuote`/`isQuoteFresh`, signed `package_quote` (status ACTIVE→CONSUMED).
- Phase 2 schema: `Booking` (+ `quoteId @unique`, `priceSnapshot`, `paymentPlan`, `*_paise`,
  `paymentStatus`, `balanceDueDate`), `Payment` (`amount_paise`, `idempotencyKey @unique`,
  `gatewayOrderId @unique`, `gatewayPaymentId @unique`, `rawResponse`, `webhookEventId`),
  `PaymentInstallment` (DEPOSIT/BALANCE, status), `WebhookEvent` (`@@unique([gateway,eventId])`).
- Phase 3: `computePaymentSchedule` + `getPaymentScheduleForQuote`.
- `app/lib/money.ts` (paise). Razorpay also works in **paise** — no unit mismatch.
- Empty placeholder dirs exist: `app/api/payments/{initiate,verify}` (no code yet).

## Decisions — LOCKED (user-confirmed 2026-06-02)
- **Razorpay TEST mode** for Phase 4 (test key id/secret/webhook secret). Live keys need KYC; swap via env later.
- **First payment = the policy's first leg**: DEPOSIT plan ⇒ charge `depositPaise`; FULL plan ⇒ charge total.
  Balance is a later phase. Amount is server-derived (never from client).
- **Auth required to book.** `Booking.userId` is non-null in the schema, so the user must be logged in
  (guest checkout would need a schema change — deferred). Booking is created for the authenticated user.
- ✅ **Traveller capture DEFERRED**: no per-person form in Phase 4. `Booking.travellers` = pax count, lead =
  the logged-in user; `BookingTraveller` rows + names added in a later phase.
- ✅ **Official `razorpay` npm SDK** for order creation; Node `crypto` for signature verification.
- ✅ **Server actions** for `createBookingAndOrder` + browser-callback verify (matches the quote/schedule
  action layer). The **webhook stays an API route** (`app/api/webhooks/razorpay/route.ts`) — it needs the RAW body.
- **Booking status on success**: keep ops machine untouched — set `paymentStatus`
  (ADVANCE_PAID / FULLY_PAID) and money fields; leave `Booking.status = PENDING_REVIEW` (enters ops queue).
  No new BookingStatus value ⇒ **Phase 4 needs NO schema change** (if one proves necessary, use the
  Phase-2 `db execute` + hand-insert `_prisma_migrations` mechanics — Neon pooler breaks `migrate resolve`).
- **Idempotency**: order creation keyed by a deterministic `idempotencyKey` (e.g. `quote:<id>:leg:DEPOSIT`);
  re-initiating returns the existing pending order. Booking↔quote is 1:1 via `quoteId @unique`.

## Steps & Status
| Step | Description | Status |
|------|-------------|--------|
| 4.1 | Razorpay client wrapper `app/lib/razorpay.ts` (server-only): `createOrder`, `verifyCheckoutSignature`, `verifyWebhookSignature`; env wiring; unit-test the (pure) signature verifiers | ✅ DONE |
| 4.2 | `createBookingAndOrder(quoteId)` service: auth + getQuote(ACTIVE) + isQuoteFresh → tx{ create Booking(snapshot/installments), quote→CONSUMED, create Payment(PENDING) } → Razorpay order → return `{ bookingId, orderId, amountPaise, keyId }`; idempotent | ✅ DONE |
| 4.3 | Checkout init: server action/route + client Razorpay-checkout on `/book/[quoteId]` (real Pay button → opens Razorpay with order) | ⬜ TODO |
| 4.4 | Webhook handler `app/api/webhooks/razorpay/route.ts` (authoritative): verify sig → dedupe via WebhookEvent → on payment captured: Payment PAID + Booking paymentStatus/money + DEPOSIT installment PAID; idempotent re-delivery → IGNORED | ⬜ TODO |
| 4.5 | Browser-callback verify (server action `verifyCheckoutPayment`) + confirmation page (`/book/[quoteId]/success` or `/bookings/[id]`): verify checkout sig, show status; truth still = webhook (show "processing" until captured) | ⬜ TODO |
| 4.6 | Tests + e2e (test mode): signature-verify unit tests; signed-webhook simulation asserting Payment/Booking/installment transitions + dedupe; docs/memory; Phase 4 complete | ⬜ TODO |

## Per-step detail

### 4.1 — Razorpay client
- `app/lib/razorpay.ts` (`server-only`). Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` (client checkout).
- `createOrder({ amountPaise, receipt, notes })` → `{ orderId, amountPaise, currency }`.
- `verifyCheckoutSignature({ orderId, paymentId, signature })` = HMAC_SHA256(`orderId|paymentId`, key_secret).
- `verifyWebhookSignature(rawBody, signature)` = HMAC_SHA256(rawBody, webhook_secret), timing-safe.
- Signature verifiers are pure crypto → unit-tested via tsx (react-server condition for server-only).

### 4.2 — Booking + order
- `'use server'` `createBookingAndOrder(quoteId)`:
  - `getAuthenticatedUser()` (reject if none).
  - `getQuote` must be `success` + `status ACTIVE`; `isQuoteFresh` must be `fresh` (else reject → re-quote).
  - Resolve booking fields from quote slugs: package (id, destination_id, tripType fallback), duration
    (days/nights → endDate, duration), dates (startDate = travel_date).
  - `computePaymentSchedule` → first leg amount.
  - Prisma `$transaction`: create `Booking` (priceSnapshot, paise, paymentPlan, paymentStatus PENDING,
    status PENDING_REVIEW, balanceDueDate), create `PaymentInstallment` legs, set quote→CONSUMED, create
    `Payment` (PENDING, RAZORPAY, amount_paise = first leg, idempotencyKey = `quote:<id>:DEPOSIT`).
  - `createOrder` for first-leg paise; store `gatewayOrderId` on the Payment.
  - Idempotent: if a Booking already exists for `quoteId`, return its pending order instead of duplicating.
  - Return `{ bookingId, orderId, amountPaise, currency, keyId: NEXT_PUBLIC_RAZORPAY_KEY_ID }`.
  - Open Q: `bookingNumber` generator (e.g. `DY-<yymmdd>-<rand>`), `tripType` source (package category → 'Leisure' fallback).

### 4.3 — Checkout init (client)
- Replace the disabled review-page button with "Pay <amount>" → calls `createBookingAndOrder` → loads
  Razorpay `checkout.js` → `new Razorpay({ key, order_id, amount, prefill }).open()`.
- On checkout `handler` success → POST to `/api/payments/verify` (4.5). On dismiss → leave booking PENDING.

### 4.4 — Webhook (authoritative)
- `app/api/webhooks/razorpay/route.ts` (Node runtime; read **raw** body for signature).
- `verifyWebhookSignature` (reject 400 if bad). Upsert `WebhookEvent` by `(gateway, eventId)` — if it
  already exists/PROCESSED, return 200 IGNORED (idempotent).
- On `payment.captured` / `order.paid`: find Payment by `gatewayOrderId`; in a tx set Payment PAID
  (gatewayPaymentId, paidAt, rawResponse, webhookEventId), bump Booking `paidAmount`/`advancePaidAmount`/
  `balanceDueAmount` + `paymentStatus` (ADVANCE_PAID if deposit, FULLY_PAID if full), mark DEPOSIT
  installment PAID (+ paidPaymentId/paidAt); set WebhookEvent PROCESSED. All keyed for idempotency.

### 4.5 — Browser verify + confirmation
- `verifyCheckoutPayment` ('use server' action): `verifyCheckoutSignature`; if valid, optimistically
  reflect "payment received, confirming…" but DO NOT finalize money (webhook owns it). Returns booking id/status.
- Confirmation page reads Booking + Payment status; shows CONFIRMED once webhook marked PAID, else
  "processing" with the balance schedule (for DEPOSIT).

### 4.6 — Tests + e2e
- Unit: `verifyCheckoutSignature` / `verifyWebhookSignature` accept good, reject tampered/empty.
- e2e: build a signed webhook payload with the test secret → POST to the handler → assert Payment PAID,
  Booking paymentStatus + money, installment PAID, WebhookEvent PROCESSED; re-POST → IGNORED (no double).
- If test keys present, optionally hit Razorpay test `orders` API in 4.2 e2e; else stub.

## Step 4.1 — what was done
- Installed `razorpay` SDK (v2.9.6).
- `app/lib/razorpay.ts` (`server-only`): lazy client (`getClient`), `createRazorpayOrder({amountPaise,receipt,notes})`
  (asserts int paise, INR), `verifyCheckoutSignature({orderId,paymentId,signature})` = HMAC(`orderId|paymentId`,
  key_secret), `verifyWebhookSignature(rawBody, signature)` = HMAC(rawBody, webhook_secret), `razorpayKeyId()`.
  All secrets read lazily via `requireEnv` (throws if missing) — app boots without keys; timing-safe hex compare.
- Env placeholders added to `.env`: `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` (all blank — fill with test keys).
- `scripts/test-razorpay.ts` + `npm run test:razorpay` (react-server condition; sets its own test secrets) —
  11 asserts: good sig accepted, tampered/empty/garbage/wrong-secret rejected (checkout + webhook). Added to `npm test`.
- NOTE: `tsx` cjs transform rejects top-level `await import` → use static imports in test scripts.

## Step 4.2 — what was done
- `app/actions/payment/create-booking.service.ts` (`server-only`) `createBookingAndOrder({ quoteId, userId })`:
  - **Resume path first** (idempotent): if a Booking exists for `quoteId` (and belongs to the user), find its
    pending Payment and return/create its order — no duplicate (Booking.quoteId @unique; quote already CONSUMED).
  - Else **gate**: `getQuote` success+ACTIVE, `isQuoteFresh` fresh (else not_active/stale).
  - Load raw `package_quote` row (ids + frozen `breakdown`) + package(destination_id) + duration(days/nights).
  - `computePaymentSchedule` → first leg. `$transaction`: create Booking (priceSnapshot=breakdown, paise,
    paymentPlan, paymentStatus PENDING, balanceDue*, travellers=pax count, tripType='Leisure' TODO) + installment
    legs + quote→CONSUMED + PENDING Payment (idempotencyKey `quote:<id>:<leg>`). Razorpay order created OUTSIDE
    the tx; `gatewayOrderId` stored on the Payment.
- `app/actions/payment/booking.actions.ts` (`'use server'`) `createPackageBooking(quoteId)` → auth → service (try/catch).
- Verified (throwaway e2e, removed): DB tx commits correctly even when the order step throws w/o keys —
  1 booking for 2 calls (idempotent), DEPOSIT plan, legs 911335+2734003=3645338, quote CONSUMED, payment PENDING.
  **Live Razorpay order creation needs test keys** → exercised in 4.3/4.6.
- Open TODOs: `tripType` is hard-coded 'Leisure'; `bookingNumber` = `DY-<yymmdd>-<hex6>`.

## Gotchas / conventions
- Razorpay amounts are paise — reuse `app/lib/money.ts`; never float.
- Webhook route must read the RAW request body for HMAC (no JSON pre-parse before verify).
- Truth = webhook, not the browser callback. Make every write idempotent (unique keys do the heavy lifting).
- `'use server'` files export only async fns; DTO/types in plain modules.
- Secrets in `.env` (gitignored): `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- No schema change expected; if needed, use Phase-2 migration mechanics (db execute + hand-insert row).
