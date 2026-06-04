# Dreams Yatri — Booking & Payment System (Reference)

In-depth documentation of the package booking + payment system (Phases 1–8; Phase 9 extends the
checkout). Per-phase build logs live in `docs/booking-system-phase{1..9}.md`; this file is the
"how it all works" overview.

---

## 1. What the system does

It turns a browsing user into a **paid, confirmed package booking**, safely:

> **Quote (lock the price) → collect details → create a Booking + a gateway order → the customer pays →
> the gateway webhook confirms it → invoice/voucher + ops handoff.** Failures self-heal via reconciliation;
> bookings can be cancelled (policy refund) or have their travel date changed (re-priced).

### Non-negotiable principles (apply everywhere)
1. **Server-authoritative money.** The browser never sends an amount. The server recomputes every rupee
   from package pricing + policy. Clients only send *selectors* (which package/date/travellers) and *choices*.
2. **Integer paise.** All money that touches a gateway is integer **paise** (`app/lib/money.ts`); round once
   at the rupee→paise boundary, then only integer math — no floating-point drift. Decimal rupee columns are kept for display.
3. **The webhook is the source of truth.** Payment is only *confirmed* when the gateway's **verified,
   de-duplicated webhook** says so. The browser callback is UX/defense-in-depth, never the truth.
4. **Idempotent everywhere.** Unique DB constraints make retries, double webhooks, and re-clicks no-ops.
5. **Snapshot immutably.** What was quoted/booked is frozen, so later price/rate edits never change a past booking.

---

## 2. End-to-end flow

```
Package page  ──"Book"──►  createPackageQuote ──► /book/[quoteId]
   (selectors)                (signed price lock, 15-min TTL)

/book/[quoteId] (review/checkout)
   • shows locked price + countdown + package preview
   • collects traveller + contact (+GST) details   (Pay disabled until valid)
   • customer picks gateway (Razorpay / PayU) + plan (deposit / full)
        │
        ▼  Pay
   createBookingAndOrder
   • re-verify quote (ACTIVE + fresh) → compute schedule (policy)
   • TX: create Booking + installment legs + travellers + PENDING Payment, quote→CONSUMED
   • create gateway order/charge → return CheckoutInit
        │
        ▼  launch
   Razorpay modal  /  PayU hosted-page redirect
        │ pays
        ▼
   Gateway WEBHOOK  ──►  /api/webhooks/{razorpay|payu}
   • verify signature → dedupe (WebhookEvent) → finalizeCapturedPayment:
       Payment FULLY_PAID · DEPOSIT installment PAID · Booking ADVANCE_PAID/FULLY_PAID
   • side-effects (post-commit): confirmation+receipt email, ops notify, ops timeline
        │
        ▼
   /bookings/[id]  (confirmation; polls until confirmed) → Invoice + Voucher links

Safety nets:  reconcile cron (missed webhooks)  ·  balance-due reminder cron
Lifecycle:    cancelBooking (policy refund)  ·  changeTravelDate (re-price + settle)
```

---

## 3. Data model (Prisma)

| Model | Role |
|---|---|
| `package_quote` | The **signed, short-lived price lock** (Phase 1). Holds selectors, frozen `breakdown` JSON, money (Decimal + signed), `inputs_hash`, `signature`, `status` (`ACTIVE/EXPIRED/CONSUMED`), `expires_at`. |
| `Booking` | The order. Money in **paise** (`totalAmount_paise/advanceAmount_paise/balanceAmount_paise`) + Decimal rupees; `paymentPlan` (FULL/DEPOSIT), `paymentStatus`, `status` (ops machine), `quoteId @unique` (one booking per quote), `priceSnapshot`, `contactEmail/Phone/gstStateCode`, `balanceDueDate`, `cancelledAt/cancelReason`. |
| `BookingTraveller` | Per-person rows: `type` (ADULT/CHILD/INFANT), `firstName/lastName/fullName`, `dateOfBirth`, `gender`, `isLead`. |
| `PaymentInstallment` | The schedule legs: `type` (DEPOSIT/BALANCE), `amount_paise`, `dueDate`, `status`, reminder tracking; `@@unique([bookingId, type])`. |
| `Payment` | A charge attempt: `amount_paise`, `gateway`, `status` (`PENDING/FULLY_PAID/FAILED/REFUNDED/PARTIALLY_REFUNDED`), `purpose` (INITIAL/TOPUP/BALANCE), `gatewayOrderId @unique`, `gatewayPaymentId @unique`, `idempotencyKey @unique`, `refundId/refundAmount`, `rawResponse`, `webhookEventId`. |
| `WebhookEvent` | Idempotent gateway-event log: `@@unique([gateway, eventId])`, raw `payload`, `status` (RECEIVED/PROCESSED/FAILED/IGNORED). |
| `BookingTimeline` | Ops audit entries (used for the "payment received" handoff via a System actor). |
| `TripDocument` | Optional invoice/voucher records (`INVOICE`/`ITINERARY`…). |

