# Booking System — Phase 6: Second Gateway (PayU) behind a PaymentProvider interface

> Durable record so work survives context compaction. Update the **Status** column as steps complete.
> Phases 1–5 COMPLETE, merged to `main`, pushed. Phase 6 work happens on branch `feat/booking-payment-phase6`.

## Goal
Make the gateway **pluggable**: extract a `PaymentProvider` interface from the Razorpay code, refactor
Razorpay to implement it (no behavior change), make the shared booking/webhook/recon flows
provider-driven, then add **PayU** as a second provider. The booking/finalize/schedule/reminder logic
stays gateway-agnostic; only gateway-specific bits (charge init, signature/hash verify, webhook parsing,
status fetch) live behind the interface.

## Why an interface (the two gateways differ)
- **Razorpay**: create an *order* (SDK) → open a **JS modal** with `order_id` → webhook `payment.captured`
  → verify HMAC(orderId|paymentId). Recon via `orders.fetchPayments`.
- **PayU**: generate a `txnid` + **SHA-512 hash** (`key|txnid|amount|productinfo|firstname|email|udf…|salt`)
  → **form-POST/redirect** to PayU's hosted page → PayU posts back to surl/furl with a **reverse hash** →
  recon via the `verify_payment` API. No "orders", no JS modal.
So the interface must normalize: "start a charge", "verify a callback", "verify+parse a webhook to a
normalized event", "fetch status for recon", and "public config for the client".

## Builds on (existing, Razorpay-coupled today)
- `app/lib/razorpay.ts` (order/sig/fetch). `app/actions/payment/`: `create-booking.service.ts`
  (hardcodes Razorpay), `webhook.service.ts` (`processRazorpayWebhook`, RZP body/events),
  `reconcile.service.ts` (uses `fetchOrderPayments`). **Gateway-agnostic already:** `finalize.service.ts`,
  `reminders.service.ts`, `schedule.ts`, the Phase-2 schema.
- `Payment.gateway` enum already has `RAZORPAY/PAYU/PHONEPE/OFFLINE`; `WebhookEvent.gateway` too → **no schema change**.
- Client: `book/[quoteId]/razorpayCheckout.ts` + `BookReview` Pay button; route `/api/webhooks/razorpay`.

## Decisions — LOCKED (user-confirmed 2026-06-03)
- ✅ **Gateway selection = env default, pluggable.** Single active provider via `PAYMENT_PROVIDER`
  (default RAZORPAY); switching = env change. Each booking records `Payment.gateway`. One checkout shown.
