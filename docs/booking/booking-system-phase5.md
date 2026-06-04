# Booking System — Phase 5: Failure & Reconciliation

> Durable record so work survives context compaction. Update the **Status** column as steps complete.
> Phases 1–4 COMPLETE and merged to `main`. Phase 5 work happens on branch `feat/booking-payment-phase5`.

## Goal
Make the money path **robust when things go wrong or the webhook is missed**: handle failed/refund
webhook events truthfully, add a **reconciliation job** that polls Razorpay for stuck PENDING payments,
and a **balance-due reminder cron** for deposit bookings. The webhook stays the source of truth;
reconciliation is the safety net; reminders chase the balance leg.

## Builds on (existing)
- Phase 4: `processRazorpayWebhook` (only `payment.captured` today), `app/lib/razorpay.ts`,
  `create-booking.service.ts`, confirmation page.
- Phase 2 schema: `Payment` already has `failureReason`, `refundId`, `refundAmount`, `refundedAt`,
  `rawResponse`, `webhookEventId`. `PaymentStatus` has PENDING/ADVANCE_PAID/FULLY_PAID/REFUNDED/
  PARTIALLY_REFUNDED/TESTING — **no FAILED**. `PaymentInstallment` has type/status/dueDate/paidPaymentId —
  **no reminder tracking**. `WebhookEvent @@unique([gateway,eventId])`.
- Resend (`RESEND_API_KEY`) for email.

## Decisions — LOCKED (user-confirmed 2026-06-02)
- **Webhook is truth; recon is the safety net.** Reconciliation never overrides a PROCESSED webhook; it
  only finalizes payments the webhook never confirmed.
- ✅ **Refunds in Phase 5 = record-only.** Handle refund webhooks to keep records truthful (Payment/Booking
  → REFUNDED/PARTIALLY_REFUNDED). **Initiating** refunds + cancellation/date-change policy = Phase 7.
- **Schema additions (small):** add `FAILED` to `PaymentStatus`; add `reminderSentAt DateTime?` +
  `reminderCount Int @default(0)` to `PaymentInstallment` (avoid duplicate reminder emails). Migration via
  the Phase-2 mechanics (`db execute` + hand-insert `_prisma_migrations`; Neon pooler breaks `migrate resolve`).
- **Shared finalize:** refactor the "capture → Payment/Booking/installment" logic out of the webhook into
  one `finalizeCapturedPayment(...)` reused by webhook AND recon (idempotent, guarded by current status).
- **Recon is injectable:** the reconcile service takes a Razorpay-fetcher arg (defaulting to the real SDK)
  so it's unit-testable without live keys.
- **Crons = secret-protected API routes** (`/api/cron/*` guarded by `CRON_SECRET` header/query). The actual
  scheduler (Vercel Cron / external) is wired by ops; the endpoints are idempotent and safe to call repeatedly.
- ✅ **Reconciliation staleness window = 15 minutes** (`RECON_STALE_MINUTES`, env-overridable).
- ✅ **Balance-reminder cadence = 7 days + 1 day before due, then an OVERDUE notice once past due** (3 touchpoints).

## Steps & Status
| Step | Description | Status |
|------|-------------|--------|
| 5.1 | Schema: `PaymentStatus += FAILED`; `PaymentInstallment += reminderSentAt?, reminderCount` — migration + regen | ✅ DONE |
| 5.2 | Refactor `finalizeCapturedPayment(...)` shared by webhook + recon (idempotent, status-guarded); webhook uses it; existing e2e still green | ✅ DONE |
| 5.3 | Webhook: handle `payment.failed` (Payment FAILED + failureReason) and refund events (`refund.processed`/`payment.refunded` → REFUNDED/PARTIALLY_REFUNDED + refund fields, Booking paymentStatus); dedupe as before | ✅ DONE |
| 5.4 | Razorpay fetch helpers (`fetchOrderPayments`/`fetchPayment`) + `reconcilePendingPayments({ olderThanMinutes, fetcher })`: find stale PENDING RAZORPAY payments → poll → finalize/fail (never override webhook) | ✅ DONE |
| 5.5 | Cron routes: `/api/cron/reconcile-payments` + `/api/cron/balance-reminders` (CRON_SECRET); reminder logic marks OVERDUE, emails due-soon, sets reminderSentAt/Count | ✅ DONE |
| 5.6 | Tests + e2e: failed/refund webhook sim; recon with stubbed fetcher (missed-capture → finalized); reminder selection unit; docs/memory; Phase 5 complete | ✅ DONE |

## Per-step detail

