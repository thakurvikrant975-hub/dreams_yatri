# Booking Operations — package bookings, upcoming guests, manual documents, transactions

The back-office side of a confirmed booking: watching it, fulfilling it, cancelling or
refunding it, and issuing paperwork.

| Page | Route | Purpose |
|---|---|---|
| Package Bookings | `/dashboard/package-bookings` | every booking, with a full detail/ops view |
| Hotel Bookings | `/dashboard/hotel-bookings` | direct (non-package) hotel bookings — see [`hotels.md`](./hotels.md) §11 |
| Upcoming Guests | `/dashboard/upcoming-guests` | departures in the next 7 days, vendor re-confirmation |
| Manual Documents | `/dashboard/manual-documents` | hand-raised invoices and vouchers |
| Transactions | `/dashboard/transactions` | every `Payment` row across all bookings |

The customer-side booking and payment flow — quote → checkout → gateway → webhook → invoice
— is documented in depth in [`../booking/booking-system.md`](../booking/booking-system.md);
status semantics in [`../booking/status-tracking.md`](../booking/status-tracking.md). This
doc covers only what the dashboard does with those records.

---

## 1. Package Bookings — `/dashboard/package-bookings`

Files: [`(main)/package-bookings/`](<../../app/(dashboard)/dashboard/(main)/package-bookings/>) —
`PackageBookingsClient.tsx`, `PackageBookingsTable.tsx`, `BookingsFilters.tsx`,
`BookingRowActions.tsx`, `[id]/page.tsx` (~700 lines), `[id]/FulfillmentPanel.tsx`,
`actions.ts`, `fulfillment.actions.ts`.

The list covers **both** package bookings and direct hotel bookings; `/dashboard/hotel-bookings`
is the same table filtered to `packageId: null`.

### The gate

Every action in this module goes through `requireMember()` — a logged-in, **active**
`TeamMember`. That's the module's actual security boundary; finer-grained RBAC would be
layered on by registering a `"bookings"` resource in the permission registry later. Every
mutation writes a `BookingTimeline` row attributed to the acting member.

### Admin cancellation & refunds

- `adminPreviewCancellation(bookingId)` → `previewCancellation()` **without owner scoping**
  (a customer can only preview their own; an admin any). Returns the refund percentage, the
  refundable amount and the cancellation fee resolved from the applicable policy.
- `adminCancelBooking(bookingId, reason?)` → `cancelBooking()`. Idempotent: an
  already-cancelled booking returns `alreadyCancelled` rather than double-refunding. On a
  genuine cancellation it writes a timeline entry with action `REFUND_INITIATED` (or
  `STATUS_CHANGED` when nothing is refundable), recording the percentage, refund and fee in
  the note.

Money is formatted with `formatPaiseRoundedUp` from `app/lib/money.ts` — the dashboard
never does float arithmetic on amounts.

### Fulfilment panel

`setItemFulfillment({ bookingId, kind, day, activityId?, status, voucherUrl? })` where
`kind ∈ HOTEL | TRANSFER | ACTIVITY` and `status ∈ IN_PROCESS | CONFIRMED | UNAVAILABLE`.

The important behaviour: **rows are created from the price snapshot on first write.** The
booking's `priceSnapshot` is the source of truth for what was sold, so the first time an
item is touched, the corresponding `BookingHotel` / `BookingCab` / `BookingActivity` row is
upserted with the snapshot's own hotel id, room name, room count, rate and totals, plus
check-in/out dates derived as `startDate + (day - 1) days`.

Owner notifications fire only on the real *not-confirmed → confirmed* transition, not on
every later re-save (e.g. attaching a voucher URL to an already-confirmed stay). Unique keys
are `(bookingId, dayNumber)` for hotels, `(bookingId, legNumber)` for cabs and
`(bookingId, dayNumber, activityId)` for activities.

When an item can't be delivered, `getReplacementCandidates(...)` finds alternatives and
`proposeReplacement(...)` records a `ReplacementOffer` for the customer to accept — see
[`../booking/booking-system-phase*.md`](../booking/) for the customer half of that flow.

Overall progress is computed by `app/services/fulfillment/status.service.ts`
(`getBookingFulfillment`), and changes are pushed to the guest via
`notifyFulfillmentChange`.

---

## 2. Upcoming Guests — `/dashboard/upcoming-guests`

A pre-travel checklist for everyone departing within **7 days**
(`DAYS_AHEAD = 7`, from local midnight today).

```ts
where = {
  startDate:     { gte: todayStart, lte: windowEnd },
  paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
  status:        { notIn: ["CANCELLED", "COMPLETED", "REJECTED"] },
}
```

Deliberately **not** filtered by verification progress: a booking still stuck mid-hotel-
verification three days before departure is exactly what this page exists to surface.

**"Needs attention"** = at least one `BookingHotel` or `BookingCab` that is `isConfirmed`
but has `reconfirmedAt: null` — i.e. booked with the vendor but not re-checked before
travel. The stat is computed across the whole filtered set, not just the current page, so
pagination can't make it lie.

`toggleHotelReconfirmed(...)` / `toggleCabReconfirmed(...)` (in `upcoming-guests/actions.ts`)
stamp or clear `reconfirmedAt` per leg from the detail page's `ReconfirmButton`.