- ✅ **PayU checkout = hosted page via form-POST redirect** (server returns signed fields → client
  auto-submits to PayU's hosted page → PayU redirects to surl/furl). Bolt JS deprecated; no seamless flow.
- ✅ **Scope = interface + Razorpay refactor (no behavior change) + full PayU** (checkout, callback, webhook, recon).
- **One interface, normalized event.** `PaymentProvider` with: `createCharge`, `verifyCallback`,
  `verifyWebhook`, `parseWebhookEvent` → `NormalizedWebhookEvent {type: captured|failed|refunded, …}`,
  `fetchChargeStatus`, `publicConfig`. A registry `getProvider(gateway)` returns the impl.
- **`CheckoutInit` is a discriminated union** the client launches: `{provider:'RAZORPAY', orderId, keyId,
  amountPaise}` (JS modal) | `{provider:'PAYU', actionUrl, fields{…incl hash}}` (auto-submit form).
- **Mapping onto existing fields:** PayU `txnid` → `Payment.gatewayOrderId` (our generated ref); PayU
  `mihpayid` → `gatewayPaymentId`. Razorpay unchanged. So `finalizeCapturedPayment` stays as-is.
- **No new SDK for PayU** — direct hash (SHA-512) + REST (`verify_payment`) via `fetch`. (Razorpay keeps its SDK.)
- **No schema change** (enum already supports PAYU). New envs: `PAYU_KEY`, `PAYU_SALT`, `PAYU_BASE_URL`
  (test: https://test.payu.in), `PAYMENT_PROVIDER` (active default).
- **Webhook routes stay per-gateway** (`/api/webhooks/razorpay`, `/api/webhooks/payu`) — each reads its raw
  body, calls the shared processor with its provider. PayU also needs callback routes (surl/furl).
  (selection + checkout UX locked above).

## Steps & Status
| Step | Description | Status |
|------|-------------|--------|
| 6.1 | `app/lib/payments/provider.ts` — `PaymentProvider` interface + normalized DTOs (`CheckoutInit`, `NormalizedWebhookEvent`, `ChargeStatus`) + `getProvider(gateway)` registry | ✅ DONE |
| 6.2 | `razorpay.provider.ts` implementing the interface by wrapping existing `razorpay.ts` (normalize order/sig/webhook/fetch); no behavior change; `npm run e2e:phase4/5` green | ✅ DONE |
| 6.3 | Make shared services provider-driven: generalize webhook processor (`processGatewayWebhook(gateway, raw, headers)` using `parseWebhookEvent` + `finalizeCapturedPayment`), recon via `fetchChargeStatus`, booking via `getProvider(active).createCharge` | ✅ DONE |
| 6.4 | `payu.provider.ts` — SHA-512 request hash, `createCharge` (txnid+fields), `verifyCallback` (reverse hash), `verifyWebhook`/`parseWebhookEvent`, `fetchChargeStatus` (verify_payment); envs | ✅ DONE |
| 6.5 | Client + routes: launch `CheckoutInit` (RZP modal vs PayU form-post) in `BookReview`; PayU callback routes (surl/furl) + `/api/webhooks/payu`; provider selection wired | ✅ DONE |
| 6.6 | Tests + e2e: PayU hash + reverse-hash unit; normalized webhook for both gateways; provider registry; recon via stub; docs/memory; Phase 6 complete | ✅ DONE |

## Per-step detail
### 6.1 — Interface + types
- `CheckoutInit` (discriminated union, above). `NormalizedWebhookEvent { type:'captured'|'failed'|'refunded';
  gatewayOrderRef:string; gatewayPaymentId?:string; amountPaise?:number; method?:string; refundId?:string;
  refundAmountPaise?:number; failureReason?:string; eventId:string }`. `ChargeStatus { state:'captured'|'failed'|'pending'; gatewayPaymentId?; method? }`.
- `interface PaymentProvider { gateway; createCharge(input); verifyCallback(payload); verifyWebhook(raw, headers);
  parseWebhookEvent(raw): NormalizedWebhookEvent|null; fetchChargeStatus(orderRef): Promise<ChargeStatus>; publicConfig() }`.
- `getProvider(gateway)` registry; `activeProvider()` from `PAYMENT_PROVIDER`.

### 6.2 — Razorpay provider
- Implement by delegating to existing `razorpay.ts`; map RZP `payment.captured/failed/refund.*` → normalized.
  Keep `razorpay.ts` as the low-level client; provider is the adapter. Existing webhook/recon e2e must stay green.

### 6.3 — Provider-driven shared flow
- Replace `processRazorpayWebhook` internals with a generic `processGatewayWebhook(gateway, raw, headers)`:
  verify → dedupe (WebhookEvent) → `parseWebhookEvent` → switch on normalized type → `finalizeCapturedPayment` /
  fail / refund. The Razorpay route calls it with `'RAZORPAY'`.
- `reconcilePendingPayments` loops payments per `gateway`, uses `getProvider(gateway).fetchChargeStatus`.
- `createBookingAndOrder` uses `activeProvider()` (or selected) `.createCharge`; stores `Payment.gateway` accordingly; returns `CheckoutInit` to the client.

### 6.4 — PayU provider
- Request hash: `sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)`.
- `createCharge` → `{provider:'PAYU', actionUrl:`${PAYU_BASE_URL}/_payment`, fields:{key,txnid,amount,productinfo,firstname,email,surl,furl,hash,…}}`.
- `verifyCallback` → reverse hash `sha512(salt|status|||||||udf…|email|firstname|productinfo|amount|txnid|key)` compare to posted `hash`.
- `fetchChargeStatus` → POST `verify_payment` (command + hash) to PayU; map to ChargeStatus.
- `parseWebhookEvent`/`verifyWebhook` for PayU's server notifications (if enabled) → normalized.

### 6.5 — Client + routes
- `BookReview` launch: if `CheckoutInit.provider==='RAZORPAY'` open modal (existing); if `'PAYU'` build a hidden
  form from `fields` and submit (redirect to PayU). On return, PayU hits surl/furl.
- Routes: `/api/payments/payu/callback` (surl & furl, or one route reading `status`) → `verifyCallback` →
  route to `/bookings/[id]`; `/api/webhooks/payu` → `processGatewayWebhook('PAYU', …)`. Razorpay route unchanged.
- Provider selection (per locked decision) drives which checkout the Pay button starts.

### 6.6 — Tests + e2e
- Unit: PayU request-hash + reverse-hash (known vectors); provider registry returns correct impl.
- e2e: `processGatewayWebhook` with a normalized captured/failed/refund for BOTH providers (self-signed/derived);
  recon via stub `fetchChargeStatus`; Razorpay regression (`e2e:phase4/5`).

## Step 6.1 — what was done
- `app/lib/payments/types.ts` (plain, client-importable): `GatewayId`, `CheckoutInit` (discriminated
  RAZORPAY/PAYU union), `CreateChargeInput`/`CreateChargeResult` (`gatewayOrderRef` → Payment.gatewayOrderId),
  `CallbackResult`, `NormalizedWebhookEvent` (type captured|failed|refunded|other + refs/amounts/method),
  `ChargeStatus`, and the `PaymentProvider` interface (createCharge/verifyCallback/verifyWebhook/parseWebhookEvent/fetchChargeStatus).
- `app/lib/payments/registry.ts` (server-only): `activeGateway()` (from `PAYMENT_PROVIDER`, default RAZORPAY),
  `getProvider(gateway)` switch (throws until Razorpay=6.2 / PayU=6.4 are wired).
- Env added: `PAYMENT_PROVIDER=RAZORPAY`, `PAYU_KEY`/`PAYU_SALT` (blank), `PAYU_BASE_URL=https://test.payu.in`.

## Step 6.2 — what was done
- `app/lib/payments/razorpay.provider.ts` (`server-only`) implements `PaymentProvider` by delegating to
  `razorpay.ts`: `createCharge`→order+CheckoutInit(modal); `verifyCallback`→checkout HMAC; `verifyWebhook`→
  header `x-razorpay-signature`; `parseWebhookEvent`(captured/failed/refund/other → normalized, eventId from
  `x-razorpay-event-id`); `fetchChargeStatus`→fetchOrderPayments→captured/failed/pending.
- Interface tweak: `parseWebhookEvent(rawBody, headers)` (eventId source differs per gateway).
- Registry `getProvider("RAZORPAY")` wired. Verified (throwaway): registry + verify/parse normalization;
  `e2e:phase4/5` still PASS (provider not yet in the live flow — that's 6.3).

## Step 6.3 — what was done
- `webhook.service.ts`: `processRazorpayWebhook` → **`processGatewayWebhook(gateway, rawBody, headers)`** — uses
  `provider.verifyWebhook`/`parseWebhookEvent`, dedupes on `WebhookEvent(gateway, event.eventId)`, then acts on
  the normalized `captured|failed|refunded|other`. `/api/webhooks/razorpay` passes `'RAZORPAY' + req.headers`.
- `reconcile.service.ts`: now loops any-gateway PENDING payments and calls `getProvider(gateway).fetchChargeStatus`;
  injection changed `fetcher: ReconFetcher` → **`statusOf: StatusFetcher`** (gateway, ref) → `ChargeStatus`.
- `create-booking.service.ts`: uses `activeGateway()` + `getProvider().createCharge` (charge outside the tx),
  stores `Payment.gateway = active`, returns **`checkout: CheckoutInit`**. Resume rebuilds via
  `checkoutForExistingOrder` (or re-creates). `BookingOrderDTO` now carries `checkout` (was orderId/keyId).
- `BookReview` launches from `order.checkout` (RAZORPAY modal; PAYU branch stubbed → 6.5).
- Interface +`checkoutForExistingOrder`. Updated `e2e:phase4/5` to the new APIs — both PASS through the
  provider-driven path; full project tsc = 0 errors; unit suite 91 green.

## Step 6.4 — what was done
- `app/lib/payments/payu.provider.ts` (`server-only`) implements `PaymentProvider`:
  - `createCharge` → txnid + `CheckoutInit{provider:'PAYU', actionUrl:`${BASE}/_payment`, fields{...,hash}}`.
  - SHA-512 **request hash** + **reverse hash** built as explicit pipe-arrays (forward 17 / reverse 18 elements;
    5 empty udf-slots mirrored) — auditable, symmetric. `verifyCallback`/`verifyWebhook` recompute reverse hash.
  - `parseWebhookEvent` (form-urlencoded → normalized success=captured/failure=failed). `fetchChargeStatus`
    → `verify_payment` POST to `/merchant/postservice?form=2`.
  - Money converted rupees↔paise only here. Customer prefill deferred → constants (productinfo/firstname/email)
    so resume reproduces the hash from (txnid, amount). **Validate exact hash vs PayU TEST creds before go-live.**
- Registered `getProvider("PAYU")`. Verified (throwaway): forward hash matches documented sequence, resume hash
  identical, callback/webhook reverse-hash accept + reject tampered, parse normalization. tsc clean; 91 unit green.

## Step 6.5 — what was done
- `payuCheckout.ts` (client) `submitPayuForm(actionUrl, fields)` — builds + auto-submits a hidden form to PayU.
  `BookReview` launches `checkout.provider==='PAYU'` via form-POST (redirect; sets processing), Razorpay via modal.
- `app/api/payments/payu/callback/route.ts` (surl/furl): reads raw form body → `processGatewayWebhook('PAYU',…)`
  (verify + finalize, idempotent) → 303-redirect to `/bookings/<b>` (b from query). `app/api/webhooks/payu/route.ts`
  → same processor, JSON response.
- Fix: `processGatewayWebhook` stored payload via `JSON.parse` (broke on PayU form bodies) → added `parsePayload`
  (JSON or URLSearchParams) used for event row + rawResponse everywhere.
- Fix: `finalize.mapMethod` now tolerant of Razorpay (lowercase) AND PayU codes (UPI/CC/DC/NB/EMI/CASH/WALLET).
- Verified (throwaway): PayU captured webhook through the shared processor → Payment FULLY_PAID/UPI, Booking
  ADVANCE_PAID, deposit PAID, dedupe, bad-hash rejected. Razorpay `e2e:phase4/5` still PASS; tsc 0; 91 unit green.

## Step 6.6 — what was done
- `scripts/test-payments.ts` + `npm run test:payments` (pure, no DB; added to `npm test`): registry resolution,
  Razorpay verify/parse/callback normalization, PayU forward+reverse hash round-trip / resume / parse. 18 asserts.
- `scripts/e2e-phase6.ts` + `npm run e2e:phase6` (DB-mutating, self-cleaning): PayU captured webhook through
  `processGatewayWebhook('PAYU')` → Payment FULLY_PAID/UPI, Booking ADVANCE_PAID, deposit PAID, dedupe, bad-hash. PASS.
- Full `npm test` = 109 (money 19 / policy 36 / razorpay 11 / payments 18 / quote 25); e2e:phase4/5/6 all PASS; tsc 0.

## Phase 6 — COMPLETE ✅
Gateway is pluggable: `PaymentProvider` interface + registry; Razorpay refactored onto it (behavior unchanged);
shared `processGatewayWebhook` / reconcile / booking are provider-driven; **PayU** fully implemented
(hosted form-POST, callback+webhook, verify_payment recon). Env-selected via `PAYMENT_PROVIDER`. No schema change.
On branch `feat/booking-payment-phase6`. **Validate PayU hashes vs real PayU TEST creds before go-live.**
Next: **Phase 7** — refunds / cancellation / date-change (policy curves).

## Gotchas / conventions
- Keep `finalize`/`schedule`/`reminders` gateway-agnostic — only the provider adapters know gateway specifics.
- PayU amount is in **rupees with 2 decimals** in the hash (e.g. "9113.35"), NOT paise — convert at the adapter boundary; keep paise internally.
- Webhook/callback routes read the RAW body; verify before trusting. Dedupe via `WebhookEvent[gateway,eventId]` (PayU eventId = mihpayid/txnid).
- No schema change; reuse `gatewayOrderId`/`gatewayPaymentId`. Secrets in `.env`: `PAYU_KEY/SALT/BASE_URL`, `PAYMENT_PROVIDER`.
- Razorpay behavior must not change — the refactor is adapter-only; keep e2e green at each step.