### 5.1 — Schema
- `enum PaymentStatus { … FAILED }` (append). `PaymentInstallment`: `reminderSentAt DateTime?`,
  `reminderCount Int @default(0)`. SQL: `ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';` (note: in Postgres
  an enum value add can't run inside a txn block with other DDL — run it as its own statement) + two ADD COLUMNs.

### 5.2 — Shared finalize
- Extract `finalizeCapturedPayment(tx, { payment, booking, gatewayPaymentId, method, rawPayload, webhookEventId })`
  → the exact Payment FULLY_PAID + DEPOSIT installment PAID + Booking paymentStatus/money writes from Phase 4.
- Guard: if Payment already FULLY_PAID → no-op (idempotent). Webhook + recon both call it.

### 5.3 — Failed / refund webhooks
- `payment.failed`: Payment → status FAILED, `failureReason` from entity; Booking left as-is (still PENDING).
  (Booking is not cancelled here — that's policy/Phase 7.)
- `refund.processed` / `payment.refunded`: set Payment `refundId`/`refundAmount`/`refundedAt` and status
  REFUNDED (full) or PARTIALLY_REFUNDED (partial); Booking paymentStatus mirrors. Record-only.
- All via the existing find-or-create WebhookEvent dedupe + raw-body verify.

### 5.4 — Reconciliation
- `app/lib/razorpay.ts`: `fetchOrderPayments(orderId)` / `fetchPayment(paymentId)`.
- `reconcilePendingPayments({ olderThanMinutes, fetcher? })`: select Payments status=PENDING, gateway=RAZORPAY,
  `gatewayOrderId != null`, `createdAt < now-window`; for each, fetch from Razorpay: captured → `finalizeCapturedPayment`;
  failed → mark FAILED; else skip. Idempotent; never touches a payment a webhook already finalized.

### 5.5 — Crons
- `app/api/cron/reconcile-payments/route.ts`: auth via `CRON_SECRET` → `reconcilePendingPayments` → summary JSON.
- `app/api/cron/balance-reminders/route.ts`: find BALANCE installments PENDING for ADVANCE_PAID bookings;
  mark OVERDUE if past `dueDate`; send reminders at **7d + 1d before due** and an **overdue notice** (de-duped
  via `reminderSentAt`/`reminderCount`), via Resend. Env: `CRON_SECRET`. Recon window env `RECON_STALE_MINUTES=15`.

### 5.6 — Tests + e2e
- Unit: reminder selection (due-soon vs overdue vs not-yet) given dates + reminderSentAt; refund/fail status mapping.
- e2e (self-signed / stubbed): `payment.failed` → Payment FAILED; refund event → REFUNDED; recon with a stub
  fetcher returning "captured" for a stale PENDING payment → finalized (booking ADVANCE_PAID); webhook-then-recon
  idempotent (no double).

## Step 5.1 — what was done
- `enum PaymentStatus` += `FAILED`; `PaymentInstallment` += `reminderSentAt DateTime?`, `reminderCount Int @default(0)`.
- Migration `20260602170000_phase5_failure_fields` (`ALTER TYPE … ADD VALUE IF NOT EXISTS 'FAILED'` + 2 ADD COLUMN)
  applied via `db execute`, recorded via hand-insert (checksum `113ba1e1…`), client regen. Verified enum now
  ends with FAILED and reminder columns are queryable. (PG15 allows ADD VALUE alongside the ADD COLUMNs here.)

## Step 5.2 — what was done
- `app/actions/payment/finalize.service.ts` (`server-only`): `finalizeCapturedPayment(tx, { paymentId,
  gatewayPaymentId, method?, rawPayload?, webhookEventId? })` → `FinalizeResult`
  (`finalized | already | not_found | no_booking`). Runs in a caller's tx; idempotent (Payment already
  FULLY_PAID ⇒ `already`); does Payment FULLY_PAID + DEPOSIT installment PAID + Booking paymentStatus/money.
  `mapMethod` moved here.
- `webhook.service.ts` now calls it inside its tx, then sets WebhookEvent PROCESSED (or FAILED). Removed the
  inlined writes + duplicate mapMethod. `npm run e2e:phase4` still PASS.

## Step 5.3 — what was done
- `webhook.service.ts` now dispatches by `eventType` (after verify + dedupe):
  - `payment.captured` → `finalizeCapturedPayment` (unchanged).
  - `payment.failed` → Payment (if PENDING) → `FAILED` + `failureReason` (error_description/reason); Booking left PENDING.
  - `refund.processed`/`refund.created`/`payment.refunded` → resolve Payment by `gatewayPaymentId`
    (refund.payment_id, or entity.id for payment.refunded); set `REFUNDED` (full) / `PARTIALLY_REFUNDED`
    (refund.amount < payment.amount_paise) + refundId/refundAmount/refundedAt; Booking.paymentStatus mirrors. Record-only.
  - else → recorded + IGNORED. All keep the find-or-create WebhookEvent dedupe (PROCESSED ⇒ duplicate).
- Verified (throwaway e2e, removed): failed→FAILED+reason; partial refund→PARTIALLY_REFUNDED (payment+booking)+refundId/amount;
  refund duplicate→duplicate; captured regression (e2e:phase4) still PASS.

## Step 5.4 — what was done
- `app/lib/razorpay.ts`: `fetchOrderPayments(orderId)` → `RazorpayPaymentLite[]` (id/status/method/amount)
  via SDK `orders.fetchPayments`.
- `app/actions/payment/reconcile.service.ts`: `reconcilePendingPayments({ olderThanMinutes?, fetcher?, limit? })`
  → `ReconSummary {scanned,finalized,failed,skipped}`. Selects PENDING/RAZORPAY/has-order/`createdAt < now-window`
  (window = `RECON_STALE_MINUTES` env or 15); per order: captured ⇒ `finalizeCapturedPayment` (idempotent, never
  overrides a webhook since only PENDING is selected); all-failed ⇒ Payment FAILED; else skip. Fetcher injectable.
- Verified (throwaway e2e, removed, stub fetcher): stale captured→finalized (booking ADVANCE_PAID, installment PAID),
  stale all-failed→FAILED, fresh PENDING untouched, 2nd run idempotent (scanned 0).

## Step 5.5 — what was done
- `app/actions/payment/reminders.service.ts` `runBalanceReminders({ now?, mailer? })` → `{ scanned, remindersSent,
  markedOverdue }`. Selects BALANCE installments (PENDING/OVERDUE, dueDate set) on ADVANCE_PAID bookings; stage by
  days-to-due (overdue=3 / due1=2 / due7=1); `reminderCount` is a monotonic stage marker → each touchpoint fires once;
  overdue also flips status OVERDUE; email via `sendEmail` (mailer injectable). Reuses `formatPaise`.
- `app/api/cron/auth.ts` `isAuthorizedCron(req)` (Authorization: Bearer CRON_SECRET, or x-cron-secret; deny if unset).
- Routes `app/api/cron/{reconcile-payments,balance-reminders}/route.ts` (nodejs, GET, 401 if unauthorized) → call the
  services, return JSON summary. The scheduler (Vercel Cron/external) is wired by ops.
- Env: `CRON_SECRET`, `RECON_STALE_MINUTES=15` added to `.env`.
- Verified (throwaway e2e, removed, stub mailer + fixed now): 5 scanned → 3 sent (7d/1d/overdue), 1 OVERDUE,
  count→3; second run idempotent (0 sent).

## Step 5.6 — what was done
- Committed `scripts/e2e-phase5.ts` + `npm run e2e:phase5` (DB-mutating, self-cleaning, stubs Razorpay fetch +
  mailer, self-signs webhooks): payment.failed→FAILED; partial refund→PARTIALLY_REFUNDED (payment+booking)+dedupe;
  reconcile (stale captured→finalized, all-failed→FAILED, fresh untouched, idempotent); reminders (3 sent / 1 overdue /
  idempotent). PHASE5_E2E_PASS. e2e:phase4 still PASS; unit suite 91 green.

## Phase 5 — COMPLETE ✅
Failure & reconciliation done: failed/refund webhooks recorded truthfully, a reconciliation safety net that finalizes
missed captures (shared `finalizeCapturedPayment`, never overrides a webhook), and a 3-touchpoint balance-reminder cron —
both behind `CRON_SECRET` routes. Small schema add (PaymentStatus FAILED + installment reminder fields). On branch
`feat/booking-payment-phase5` (not merged). Ops wires the scheduler; live gateway still needs Razorpay TEST keys.
Next: **Phase 6** — second gateway (PayU) behind a PaymentProvider interface.

## Gotchas / conventions
- `ALTER TYPE ... ADD VALUE` can't run in the same transaction as other statements — keep it standalone in the migration.
- Recon must be idempotent & must not override a PROCESSED webhook (guard on Payment status).
- Money in paise via `app/lib/money.ts`. Webhook truth > recon.
- Crons must be safe to call repeatedly; protect with `CRON_SECRET`; return a summary, not secrets.
- Migrations: `db execute` + hand-insert `_prisma_migrations` row (sha256(file) checksum) — Neon pooler breaks `migrate resolve`.