Money is **two-track**: integer `*_paise` columns are the charge source of truth; Decimal rupee columns
stay for display/back-compat. The two never drift because paise is derived once and balance = total − deposit.

---

## 4. Phase-by-phase — what we built & why

### Phase 1 — Quote + snapshot (the price lock)
**Problem:** a price can change between "see ₹X" and "pay", and a client could tamper with the amount.
**Built:**
- `package_quote` model; `app/actions/quote/`:
  - `schema.ts` — Zod input (selectors + pax + travel date; date ≥ today; childAges length = children; caps). **No money accepted.**
  - `signing.ts` — `computeInputsHash` (SHA-256, order-insensitive arrays) + `signQuote`/`verifyQuote` (HMAC-SHA256, timing-safe) over a 2-dp money snapshot + expiry.
  - `create-quote.service.ts` — `createQuote`: validate → `computePackagePrice` → reject un-priceable → snapshot the full breakdown → sign → persist with **15-min TTL** → return a **SafeQuote** (no margin/cost leak).
  - `get-quote.service.ts` — `getQuote` (recomputed-hash **and** HMAC must both verify; lazy `ACTIVE→EXPIRED` on read) + `isQuoteFresh` (recompute today's price, compare to the lock → drift).
  - `actions.ts` — `createPackageQuote` / `getPackageQuote` / `checkQuoteFreshness`.
- `/book/[quoteId]` review page with a live **countdown** to expiry + expired/invalid/drift states.
- **Env:** `QUOTE_SECRET`, `QUOTE_TTL_MINUTES`.

### Phase 2 — Schema foundations
**Problem:** bookings/payments need somewhere to live, with the right constraints for idempotent money.
**Built (schema only):** paise columns on `Payment`/`Booking`; `Booking`↔quote link + `priceSnapshot` +
`paymentPlan`; `BookingTraveller`; `PaymentInstallment` (DEPOSIT/BALANCE, unique per booking+type);
hardened `Payment` (unique `gatewayOrderId`/`idempotencyKey`, `rawResponse`, webhook link); `WebhookEvent`
with `@@unique([gateway,eventId])`. Plus the pure `app/lib/money.ts` (rupees↔paise, `sumPaise`, `assertIntPaise`).

### Phase 3 — Payment-policy engine (deposit vs full)
**Problem:** decide how much to collect now.
**Built:** `app/services/payment-policy/{config,engine}.ts` — pure `computePaymentSchedule({ totalPaise,
travelDate, now })`:
- If `daysUntilTravel ≤ 15` (the balance window) ⇒ **FULL** (a future balance date is impossible).
- Else ⇒ **DEPOSIT** = `max(25% of total, floor)`; **balance = total − deposit** due `travel − 15 days`.
  (Floor was ₹2,000; raised to **₹10,000** in Phase 9.) Cheap trips below the floor ⇒ effectively FULL.
- Pure (caller passes `now`), money in paise, deposit rounded once → no drift. `getPaymentScheduleForQuote`
  surfaces it on the review page.

### Phase 4 — Razorpay happy path
**Problem:** actually take a payment, safely.
**Built:**
- `app/lib/razorpay.ts` — order creation (SDK) + `verifyCheckoutSignature` + `verifyWebhookSignature` (HMAC, timing-safe).
- `create-booking.service.ts` `createBookingAndOrder` — gate the quote (ACTIVE + fresh) → in **one transaction**
  create the `Booking` (+ priceSnapshot, installment legs), flip the quote to `CONSUMED`, create a `PENDING`
  `Payment`; **then** (outside the tx) create the Razorpay order and store `gatewayOrderId`. Idempotent: an
  existing booking for the quote is resumed, not duplicated (`Booking.quoteId @unique`).
- `/api/webhooks/razorpay` — reads the **raw** body, verifies, **dedupes**, and on `payment.captured` finalizes.
- `razorpayCheckout.ts` (client modal) + `/bookings/[id]` confirmation page (polls until the webhook confirms).
- **Env:** `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`.

### Phase 5 — Failure & reconciliation
**Problem:** webhooks get missed; payments fail; refunds happen.
**Built:**
- `finalize.service.ts` `finalizeCapturedPayment` — the **single** "capture → Payment/Booking/installment"
  writer, idempotent (already-PAID ⇒ no-op), shared by webhook **and** reconciliation so they can't diverge.
- Webhook now also handles `payment.failed` (→ `FAILED`) and refund events (→ `REFUNDED`/`PARTIALLY_REFUNDED`).
- `reconcile.service.ts` `reconcilePendingPayments` — for payments stuck `PENDING` past a window
  (`RECON_STALE_MINUTES`, 15), poll the gateway and finalize/fail. Never overrides a webhook.
- `reminders.service.ts` `runBalanceReminders` — 7-day + 1-day-before + overdue notices for deposit balances,
  de-duped via `reminderCount`.
- Cron routes `/api/cron/{reconcile-payments,balance-reminders}` guarded by `CRON_SECRET`.

### Phase 6 — Second gateway (PayU) behind a `PaymentProvider` interface
**Problem:** support more than one gateway without rewriting the flow.
**Built:** `app/lib/payments/`:
- `types.ts` — `PaymentProvider` interface + normalized DTOs (`CheckoutInit`, `NormalizedWebhookEvent`,
  `ChargeStatus`, `RefundResult`).
- `registry.ts` — `getProvider(gateway)` + `activeGateway()` + (Phase 9) `enabledGateways()`.
- `razorpay.provider.ts` (adapter over `razorpay.ts`) and `payu.provider.ts` (SHA-512 request + reverse hash,
  hosted-page form-POST, `verify_payment` status, refund).
- The shared flow became provider-driven: **`processGatewayWebhook(gateway, raw, headers)`**, reconcile via
  `fetchChargeStatus`, booking via the chosen provider's `createCharge` returning a `CheckoutInit`.
- PayU routes: `/api/payments/payu/callback` (surl/furl redirect) + `/api/webhooks/payu`; `payuCheckout.ts` (form-POST).
- **Env:** `PAYMENT_PROVIDER`, `PAYU_KEY/SALT/BASE_URL`. (Razorpay = JS modal; PayU = redirect — amounts in paise internally, rupees only at the PayU hash boundary.)

### Phase 7 — Refunds / cancellation / date-change
**Problem:** plans change after payment.
**Built:**
- `app/services/cancellation-policy/{config,engine}.ts` — pure refund curve **90/50/25/0** by days-to-travel
  (≥30 → 90% · 15–29 → 50% · 7–14 → 25% · <7/no-show → 0%); deposit refundable per the curve.
- `PaymentProvider.refund` + `fetchRefundStatus` (Razorpay + PayU).
- `cancel-booking.service.ts` — compute refund → **initiate gateway refund(s) first**, then mark Booking
  `CANCELLED` + cancel unpaid installments; idempotent (per-payment `refundId`). The refund **webhook**
  confirms `REFUNDED`/`PARTIALLY_REFUNDED`; `reconcileRefunds` backs it up.
- `change-date.service.ts` — re-price the new date, add a date-change fee, settle the delta: **refund** if
  cheaper, **fold into the balance** if a balance is pending, or an **immediate top-up charge** (a `Payment`
  with `purpose=TOPUP`). `finalizeCapturedPayment` is **purpose-aware** so a top-up capture doesn't clobber the booking.
- UI: `CancelBookingPanel` + `ChangeDatePanel` on `/bookings/[id]`.

### Phase 8 — Invoicing, comms, vouchers, ops handoff
**Problem:** what the customer and ops receive after the money moves.
**Built:** `app/services/notifications/`:
- `booking-emails.ts` — pure HTML builders (confirmation+receipt, cancellation, refund, ops new-booking).
- `send.ts` — best-effort `sendBookingEmail` (gated by `NOTIFICATIONS_ENABLED`; never blocks the money path).
- `booking-notify.ts` — wired **post-commit** into capture (INITIAL only), refunds, and cancellation.
- `system-actor.ts` — a seeded "System" `TeamMember` so confirmation writes a `BookingTimeline` ops entry.
- Printable **`/bookings/[id]/invoice`** + **`/bookings/[id]/voucher`** routes (owner-guarded, print CSS, no PDF lib).
- **Env:** `NOTIFICATIONS_ENABLED`, `MAIL_FROM`, `OPS_EMAIL` (uses the existing `RESEND_API_KEY`).

### Beyond Phase 8
- **Phase 9** — MMT-style checkout: per-traveller details + contact + optional GST (Pay gated until valid),
  collapsible package preview, **Book-Now-Pay-Later vs Pay-Full** selector (deposit floor ₹10,000; near ⇒ full).
- **Gateway selection** — `enabledGateways()` + a Razorpay/PayU picker at checkout.

---

## 5. Security & correctness

- **Quote signing** — HMAC-SHA256 over `inputs_hash + currency + base/margin/gst/total/per-adult + expires_at`;
  `getQuote` also recomputes the inputs hash from stored selectors → tamper of either fails verification.
- **Gateway signatures** — Razorpay HMAC (checkout `order|payment`, webhook raw-body); PayU SHA-512 reverse hash.
  Webhook routes read the **raw** body before any parse.
- **Idempotency keys** — `Booking.quoteId`, `Payment.gatewayOrderId`/`idempotencyKey`, `WebhookEvent[gateway,eventId]`,
  `PaymentInstallment[bookingId,type]`. Re-delivery / re-click / recon-after-webhook are all no-ops.
- **Webhook truth + reconciliation** — confirmation only on a verified webhook; recon polls the gateway for
  anything the webhook missed (and never overrides it).
- **Auth** — booking requires a logged-in user (`Booking.userId`); cancel/date-change/invoice/voucher are owner-scoped.

---

## 6. Environment variables

| Var | Purpose | Source |
|---|---|---|
| `QUOTE_SECRET` | Quote HMAC key | self-generate (random) |
| `QUOTE_TTL_MINUTES` | Quote validity (15) | config |
| `RAZORPAY_KEY_ID` / `_SECRET` | Razorpay API | Razorpay dashboard (Test/Live) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Browser checkout key | = Key Id |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC | you set it when creating the webhook |
| `PAYMENT_PROVIDER` | Default gateway (RAZORPAY/PAYU) | config |
| `PAYU_KEY` / `PAYU_SALT` | PayU creds (Salt **v1**) | PayU dashboard |
| `PAYU_BASE_URL` | test=`test.payu.in` / prod=`secure.payu.in` | config |
| `RECON_STALE_MINUTES` | Recon staleness window (15) | config |
| `CRON_SECRET` | Protects `/api/cron/*` | self-generate |
| `NOTIFICATIONS_ENABLED` | `1` to actually send emails | switch |
| `MAIL_FROM` | Sender (verified domain in prod) | Resend |
| `OPS_EMAIL` | Ops inbox for new-booking alerts | your choice |
| `RESEND_API_KEY` | Email auth | Resend |

---

## 7. Testing

- **Unit (`npm test`)** — pure logic, no DB/network: money, payment-policy, cancellation-policy, notifications,
  checkout schema, Razorpay/PayU signature + hash round-trips, quote schema/signing.
- **Integration (`npm run e2e:phase4..9`)** — DB-mutating, self-cleaning, self-signed/stubbed gateways:
  capture → confirm, failed/refund, reconciliation, PayU webhook, cancel→refund→reconcile, date-change top-up,
  ops timeline, booking-with-traveller-details + ₹10k floor + gateway choice.
- **Dev helper** — `npm run cron:reconcile` finalizes captured payments locally without a public webhook.

---

## 8. Go-live checklist

1. Real **Razorpay** keys + webhook → `https://<domain>/api/webhooks/razorpay` (events: payment.captured/failed, refund.processed).
2. Real **PayU** key/salt (v1), `PAYU_BASE_URL=https://secure.payu.in`, callback/webhook to `https://<domain>/api/payments/payu/callback` + `/api/webhooks/payu`. Validate the hash with live test creds.
3. `NEXT_PUBLIC_BASE_URL=https://<domain>` (PayU return URLs depend on it).
4. `NOTIFICATIONS_ENABLED=1` + a **verified** `MAIL_FROM` domain in Resend.
5. Schedule the crons (`/api/cron/reconcile-payments` ~every 10–15 min, `/api/cron/balance-reminders` daily) with `CRON_SECRET`.
6. `RECON_STALE_MINUTES=15`; rotate `QUOTE_SECRET`/`CRON_SECRET` from dev values.

---

## 9. Key files map
```
app/lib/money.ts                         paise helpers
app/lib/razorpay.ts                      Razorpay client (orders, signatures, refunds, fetch)
app/lib/payments/types.ts                PaymentProvider interface + normalized DTOs
app/lib/payments/registry.ts             getProvider / activeGateway / enabledGateways
app/lib/payments/razorpay.provider.ts    Razorpay adapter
app/lib/payments/payu.provider.ts        PayU adapter (hash, form-POST, verify_payment, refund)
app/services/package-pricing.service.ts  computePackagePrice (pre-existing pricing engine)
app/services/payment-policy/*            deposit-vs-full schedule
app/services/cancellation-policy/*       refund curve + date-change fee
app/services/notifications/*             email builders, send, notify, system actor
app/actions/quote/*                      schema, signing, create/get quote, checkout schema, actions
app/actions/payment/*                    create-booking, finalize, webhook, reconcile, reminders,
                                         cancel-booking, change-date, schedule, booking.actions, types
app/api/webhooks/{razorpay,payu}/route   raw-body webhook endpoints
app/api/payments/payu/callback/route     PayU surl/furl return
app/api/cron/{reconcile-payments,balance-reminders}/route   secret-guarded crons
app/(website)/book/[quoteId]/*           checkout: review, CheckoutForm, PackagePreview, payment/gateway selectors
app/(website)/bookings/[id]/*            confirmation, invoice, voucher, cancel/date panels
prisma/schema.prisma                     all models/enums above
docs/booking-system-phase{1..9}.md       per-phase build logs & decisions
```
