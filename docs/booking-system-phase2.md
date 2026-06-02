# Booking System — Phase 2: Schema Additions

> Durable record so work survives context compaction. Update the **Status** column as steps complete.
> Phase 1 (signed quote + review page) is COMPLETE — see `docs/booking-system-phase1.md`.

## Goal
Lay the **data foundations** for real bookings & payments — *schema only*, almost no business
logic (that's Phase 3+). Add: a frozen `priceSnapshot` + quote link on Booking, per-person
`BookingTraveller` rows, a payment schedule (deposit vs full), a `WebhookEvent` idempotency log,
**paise discipline** for gateway money, and the unique constraints that make payments idempotent.

## Why these, and the core principle (carried from Phase 1)
Money is computed server-side, snapshotted immutably, charged in **integer minor units (paise)** at
the gateway, and confirmed only on **verified, de-duplicated** webhooks. Phase 2 is the schema that
lets Phase 3+ do that safely.

## Existing schema facts (what we build on / around)
- `Booking` (`@@map("bookings")`): big ops model. Money is **Decimal(10,2) rupees**
  (`hotelCost, cabCost, mealCost, subtotal, marginAmount, gstAmount, totalAmount, paidAmount,
  advancePaidAmount, balanceDueAmount`), `balanceDueDate DateTime?`, `paymentStatus PaymentStatus`,
  `status BookingStatus`, `currency`, `packageId Int?`, `destinationId`, `travellers Int` (a **count**,
  no per-person rows), `startDate/endDate/duration`. **No** quote link, **no** priceSnapshot, **no** paise.
- `Payment` (`@@map("payments")`): `amount Decimal(10,2)`, `gateway`, `method?`, `status`,
  `gatewayOrderId String?` (**indexed, NOT unique**), `gatewayPaymentId String? @unique`,
  `gatewaySignature?`, refund fields, `paidAt?`. **No** paise, **no** idempotency key, **no** raw payload, **no** webhook link.
- `package_quote` (Phase 1): has `QuoteStatus { ACTIVE EXPIRED CONSUMED }`, `breakdown Json`, `signature`,
  `inputs_hash`, money in Decimal(10,2), `expires_at`, `user_id?`.
- Enums today: `BookingStatus` (13 states incl. ops routing), `PaymentStatus { PENDING ADVANCE_PAID
  FULLY_PAID REFUNDED PARTIALLY_REFUNDED TESTING }`, `PaymentMethod { UPI CARD NET_BANKING WALLET EMI CASH }`,
  `PaymentGateway { RAZORPAY PHONEPE PAYU OFFLINE }`.

## Decisions — LOCKED (user-confirmed 2026-06-02)
- ✅ **Paise strategy = parallel columns, not migrate-in-place.** Keep the existing Decimal(10,2)
  rupee columns untouched (they're live in ops/admin). ADD new `*_paise Int` columns for the amounts
  that flow through a gateway. Paise is the **source of truth for charging**; rupees stay for
  display/back-compat. (Avoids a risky rewrite of a live money schema.) `Int` holds up to ₹21.4 crore
  in paise — fine for trip values; use `BigInt` only if we ever exceed that.
- ✅ **Payment schedule = a `PaymentInstallment` table + a `paymentPlan` enum on Booking** (not just
  loose fields). A table cleanly models DEPOSIT + BALANCE legs, supports the Phase-5 balance-reminder
  cron, and keeps per-leg status/due-date/amount.
- **Booking ↔ quote** is a **loose link**: `quoteId String? @unique` (nullable-unique ⇒ one booking
  per quote, many legacy nulls allowed) + a **copied** `priceSnapshot Json` (don't rely on the quote
  row surviving). Creating a booking will flip the quote to `CONSUMED` (logic in Phase 3).
- **Per-traveller rows** in `BookingTraveller`; keep `Booking.travellers` count for back-compat.
- **Migrations**: use the **`prisma db execute` + `migrate resolve --applied`** pattern (NEVER `db push`
  — it threatened data loss before). Each step = one migration, `prisma generate`, independently committable.
- **No business logic in Phase 2** beyond one pure `app/lib/money.ts` util (rupees↔paise) + its test.

## Steps & Status
| Step | Description | Status |
|------|-------------|--------|
| 2.1 | Paise groundwork: pure `app/lib/money.ts` (rupees↔paise, format) + unit test; add `*_paise Int` cols to `Payment` & `Booking` (amount_paise; total/advance/balance) | ✅ DONE |
| 2.2 | Booking↔quote: `quoteId String? @unique`, `priceSnapshot Json?`, `quoteInputsHash String?`, `paymentPlan PaymentPlan?` (new enum FULL/DEPOSIT) | ✅ DONE |
| 2.3 | `BookingTraveller` model + `TravellerType` enum (ADULT/CHILD/INFANT) + relation; lead-traveller + optional passport fields | ✅ DONE |
| 2.4 | `PaymentInstallment` model + `InstallmentType` (DEPOSIT/BALANCE) + `InstallmentStatus` enum + relation; amount in paise, dueDate, paidPaymentId? | ✅ DONE |
| 2.5 | `Payment` hardening: `amount_paise Int`, `idempotencyKey String? @unique`, **make `gatewayOrderId @unique`**, `rawResponse Json?`, `webhookEventId String?` | ⬜ TODO |
| 2.6 | `WebhookEvent` model + `WebhookStatus` enum + `@@unique([gateway, eventId])`; payload Json, signature, processedAt, optional Payment/Booking links | ⬜ TODO |
| 2.7 | Constraints/index audit + `prisma validate` + regen + schema-shape e2e (insert booking+snapshot+travellers+installments+webhook; dedupe asserts) + docs/memory | ⬜ TODO |

## Per-step detail

### 2.1 — Paise groundwork
- `app/lib/money.ts` (pure, no server-only needed): `rupeesToPaise(n): number` (round to int),
  `paiseToRupees(p): number`, `formatPaise(p): string` (₹ display), `paise2` guards. Unit test via the
  existing `tsx`-script pattern (extend `scripts/test-quote.ts` or add `scripts/test-money.ts` + npm script).
- Schema: `Payment.amount_paise Int @default(0)`; `Booking.totalAmount_paise / advanceAmount_paise /
  balanceAmount_paise Int @default(0)`. (Decimal columns stay.)
- Migration `ALTER TABLE ... ADD COLUMN ... DEFAULT 0`; backfill optional (legacy rows can stay 0).

### 2.2 — Booking ↔ quote + snapshot
- `Booking.quoteId String? @unique` (loose ref to `package_quote.id`, NO Prisma relation — same loose
  pattern as destinations↔Location), `priceSnapshot Json?` (copy of the quote's frozen breakdown),
  `quoteInputsHash String?` (traceability/audit), `paymentPlan PaymentPlan?`.
- New `enum PaymentPlan { FULL DEPOSIT }`.
- `@@index([quoteId])`.

### 2.3 — BookingTraveller
- `model BookingTraveller { id cuid; bookingId; type TravellerType; fullName; age Int?; dateOfBirth
  DateTime?; gender Gender?; isLead Boolean @default(false); passportNumber String?; passportExpiry
  DateTime?; nationality String?; createdAt; @@index([bookingId]); @@map("booking_travellers") }`.
- `enum TravellerType { ADULT CHILD INFANT }` (reuse existing `Gender`).
- `Booking.travellersList BookingTraveller[]`. Keep `travellers Int` count.

### 2.4 — PaymentInstallment
- `model PaymentInstallment { id cuid; bookingId; type InstallmentType; amount_paise Int; dueDate
  DateTime?; status InstallmentStatus @default(PENDING); paidPaymentId String?; paidAt DateTime?;
  sequence Int; createdAt updatedAt; @@unique([bookingId, type]); @@index([bookingId]);
  @@index([status]); @@map("payment_installments") }`.
- `enum InstallmentType { DEPOSIT BALANCE }`, `enum InstallmentStatus { PENDING PAID OVERDUE WAIVED CANCELLED }`.
- `Booking.installments PaymentInstallment[]`.

### 2.5 — Payment hardening
- ADD `amount_paise Int @default(0)`, `idempotencyKey String? @unique`, `rawResponse Json?`,
  `webhookEventId String?`.
- **Change `gatewayOrderId` to `@unique`** — first verify the `payments` table has no duplicate/blocking
  rows (likely empty); nullable-unique is fine in Postgres. Migration: `CREATE UNIQUE INDEX ... WHERE`?
  Postgres unique allows many NULLs by default, so a plain unique index works.
- `@@index([webhookEventId])`.

### 2.6 — WebhookEvent
- `model WebhookEvent { id cuid; gateway PaymentGateway; eventId String; eventType String?; payload
  Json; signature String?; status WebhookStatus @default(RECEIVED); error String?; paymentId String?;
  bookingId String?; receivedAt DateTime @default(now()); processedAt DateTime?;
  @@unique([gateway, eventId]); @@index([status]); @@index([paymentId]); @@map("webhook_events") }`.
- `enum WebhookStatus { RECEIVED PROCESSED FAILED IGNORED }`.
- The `@@unique([gateway, eventId])` is THE idempotency guard for Phase 4/5 webhook handling.

### 2.7 — Audit + verify
- `npx prisma validate`; `npx prisma generate`; confirm new models appear in generated client.
- Schema-shape e2e (throwaway tsx, react-server condition): create a throwaway Booking (minimal required
  fields) + priceSnapshot + 2 travellers + DEPOSIT/BALANCE installments + a WebhookEvent; assert the
  `@@unique([gateway,eventId])` rejects a duplicate; cleanup.
- Update this doc's status table → all ✅; update memory; mark Phase 2 COMPLETE.

## Migration mechanics (per step)
1. Edit `prisma/schema.prisma`.
2. Write SQL by hand under `prisma/migrations/<timestamp>_<name>/migration.sql` (CREATE TYPE / CREATE
   TABLE / ALTER TABLE ADD COLUMN / CREATE [UNIQUE] INDEX).
3. Apply: `npx prisma db execute --file <migration.sql>` — **NO `--schema` flag** (Prisma 7.8 +
   `prisma.config.ts` already supplies schema+datasource; passing `--schema` prints usage and the SQL
   silently does NOT run). Confirm you see "Script executed successfully."
4. Record: `npx prisma migrate resolve --applied <migration_name>`.
   - ⚠️ **Neon pooler breaks `migrate resolve`** — it hangs on "Timed out trying to acquire a postgres
     advisory lock" (session advisory locks don't survive the transaction-mode pooler). The direct
     endpoint didn't help either. **Fallback that works:** record the row by hand via `db execute`:
     compute `checksum = sha256(migration.sql bytes)` (hex), then
     `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs,
     rolled_back_at, started_at, applied_steps_count) VALUES (gen_random_uuid()::text, '<checksum>',
     now(), '<migration_name>', NULL, NULL, now(), 1);`. Verified the sha256 algorithm matches Prisma's
     (2.1 row checksum reproduced exactly).
5. `npx prisma generate`; restart dev server (stale client silently breaks).

## Step 2.1 — what was done
- `app/lib/money.ts` (pure): `rupeesToPaise` (round half-up, accepts numeric string), `paiseToRupees`,
  `formatPaise` (Intl en-IN ₹), `sumPaise`, `assertIntPaise`. Test `scripts/test-money.ts` + `npm run
  test:money` (19 asserts). Added top-level `npm test` = money + quote (44 total, green).
- Schema: `Payment.amount_paise Int @default(0)`; `Booking.totalAmount_paise / advanceAmount_paise /
  balanceAmount_paise Int @default(0)`. Decimal rupee columns untouched.
- Migration `20260602110000_add_paise_columns` (ALTER ADD COLUMN ×4) applied + resolved + client regen.
- LEARNED: `prisma db execute --file …` must omit `--schema` on this repo (see mechanics above).

## Step 2.2 — what was done
- `Booking`: `quoteId String? @unique` (loose ref, one booking per quote), `quoteInputsHash String?`,
  `priceSnapshot Json?` (jsonb), `paymentPlan PaymentPlan?`. New `enum PaymentPlan { FULL DEPOSIT }`.
- Migration `20260602120000_add_booking_quote_link` (CREATE TYPE + 4 ADD COLUMN + unique index
  `bookings_quoteId_key`). SQL applied via `db execute`; **`migrate resolve` hit the Neon advisory-lock
  bug**, so recorded via the hand-insert fallback (see mechanics ⚠️). Client regenerated; all 4 fields verified queryable.

## Step 2.3 — what was done
- `BookingTraveller` (`@@map("booking_travellers")`): id(cuid), bookingId(FK→bookings, cascade),
  `type TravellerType`, fullName, age?, dateOfBirth?, `gender Gender?` (reused), isLead(bool),
  passportNumber?, passportExpiry?, nationality?, createdAt. `@@index([bookingId])`.
- `enum TravellerType { ADULT CHILD INFANT }`. `Booking.travellersList BookingTraveller[]` added;
  `Booking.travellers Int` count kept for back-compat.
- Migration `20260602130000_add_booking_traveller` applied via `db execute`; recorded via hand-insert
  (checksum `bef33975…`). Client regen; `db.bookingTraveller` verified (count=0).

## Step 2.4 — what was done
- `PaymentInstallment` (`@@map("payment_installments")`): id(cuid), bookingId(FK→bookings, cascade),
  `type InstallmentType`, sequence(Int, 0=deposit), `amount_paise Int`, dueDate?, `status
  InstallmentStatus @default(PENDING)`, paidPaymentId? (loose ref to Payment), paidAt?, created/updated.
  `@@unique([bookingId, type])` (one DEPOSIT + one BALANCE per booking), `@@index([bookingId])`, `@@index([status])`.
- `enum InstallmentType { DEPOSIT BALANCE }`, `enum InstallmentStatus { PENDING PAID OVERDUE WAIVED CANCELLED }`.
  `Booking.installments PaymentInstallment[]` added.
- Migration `20260602140000_add_payment_installment` applied + recorded (checksum `64e03419…`); regen;
  `db.paymentInstallment` verified.

## Gotchas / conventions
- Prisma v7 needs the `PrismaPg` adapter (`app/lib/db.ts`); bare `new PrismaClient()` throws.
- NEVER `prisma db push` here (it warned about dropping columns before). Always db execute + resolve.
- Adding a UNIQUE to an existing column (2.5 gatewayOrderId): verify no conflicting rows first.
- Paise are integers — round once at the rupee→paise boundary; never do float math on money.
- `'use server'` files export only async fns; keep types/enums-derived helpers in plain modules.
- After schema change: `npx prisma generate` (the Phase-1 ₹0 bug was a stale client).
