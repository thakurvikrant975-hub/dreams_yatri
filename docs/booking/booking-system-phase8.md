# Booking System — Phase 8: Invoicing, Comms, Vouchers, Ops Handoff

> Durable record so work survives context compaction. Update the **Status** column as steps complete.
> Phases 1–7 COMPLETE & merged to `main`. Phase 8 work happens on branch `feat/booking-payment-phase8`.
> **Final phase** of the booking/payment build.

## Goal
Close the loop after payment: send **transactional emails** (confirmation/receipt, cancellation,
date-change, refund — balance reminders already exist from Phase 5), produce a customer **invoice/receipt**
and **trip voucher**, and hand confirmed bookings to **ops**. Money/state are untouched — this is the
"what the customer & ops receive after the money moves" layer.

## Builds on (existing)
- `app/lib/functions/sendEmail.ts` (Resend; `from: onboarding@resend.dev` sandbox — prod needs a verified domain).
- `Booking` (+ priceSnapshot, dates, travellers count, package), `Payment`, `BookingTraveller`,
  `TripDocument` (type `INVOICE`/`ITINERARY`/`HOTEL_VOUCHER`…), R2 upload (`app/lib/r2`).
- `finalizeCapturedPayment` (INITIAL capture point), `cancelBooking`, `changeTravelDate`, `reconcileRefunds`.
- `BookingTimeline` exists but requires a `TeamMember` actor (`performedById` FK + name) — awkward for system events.
- Dashboard `(booking)/package-bookings` is an **empty placeholder** — no ops UI yet.

## Decisions — LOCKED (user-confirmed 2026-06-03)
- ✅ **Documents = printable HTML routes** (`/bookings/[id]/invoice`, `/voucher`) rendered server-side, print-to-PDF
  friendly — **no new PDF dependency**. Optionally record a `TripDocument` row.
- ✅ **Emails (via `sendEmail`)**: **booking confirmation + receipt**, **cancellation confirmation**, **refund
  confirmed**. (Date-change confirmation NOT sent. Balance reminders already exist from Phase 5.) Post-commit,
  best-effort (never block/throw the money path).
- ✅ **Ops handoff = lightweight**: notify a configured `OPS_EMAIL` on new paid bookings + a `BookingTimeline`
  entry via a seeded "System" TeamMember. **Full ops dashboard deferred** (placeholder dir out of scope here).
- **No schema change expected** (reuse `TripDocument`, `BookingTimeline`); invoice/voucher numbers derive from
  `bookingNumber`. If a system timeline actor is wanted, seed one `TeamMember` (no schema change).
- Sender domain: keep `onboarding@resend.dev` for dev; production swap to a verified domain (env `MAIL_FROM`).

## Steps & Status (finalized after decisions)
| Step | Description | Status |
|------|-------------|--------|
| 8.1 | Notifications service: HTML email builders (confirmation/receipt, cancellation, refund) + `sendBookingEmail` wrappers; `MAIL_FROM`/`OPS_EMAIL` env; unit-test the pure builders | ✅ DONE |
| 8.2 | Wire comms into flows (post-commit, non-blocking): INITIAL capture → confirmation+receipt (+ ops notify); cancel → cancellation; refund confirmed → refund email | ✅ DONE |
| 8.3 | Invoice/receipt: printable HTML route `/bookings/[id]/invoice` (owner-guarded) + invoice number; optional `TripDocument(INVOICE)` record | ✅ DONE |
| 8.4 | Voucher: printable HTML route `/bookings/[id]/voucher` (trip + itinerary from priceSnapshot + inclusions); links from booking page + confirmation email | ✅ DONE |
| 8.5 | Ops handoff (lightweight): OPS_EMAIL notification on paid bookings + optional System-actor `BookingTimeline` entry; status note | ✅ DONE |
| 8.6 | Tests (email builders, notification triggers via stub mailer) + invoice/voucher render smoke + docs/memory; Phase 8 + project complete | ✅ DONE |