Search spans booking number, contact email/phone, the account holder's name and any
traveller's full name.

---

## 3. Manual Documents — `/dashboard/manual-documents`

Invoices and vouchers raised **by hand**, for services that never went through the online
booking flow (an offline package, a walk-in hotel stay, a corrected bill).

```prisma
model ManualDocument {
  id             String @id @default(cuid())
  type           ManualDocumentType   // INVOICE | VOUCHER
  documentNumber String @unique       // MINV-2026-0001 / MVCH-2026-0001
  issueDate      DateTime             // the date printed — not createdAt
  guestName      String
  guestContact   String?
  title          String
  startDate, endDate  DateTime?
  travellers     Int  @default(1)
  totalAmount_paise Int @default(0)   // invoice grand total; 0 on a voucher
  payload        Json                 // the document body, discriminated by `type`
  notes          String?              // internal only, never printed
  createdById, createdByName, updatedByName
  @@index([type, issueDate])
  @@map("manual_documents")
}
```

### Why the body is JSON

Nothing joins to a manual voucher's day rows. Normalising them would cost six tables that
are only ever read back together as a whole document. The scalar columns beside the payload
exist so the list can search, sort and total without parsing every blob.

Payload shapes are validated by a discriminated union in
[`app/lib/manual-documents.ts`](../../app/lib/manual-documents.ts):

- **Invoice** — `serviceType`, `gstStateCode`, `gstPct` (0–28), `amountsIncludeGst`,
  at least one line item, optional payments received, and a terms list.
  `amountsIncludeGst` defaults to **false**: ops typing by hand usually has the pre-tax
  figure and wants GST added on top, whereas the automatic invoice always back-computes from
  a tax-inclusive quote total. Both directions must be enterable.
  `computeInvoiceTotals()` is shared by the editor's live totals strip and the saved
  document — one implementation, so the number on screen can't disagree with the number on
  paper.
- **Voucher** — `isPackage` gates three sections (day-by-day table, inclusions/exclusions,
  policies). `isPackage: false` produces the hotel-booking voucher: an accommodation table
  and nothing else, which is the right document for a stay arranged with no itinerary.

### Numbering

`nextDocumentNumber(type, year)` reads the highest number in that type's series for the
issue year and adds one. It is a **read-then-write**, so two concurrent saves can compute
the same number — which is why `documentNumber` is `@unique` and `createManualDocument`
retries up to **three** times on a `P2002` collision, recomputing each time. Anything other
than P2002 fails immediately rather than spinning.

A sequence table would be airtight but would hand numbers to abandoned drafts, leaving
visible gaps in a series that ops would have to explain to an auditor.

### Editing

`updateManualDocument` refuses to change a document's `type`: the number is the document's
identity on paper and a guest may already be holding it — an invoice cannot become a voucher
under the same number. Validation errors are flattened from nested zod paths
(`payload.lines.0.label`) into readable keys so the editor can show the error next to the
row that caused it.

`[id]/print/page.tsx` renders the print view (the dashboard layout's `no-print` class is
what hides the chrome there).

---

## 4. Transactions — `/dashboard/transactions`

A flat view of every `Payment` row, filterable by `status`, `purpose`
(`INITIAL` / `TOPUP` / `BALANCE`) and `gateway` (`RAZORPAY`, `PAYU`, `OFFLINE`, `PHONEPE`),
with search across gateway payment/order id, booking number, contact email and the account
holder's name. All values are whitelisted in `page.tsx` before reaching Prisma.

Two aggregates are computed over the **filtered set** (labelled "in view" in the UI so the
numbers aren't mistaken for global totals):

- **Captured** — sum of `amount_paise` where status ∈ `ADVANCE_PAID`, `FULLY_PAID`,
  `PARTIALLY_REFUNDED`.
- **Refunded** — sum of `refundAmount` where `refundedAt` is set. Note `refundAmount` is a
  `Decimal` in **rupees** while `amount_paise` is an integer in paise; the page converts
  with `Math.round(Number(...) * 100)` before formatting. `Decimal` is also flattened to a
  number before crossing to the client component.

Each row resolves a display name as: the account's `user.name`, falling back to the lead
traveller's `fullName` — accounts created by phone/OTP sign-up often have no name.

The sidebar's **Failed Transactions** and **Refunds** entries have no routes under `(main)`;
failed payments are reachable here via the `FAILED` status filter.

---

## 5. Gotchas

- The price snapshot, not the live catalog, defines what was sold. Fulfilment rows are
  materialised from it — never re-resolve a booked hotel/room from current catalog data.
- `Payment.refundAmount` is rupees (Decimal); `amount_paise` and
  `Booking.totalAmount_paise` are integer paise. Mixing them silently under-reports refunds
  by 100×.
- Cancellation is idempotent but the timeline note is only written on the first real
  cancellation.
- A manual document's `type` is immutable after creation; its `issueDate` (not `createdAt`)
  drives both the printed date and the number series year.
- "Needs attention" on Upcoming Guests keys off `reconfirmedAt`, which is distinct from
  `isConfirmed` — confirmed means booked with the vendor, reconfirmed means re-checked
  before departure.
