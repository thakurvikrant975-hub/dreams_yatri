# Booking System — Phase 3: Payment-Policy Engine

> Durable record so work survives context compaction. Update the **Status** column as steps complete.
> Phases 1 (signed quote + review) & 2 (schema) are COMPLETE and merged to `main`.
> Phase 3 work happens on branch `feat/booking-payment-phase3`.

## Goal
A **pure, fully-tested** engine that, given a quote's total + the travel date, decides **FULL vs
DEPOSIT** and produces the exact payment schedule (amounts in paise, due dates, installment legs).
**No gateway, no money movement, no DB writes in the engine itself** (that's Phase 4+). A thin
read-only preview wires it onto the existing `/book/[quoteId]` review page so the user sees
"pay ₹X now, balance ₹Y by <date>" before we ever build a checkout.

## The policy (from the original brief)
- Travel **far away** → allow a **deposit now**, with the **balance due ~10–15 days before travel**.
- Travel **near** (booking made inside the balance window) → **100% now** (a future balance date is
  impossible, so full payment is required).
- Everything computed server-side from the quote's total + travel date; never trust the client.

## Phase 2 schema this maps onto (already exists)
- `Booking.paymentPlan PaymentPlan(FULL|DEPOSIT)`, `totalAmount_paise`, `advanceAmount_paise`,
  `balanceAmount_paise`, `balanceDueDate`.
- `PaymentInstallment { type InstallmentType(DEPOSIT|BALANCE), sequence, amount_paise, dueDate, status }`,
  unique per `(bookingId, type)`.
- `app/lib/money.ts` (rupees↔paise, sumPaise, assertIntPaise) from Phase 2.1.

## Decisions — LOCKED (user-confirmed 2026-06-02)
- **Single cutoff = the balance window.** If `daysUntilTravel <= BALANCE_DUE_DAYS_BEFORE_TRAVEL`
  ⇒ FULL (balance date would be today/past). Otherwise ⇒ DEPOSIT. (One knob drives both — no overlap/gap.)
- **Deposit = `DEPOSIT_PERCENT` of total, rounded to whole rupees in paise; balance = total − deposit**
  (subtract, so the two legs ALWAYS sum to the exact total — zero rounding drift).
- **Balance due date = `travelDate − BALANCE_DUE_DAYS_BEFORE_TRAVEL` days** (date-only, server tz).
- **Config is env-overridable** with code defaults; pure function also accepts an explicit `config` arg
  for testing. ✅ Confirmed defaults: `DEPOSIT_PERCENT=25`, `BALANCE_DUE_DAYS_BEFORE_TRAVEL=15`,
  `MIN_DEPOSIT_PAISE=200000` (₹2,000 floor; if total < floor ⇒ deposit = total ⇒ effectively FULL).
- **Engine is pure** — no `server-only`, no DB, no Date.now() hidden inside (caller passes `now`).

## Steps & Status
| Step | Description | Status |
|------|-------------|--------|
| 3.1 | `app/services/payment-policy/config.ts` — policy constants (env-overridable) + `PaymentPolicyConfig` type + `resolveConfig()` | ✅ DONE |
| 3.2 | `app/services/payment-policy/engine.ts` — pure `computePaymentSchedule({ totalPaise, travelDate, now, config })` → `{ plan, depositPaise, balancePaise, balanceDueDate, installments[], reason }` | ⬜ TODO |
| 3.3 | `scripts/test-payment-policy.ts` + `npm run test:policy` (+ add to `npm test`): branch coverage — FULL vs DEPOSIT, exact cutoff boundary, legs sum to total, paise rounding, near/far, min-deposit floor, bad input | ⬜ TODO |
| 3.4 | `getPaymentScheduleForQuote(quoteId)` server action (load quote → engine on its total+travel_date → safe DTO); types in non-'use server' module | ⬜ TODO |
| 3.5 | Show the schedule on `/book/[quoteId]` (deposit/full + balance-due date) reading the action; docs/memory; Phase 3 complete | ⬜ TODO |

## Per-step detail

### 3.1 — Config
- `PaymentPolicyConfig = { depositPercent: number; balanceDueDaysBeforeTravel: number; minDepositPaise: number }`.
- Code defaults: `depositPercent=25`, `balanceDueDaysBeforeTravel=15`, `minDepositPaise=200000` (₹2,000).
- `resolveConfig(overrides?)`: code defaults ← env (`PAYMENT_DEPOSIT_PERCENT`,
  `PAYMENT_BALANCE_DUE_DAYS_BEFORE_TRAVEL`, `PAYMENT_MIN_DEPOSIT_PAISE`) ← explicit overrides. Validates
  (percent 1–100, days ≥ 0, minDepositPaise ≥ 0). Pure (reads `process.env` only inside `resolveConfig`, not at import).

### 3.2 — Engine (pure)
- Signature: `computePaymentSchedule(input: { totalPaise: number; travelDate: string /*YYYY-MM-DD*/;
  now?: Date; config?: PaymentPolicyConfig }): PaymentSchedule`.
- `daysUntilTravel = floor((travelDate@00:00 − now@00:00) / 1 day)`.
- If `daysUntilTravel <= config.balanceDueDaysBeforeTravel` → **FULL**: deposit = total, balance = 0,
  balanceDueDate = null, 1 installment (DEPOSIT = full, due now) OR mark as FULL with a single leg —
  decide leg shape: FULL ⇒ one DEPOSIT-type leg == total? Better: FULL ⇒ single leg `type=DEPOSIT,
  amount=total, dueDate=now` (so "deposit" always = the up-front charge). Document clearly.
- Else **DEPOSIT**: `deposit = max(minDepositPaise, round(total*pct/100))` clamped `< total`;
  `balance = total − deposit`; `balanceDueDate = travelDate − days`; legs: `[{DEPOSIT, seq0, deposit,
  dueNow}, {BALANCE, seq1, balance, balanceDueDate}]`.
- `assertIntPaise` on inputs/outputs; legs MUST `sumPaise == totalPaise` (engine asserts this invariant).
- `reason`: short machine string e.g. `"FULL_NEAR_TRAVEL"` / `"DEPOSIT_ALLOWED"`.

### 3.3 — Tests
- Far (e.g. 60 days) ⇒ DEPOSIT 25%, legs sum to total, balanceDueDate = travel−15.
- Exactly at cutoff (`daysUntilTravel == 15`) ⇒ FULL. `== 16` ⇒ DEPOSIT.
- Near (3 days) / today / past ⇒ FULL.
- Rounding: odd totals (e.g. 100001 paise) → deposit rounded, balance = remainder, sum exact.
- minDepositPaise floor raises a tiny-total deposit; deposit never ≥ total (tiny totals ⇒ FULL or deposit=total).
- Non-integer/negative total throws.

### 3.4 — Quote → schedule action
- `app/actions/payment/schedule.ts` (`'use server'`): `getPaymentScheduleForQuote(quoteId)` →
  `getQuote` (reuse Phase 1) → if ok, `computePaymentSchedule({ totalPaise: rupeesToPaise(total),
  travelDate, now: new Date() })` → return safe DTO `{ plan, depositPaise, balancePaise, balanceDueDate,
  currency }`. Types in `app/actions/payment/types.ts` (non-'use server').
- Guard: expired/invalid quote ⇒ pass through the same failure reasons.

### 3.5 — Review-page display
- On `/book/[quoteId]` (BookReview), call the action (server-side in page.tsx, pass DTO down) and render:
  - FULL ⇒ "Pay in full: ₹total now".
  - DEPOSIT ⇒ "Pay ₹deposit now · Balance ₹balance due by <formatted balanceDueDate>".
- Still a disabled/"coming soon" pay button (gateway is Phase 4). Pure display of the policy result.

## Migration mechanics
- None — Phase 3 adds **no schema**. (All columns/tables exist from Phase 2.)

## Step 3.1 — what was done
- `app/services/payment-policy/config.ts` (pure): `PaymentPolicyConfig` type, `DEFAULT_PAYMENT_POLICY`
  (25 / 15 / 200000), and `resolveConfig(overrides?)` = defaults ← env ← overrides, validated
  (percent 1–100, days int ≥0, minDepositPaise int ≥0). `process.env` read only inside `resolveConfig`.
- Env knobs: `PAYMENT_DEPOSIT_PERCENT`, `PAYMENT_BALANCE_DUE_DAYS_BEFORE_TRAVEL`, `PAYMENT_MIN_DEPOSIT_PAISE`.

## Gotchas / conventions
- Keep the engine pure: pass `now` in; don't call `Date.now()` inside (tests need determinism).
- Round once (deposit), derive balance by subtraction — never round both legs independently.
- All money math in integer paise via `app/lib/money.ts`.
- `'use server'` files export only async fns; DTO types live in a plain module.
- Env knobs: `PAYMENT_DEPOSIT_PERCENT`, `PAYMENT_BALANCE_DUE_DAYS_BEFORE_TRAVEL`, `PAYMENT_MIN_DEPOSIT_PAISE`.