## Per-step detail (provisional)
### 8.1 — Notifications service
- `app/services/notifications/booking-emails.ts` (pure builders → `{subject, html}` from a small DTO; no I/O) +
  `app/services/notifications/send.ts` (`sendBookingEmail`, resolves recipient, calls `sendEmail`, swallows errors).
- Templates: `bookingConfirmation` (with receipt summary + voucher link), `cancellation` (refund summary),
  `refundConfirmed`. Brand header/footer shared. (No date-change email.)

### 8.2 — Wire comms
- After `processGatewayWebhook` returns `processed` for an INITIAL capture → send confirmation+receipt to the
  booking user + ops notify. (Trigger in the webhook route/service AFTER the tx commits — pass booking/payment ids.)
- `cancelBooking` success → cancellation email. `reconcileRefunds`/refund webhook (status→REFUNDED/PARTIAL) →
  refund email. (No date-change email per decision.) All best-effort (failures logged, never thrown).

### 8.3 — Invoice
- Route `app/(website)/bookings/[id]/invoice/page.tsx` (auth+owner, noindex, print CSS). Invoice no. = `INV-<bookingNumber>`.
  Line items from priceSnapshot subtotals + GST; payments table; amount paid / balance. Optional: write a `TripDocument(INVOICE)`.

### 8.4 — Voucher
- Route `app/(website)/bookings/[id]/voucher/page.tsx` (auth+owner). Trip summary, day-wise itinerary + hotels
  (from priceSnapshot/package), inclusions/exclusions, traveller(s), emergency/contact. Print-friendly.
- "Download invoice / voucher" links on `/bookings/[id]`; voucher link in the confirmation email.

### 8.5 — Ops handoff
- `OPS_EMAIL` notification on each new paid booking (booking no., package, dates, pax, amount). Optional seeded
  "System" `TeamMember` → `BookingTimeline` PAYMENT_RECEIVED/CONFIRMED entry. Full ops dashboard = future work.

### 8.6 — Tests + wrap-up
- Unit: email builders (subject/required content) for each type. Notification triggers via a stub mailer
  (capture sends) in a small e2e. Invoice/voucher pages render (smoke). docs/memory; mark Phase 8 + project COMPLETE.

## Step 8.1 — what was done
- `app/services/notifications/booking-emails.ts` (pure): `bookingConfirmationEmail` (receipt summary + voucher
  link; deposit shows balance/due, full hides it), `cancellationEmail` (refund/fee), `refundConfirmedEmail`,
  `opsNewBookingEmail` — each → `{subject, html}` with a shared branded layout; money via `formatPaise`.
- `app/services/notifications/send.ts` (`server-only`): `sendBookingEmail(to, mail)` best-effort (swallows errors)
  + `opsEmail()` (reads `OPS_EMAIL`, null when unset).
- Env: `MAIL_FROM` (sandbox sender for now), `OPS_EMAIL`. `scripts/test-notifications.ts` + `npm run test:notify`
  (12 asserts) in `npm test` (now 152 total). NOTE: en-IN renders short month as "Sept" (not "Sep").

## Step 8.2 — what was done
- `app/services/notifications/booking-notify.ts` (`server-only`): `notifyBookingConfirmed` (confirmation+receipt
  to user + `opsNewBookingEmail` to OPS_EMAIL), `notifyCancellation`, `notifyRefund` — load data + send, post-commit.
- Wired (all best-effort, try/catch, never block): webhook **captured** branch → `notifyBookingConfirmed` only on a
  fresh INITIAL finalize (finalize now returns `purpose`); webhook **refunded** branch + `reconcileRefunds` →
  `notifyRefund`; `cancelBooking` success → `notifyCancellation`.
- **Gate**: `sendBookingEmail` no-ops unless `NOTIFICATIONS_ENABLED=1` — prevents dev/test/e2e from emailing
  seeded real users; production sets it (with a verified `MAIL_FROM`). Env `NOTIFICATIONS_ENABLED` added.
