# Booking System — Phase 9: Checkout Details + Full Preview + Flexible Payment

> Durable record so work survives context compaction. Phases 1–8 COMPLETE & merged to `main`.
> Phase 9 work happens on branch `feat/booking-checkout-details`. (Builds on the MMT-style booking page.)

## Goal
Make `/book/[quoteId]` a complete checkout like MMT's review page:
1. **Traveller details** — per traveller (from the quote's pax): first name, last name, DOB, gender.
2. **Contact details** (email, mobile) + **GST details** (GST state).
3. **Pay button disabled** until traveller + contact (+ required) details are valid.
4. **Full package preview** on the page — itinerary / hotels / activities / transfers (from the frozen
   `priceSnapshot`; later the customised package), collapsible.
5. **Flexible payment** — "Book Now Pay Later" (deposit = max(25%, ₹10,000), balance scheduled) **or**
   "Pay Full Amount Now"; when travel is **near**, full payment is the only option.

## Builds on (existing)
- `/book/[quoteId]` review page (`BookReview`), `createBookingAndOrder` (created the booking at Pay time;
  **traveller capture was deferred in Phase 4** — now we collect it here).
- `BookingTraveller` (fullName/age/dob/gender/isLead…), Phase-3 `computePaymentSchedule` (deposit/full),
  cancellation-policy config (deposit %, floor). `priceSnapshot` (FullPricingBreakdown days) — voucher already renders it.
- Quote stores adults/children/infants/child_ages → number & types of traveller cards to render.

## Decisions — LOCKED (user-confirmed 2026-06-03)
- ✅ **Deposit floor = ₹10,000** (deposit = max(25% of total, ₹10,000), capped at total). Change
  `MIN_DEPOSIT_PAISE` 200000 → 1,000,000. Near-travel still forces full; cheap trips (< floor) → full.
- ✅ **GST details optional** (B2C) — collected if entered; not required to pay.
- ✅ **Installments = 2 legs** (deposit now + one balance due `travel − 15d`). Keep the existing model.
- **Traveller fields** = first name, last name, DOB, gender (domestic; no passport). DOB derives age/child-vs-adult
  sanity. Lead = traveller 1.
- **Payment choice** = the user picks FULL or DEPOSIT when deposit is allowed; engine still decides whether
  deposit is *allowed* (far enough). Booking creation takes the choice; near ⇒ FULL enforced server-side.
- **Schema (small)**: `Booking += contactEmail, contactPhone, gstStateCode?`; `BookingTraveller += firstName,
  lastName` (keep `fullName` = "first last" for back-compat). No other changes. Migration via Phase-2 mechanics.
- **Booking still created at Pay time** (`createBookingAndOrder`) — now with traveller/contact/GST + payment
  choice passed in; it writes `BookingTraveller` rows + contact/GST + plan. Pay button gated client-side by a Zod-valid form.
- **Preview source = `priceSnapshot`** (no extra fetch); renders day-wise itinerary/hotels/activities/transfers.

## Steps & Status (finalized after decisions)
| Step | Description | Status |
|------|-------------|--------|
| 9.1 | Schema: `Booking += contactEmail/contactPhone/gstStateCode?`; `BookingTraveller += firstName/lastName` — migration + regen | ✅ DONE |
| 9.2 | Payment policy: `MIN_DEPOSIT_PAISE → ₹10,000`; `createBookingAndOrder` accepts `paymentChoice` (FULL\|DEPOSIT, near⇒FULL); tests | ✅ DONE |
| 9.3 | Checkout form (client): traveller cards (first/last/DOB/gender ×pax), contact (email/mobile), GST (state, optional); shared Zod schema; Pay disabled until valid | ✅ DONE |
| 9.4 | Wire form → `createPackageBooking`/`createBookingAndOrder`: persist `BookingTraveller` rows + contact/GST + plan; validate server-side too | ✅ DONE |
| 9.5 | Full package preview section (from priceSnapshot) + payment selector UI (Book-Now-Pay-Later schedule vs Pay-Full), near⇒full only | ✅ DONE |
| 9.6 | Tests (policy floor/choice, form schema) + e2e (booking with travellers + choice) + docs/memory; Phase 9 complete | ⬜ TODO |

## Per-step detail (provisional)
- **9.2** engine `minDepositPaise` default → 1,000,000. `createBookingAndOrder({quoteId, userId, details, paymentChoice})`:
  compute schedule; if `paymentChoice==='FULL'` OR schedule.plan==='FULL' (near) → charge full; else deposit. Store plan accordingly.
- **9.3** shared `app/actions/quote/checkout-schema.ts` (plain Zod): `travellers[]` (length = adults+children;
  firstName/lastName req, dob req + valid + age-consistent with ADULT/CHILD, gender req), `contact{email,phone}` (req),
  `gstStateCode?` (opt). Reused client + server.
- **9.4** `createBookingAndOrder` validates `details` with the schema, writes `BookingTraveller` rows (type from
  quote pax order: adults first, then children with their ages), `Booking.contactEmail/Phone/gstStateCode`.
- **9.5** preview = collapsible itinerary from `priceSnapshot.days` (reuse voucher-style rendering); payment
  selector: two options (deposit schedule / full) shown only when deposit allowed, else full-only.

## Step 9.2 — what was done
- `payment-policy/config.ts`: `minDepositPaise` 200000 → **1,000,000 (₹10,000)**. Deposit = max(25%, ₹10k) ≤ total.
- `createBookingAndOrder({…, paymentChoice?})`: `useFull = choice==='FULL' || schedule.plan==='FULL'` (near forces
  FULL); builds effective plan/legs (FULL = single DEPOSIT-type leg = total, balance 0). `createPackageBooking(quoteId, paymentChoice?)` threads it.
- Updated `test:payment-policy` for the new floor (36 green). Verified (throwaway): Manali deposit floored to
  ₹10,000 (25%=₹9,113 < floor); paymentChoice FULL on a far booking → full single leg. e2e:phase4/7 still pass.

## Steps 9.3–9.5 — what was done
- `app/actions/quote/checkout-schema.ts` (plain Zod): `travellers[]` (type/firstName/lastName/dob(past)/gender),
  `contact{email,phone}`, `gstStateCode?`. Shared client + server.
- `CheckoutForm.tsx` (client): traveller cards built from pax (adults/children/infants), contact, optional GST;
  reports a valid `CheckoutInput` (or null) to the parent via `onChange`.
- `createPackageBooking(quoteId, { paymentChoice, details })` → `createBookingAndOrder` validates `details`
  server-side (count must match pax) and writes `BookingTraveller` rows (firstName/lastName + fullName, lead=first)
  + `Booking.contactEmail/contactPhone/gstStateCode`.
- `BookReview`: renders `PackagePreview` (collapsible day-wise itinerary from the quote breakdown), the
  `CheckoutForm`, and a **payment selector** (Book Now Pay Later vs Pay Full) when deposit allowed (near ⇒ full
  only). Pay button **disabled until the form is valid**; amount + plan follow the selection.
- Verified (throwaway): details persist (split names + fullName + lead + contact), pax-mismatch rejected. tsc 0; suite green.

## Gotchas / conventions
- Pay must stay server-authoritative: client gating is UX; `createBookingAndOrder` re-validates details + amount.
- Near-travel (≤ balance window) ⇒ FULL regardless of user choice.
- Money in paise; deposit = max(25%, ₹10,000) ≤ total.
- Migration via `db execute` + hand-insert `_prisma_migrations` (Neon pooler breaks `migrate resolve`).
