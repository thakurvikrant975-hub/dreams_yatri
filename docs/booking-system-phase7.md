# Booking System — Phase 7: Refunds / Cancellation / Date-change

> Durable record so work survives context compaction. Update the **Status** column as steps complete.
> Phases 1–5 merged to `main`; Phase 6 (PayU/provider interface) complete on its branch. Phase 7 plan
> committed on the current branch; Phase 7 build branch: `feat/booking-payment-phase7` (create at start).

## Goal
Let a paid booking be **cancelled** (with a policy-driven refund), **refunded** through the gateway, or
have its **travel date changed** (re-priced, with delta settled). Pure, tested policy curves; gateway
refunds via the `PaymentProvider`; webhook remains the source of truth (a refund is only *confirmed* when
the refund webhook lands — Phase 5 already records that).

## Builds on (existing)
- `Payment`: `refundId`, `refundAmount`, `refundedAt`, status `REFUNDED`/`PARTIALLY_REFUNDED`/`FAILED`;
  gateway/`gatewayPaymentId`. Phase-5 webhook **records** refund events.
- `Booking`: `status` (`BookingStatus` incl. `CANCELLED`), `cancelledAt`, `cancelReason`, `paymentStatus`,
  `paidAmount`/`totalAmount_paise`, `startDate`/`endDate`, `installments` (status incl. `CANCELLED`/`WAIVED`).
- Phase 3 `computePaymentSchedule`; Phase 6 `PaymentProvider` (needs a new `refund` method).
- `app/lib/money.ts` (paise); `getPaymentScheduleForQuote`/`createQuote` for re-pricing a new date.

## Decisions — LOCKED (user-confirmed 2026-06-03)
- **Refund = gateway refund to original method** (Razorpay `payments.refund`, PayU refund command). Partial
  refunds supported. Initiation marks intent; the **refund webhook confirms** (Phase 5 path → REFUNDED/PARTIAL).
- ✅ **Cancellation curve = 90 / 50 / 25 / 0**: `≥30 days` → 90% refundable · `15–29` → 50% · `7–14` → 25% ·
  `<7 days / no-show` → 0%. Config-driven (env-overridable), pure engine (caller passes `now`).
- ✅ **Deposit refundable per the curve** — refundable % applies to the WHOLE paid amount (deposit + balance).
- ✅ **Who can cancel = user self-service + admin.** Build the owner flow on `/bookings/[id]`; admin reuses the service.
- ✅ **Date-change = full re-price + delta settlement** — re-price new date, charge the difference (top-up) or
  refund it, plus a date-change fee.
- **Idempotency**: a refund is keyed to its Payment (`refundId` once set); cancelling an already-CANCELLED
  booking is a no-op. Booking→CANCELLED + installments→CANCELLED set on initiation; money confirmed by webhook.
- **No schema change expected** (refund fields + statuses already exist). If date-change top-ups need a 2nd
  Payment leg, that already fits `Payment` + a new `PaymentInstallment`. Migrations via Phase-2 mechanics if needed.

Config defaults (env-overridable): `CANCEL_TIERS` = `[{minDays:30, refundPct:90}, {minDays:15, refundPct:50},
{minDays:7, refundPct:25}, {minDays:0, refundPct:0}]`; `DATE_CHANGE_FEE_PAISE` (e.g. ₹500 = 50000) — confirm value at 7.1/7.5.