- e2e:phase4/5/7 still PASS (comms wired but dormant); tsc 0; unit suite green.

## Step 8.3 — what was done
- `app/(website)/bookings/[id]/invoice/page.tsx` (server, owner-guarded via `getAuthenticatedUser` → notFound,
  noindex, `@media print` CSS). Invoice no. `INV-<bookingNumber>`. Line items: taxable (= total ÷ (1+gst%)),
  GST, total (derived from `booking.totalAmount_paise` + `priceSnapshot.gst_percentage` — works post date-change);
  payments table (FULLY_PAID, marks TOPUP as "date-change"); amount paid / balance.
- `PrintButton.tsx` (client, `.no-print`) → `window.print()`. Invoice + voucher links added on `/bookings/[id]`
  (confirmed state). (Voucher route built in 8.4.)

## Step 8.4 — what was done
- `app/(website)/bookings/[id]/voucher/page.tsx` (server, owner-guarded, noindex, print CSS): trip header,
  lead/travellers/dates/duration+stay, **day-wise itinerary from `priceSnapshot.days`** (hotel/room/plan,
  activities, meals), package inclusions/exclusions, support note + PrintButton.
- Booking-page voucher link (8.3) + confirmation-email `voucherUrl` now resolve. tsc 0.

## Step 8.5 — what was done
- `system-actor.ts` (`server-only`) `getSystemActorId()` — lazily seeds/returns a "System" TeamMember
  (email `system@dreamsyatri.internal`, employeeId SYSTEM), idempotent + race-safe.
- `notifyBookingConfirmed` now also writes a `BookingTimeline` `NOTE_ADDED` ("Payment received … ready for ops")
  by the System actor — **not** email-gated (ops record always written). OPS_EMAIL notification was already wired (8.2).
- Verified (throwaway): capture → System actor exists + timeline NOTE_ADDED present. Full ops dashboard deferred.

## Step 8.6 — what was done
- Committed `scripts/e2e-phase8.ts` + `npm run e2e:phase8`: capture → booking ADVANCE_PAID + System actor seeded
  + ops `BookingTimeline` NOTE_ADDED. Email builders covered by `npm run test:notify` (8.1). PHASE8_E2E_PASS.
- Final green check: tsc 0; e2e:phase4/5/6/7/8 all PASS; full `npm test` = 152.

## Phase 8 — COMPLETE ✅
Post-payment layer done: transactional emails (confirmation+receipt / cancellation / refund — gated by
`NOTIFICATIONS_ENABLED`, post-commit best-effort), printable **invoice** + **voucher** routes (no PDF dep),
and lightweight **ops handoff** (OPS_EMAIL + System-actor timeline). On branch `feat/booking-payment-phase8`.

## 🎉 Booking system — ALL PHASES COMPLETE
P1 signed quote+review · P2 schema · P3 payment-policy · P4 Razorpay happy path · P5 failure/reconciliation ·
P6 PayU behind PaymentProvider · P7 refunds/cancellation/date-change · P8 invoicing/comms/vouchers/ops.
Tests: `npm test` (152 unit) + `npm run e2e:phase4..8`. **Go-live checklist:** real Razorpay/PayU TEST keys in
`.env`; validate PayU hash + gateway refunds against live test creds; set `NOTIFICATIONS_ENABLED=1` + a verified
`MAIL_FROM` domain; wire the cron scheduler (`/api/cron/*` with `CRON_SECRET`); configure the gateway webhook
URLs (`/api/webhooks/razorpay|payu`). Future: full ops dashboard, per-traveller capture, balance-payment UI.
- No new deps for documents — printable HTML; users "Save as PDF" via the browser.
- Owner-guard the invoice/voucher routes (noindex); money figures via `formatPaise`.
- Production email needs a verified sender domain (`MAIL_FROM`); dev uses the Resend sandbox sender.