## Steps & Status (finalized after decisions)
| Step | Description | Status |
|------|-------------|--------|
| 7.1 | Cancellation/refund **policy engine** (pure): `computeCancellationRefund({paidPaise, daysToTravel, policy})` → `{refundablePaise, feePaise, tier, reason}` + config (tiers, env-overridable) + tests | ✅ DONE |
| 7.2 | `PaymentProvider.refund({gatewayPaymentId, amountPaise, notes})` + Razorpay & PayU impls (+ `fetchRefundStatus`); unit tests | ✅ DONE |
| 7.3 | `cancelBooking` service: policy → initiate gateway refund(s) on captured payments → Booking CANCELLED + installments CANCELLED + paymentStatus; idempotent (refund webhook confirms) | ✅ DONE |
| 7.4 | Cancellation UX + action: refund **preview** (policy quote) + confirm on `/bookings/[id]`; `requestCancellation(bookingId, reason)` action (auth/owner) | ✅ DONE |
| 7.5 | Date-change: `changeTravelDate(bookingId, newDate)` — re-price (new quote), apply date-change fee, settle delta (top-up charge / refund difference), update dates + schedule | ⬜ TODO |
| 7.6 | Refund reconciliation (`fetchRefundStatus`) + e2e (cancel→refund initiated→webhook confirms; date-change delta) + docs/memory; Phase 7 complete | ⬜ TODO |

## Per-step detail (provisional — refined after decisions)
### 7.1 — Policy engine
- `app/services/cancellation-policy/{config,engine}.ts`. Pure: input paid paise + daysToTravel (+ deposit
  treatment) → refundable/fee/tier. Curve tiers from config (env-overridable). Caller passes `now`. Unit-tested
  (each tier boundary, deposit rule, 0-refund window, rounding: refundable rounded, fee = paid − refundable).

### 7.2 — Provider refund
- Add `refund(args): Promise<{ refundId: string; status: 'processed'|'pending' }>` + optional
  `fetchRefundStatus(refundId)`. Razorpay: `payments.refund(paymentId, { amount })`. PayU:
  `cancel_refund_transaction` command (hash `key|command|var1|salt`). Normalize results.

### 7.3 — cancelBooking
- Validate booking cancellable (not already CANCELLED/COMPLETED). `computeCancellationRefund` from paid + days.
- For each FULLY_PAID Payment, call `provider.refund` for the booking's refundable share; store `refundId`/
  `refundAmount`. Set Booking `status=CANCELLED`, `cancelledAt`, `cancelReason`; installments→CANCELLED;
  `paymentStatus` provisional (REFUNDED/PARTIALLY_REFUNDED) — **confirmed** when the refund webhook arrives.
- Idempotent: re-cancel returns the existing outcome.

### 7.4 — Cancellation UX
- `/bookings/[id]`: "Cancel booking" → shows refund preview (refundable vs fee, tier) from a preview action →
  confirm → `requestCancellation(bookingId, reason)` (auth + owner; admin variant later).

### 7.5 — Date-change
- `changeTravelDate(bookingId, newDate)`: re-price via the pricing engine for newDate (same selectors from the
  booking's `priceSnapshot`/quote), compute delta + date-change fee. New total > old ⇒ create a top-up Payment +
  charge (provider.createCharge); new total < old ⇒ refund the difference. Update `startDate`/`endDate`,
  installments. (Scope confirmed in decisions.)

### 7.6 — Reconciliation + e2e
- Refund reconciliation: pending refunds resolved via `fetchRefundStatus`. e2e (stubbed gateway): cancel →
  refund initiated → refund webhook → Booking REFUNDED; partial; date-change delta. docs/memory; mark complete.

## Step 7.1 — what was done
- `app/services/cancellation-policy/config.ts` (pure): `CancellationPolicyConfig {tiers[], dateChangeFeePaise}`,
  `DEFAULT` = 90/50/25/0 + ₹500, `resolveConfig` (defaults ← env `CANCEL_TIERS` JSON / `DATE_CHANGE_FEE_PAISE` ←
  overrides; validated; sorts tiers high→low + guarantees a 0-day catch-all).
- `app/services/cancellation-policy/engine.ts` (pure): `computeCancellationRefund({paidPaise, travelDate, now?, config?})`
  → `{daysToTravel, refundPct, tierMinDays, paidPaise, refundablePaise, feePaise, reason}`. Tier by daysToTravel
  (calendar math, caller passes `now`); refundable rounded once, fee = paid − refundable. Deposit not special.
- `scripts/test-cancellation-policy.ts` + `npm run test:cancel` (in `npm test`): 23 asserts — every tier boundary
  (30/15/7), no-show, zero paid, rounding, override, bad input, config validation. Full `npm test` = 132 green.

## Step 7.2 — what was done
- `PaymentProvider` += `refund({gatewayPaymentId, amountPaise, idempotencyKey?, notes?})` → `RefundResult
  {refundId, state: processed|pending|failed, amountPaise?}` and `fetchRefundStatus(refundId)` → `RefundStatus`.
- Razorpay: `razorpay.ts` `refundRazorpayPayment` (SDK `payments.refund`, partial OK) + `fetchRazorpayRefund`;
  provider maps status via exported `mapRzpRefundStatus` (processed/failed/pending).
- PayU: `cancel_refund_transaction` (hash `key|command|mihpayid|salt`, var2=unique token, var3=rupees) →
  async ⇒ `pending` (status 1) / `failed`; `fetchRefundStatus` via `check_action_status`. Rupees at the boundary.
- Tests in `npm run test:payments` (now 26): PayU refund via stubbed `global.fetch` (request shape + hash + mapping),
  Razorpay status mapper. Full `npm test` = 140 green; tsc clean.

## Step 7.3 — what was done
- `app/actions/payment/cancel-booking.service.ts` (`server-only`): `cancelBooking({ bookingId, reason?, byUserId? })`
  → `CancelBookingResult`; `previewCancellation(bookingId, byUserId?)` → `CancellationPreview` (read-only).
- Flow: load booking+payments → owner check (if byUserId) → if CANCELLED return alreadyCancelled (no re-refund);
  exclude COMPLETED → `computeCancellationRefund` (paid = Σ FULLY_PAID amount_paise, travelDate = startDate) →
  **initiate refunds** allocating `refundablePaise` across captured payments (skip ones with `refundId` = idempotent),
  store `refundId`/`refundAmount` per Payment → THEN tx{ Booking CANCELLED + cancelledAt/reason; unpaid (PENDING/OVERDUE)
  installments → CANCELLED }. Payment.status stays FULLY_PAID until the **refund webhook** flips it (Phase 5).
- Refund-before-cancel ordering (failed refund ⇒ no cancel); per-payment `refundId` idempotency; only unpaid installments cancelled (PAID deposit kept).
- Verified (throwaway, stubbed PayU fetch): 90% of ₹9113.35 refunded, refundId stored, booking CANCELLED + reason,
  BALANCE→CANCELLED / DEPOSIT stays PAID, re-cancel = alreadyCancelled (no new refund), non-owner = forbidden. Suite green.

## Step 7.4 — what was done
- `booking.actions.ts` (`'use server'`): `getCancellationPreview(bookingId)` + `requestCancellation(bookingId, reason?)`
  (auth → owner-scoped via `byUserId` → `previewCancellation`/`cancelBooking`).
- `CancelBookingPanel.tsx` (client): "Cancel booking" → loads preview (refund %/amount, fee, paid) → reason textarea →
  "Confirm cancellation" → `requestCancellation` → `router.refresh()`. Maps error reasons.
- `/bookings/[id]/page.tsx`: selects `status`; three states — pending / **cancelled banner** / confirmed; renders
  `<CancelBookingPanel>` in the confirmed state. tsc 0; suite green (logic covered by 7.3).

## Gotchas / conventions
- Webhook is truth: cancel/refund *initiate*; the refund webhook (Phase 5) *confirms* REFUNDED/PARTIAL.
- Money in paise; round refundable once, fee = paid − refundable (no drift).
- Keep the policy engine pure (caller passes `now`); gateway specifics stay in the providers.
- Idempotency: don't double-refund (guard on `Payment.refundId` / Booking status).
