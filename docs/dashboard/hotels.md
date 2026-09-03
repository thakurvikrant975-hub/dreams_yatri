# Hotels — the admin side

Everything under the sidebar **Hotels** group, plus the two hotel-facing operational
queues (Verify Hotels, Hotel Requests). Eleven pages in all:

| Page | Purpose |
|---|---|
| `/dashboard/hotels` | master list + full CRUD (6-tab editor) |
| `/dashboard/hotels/overview` | "Hotel Directory" — map/grid view, team contribution breakdown |
| `/dashboard/hotel-inventory` | read-only catalogue view for non-editing staff |
| `/dashboard/expiring-rates` | seasonal rate plans about to lapse |
| `/dashboard/hotel-approvals` | internal manager sign-off on hotel content |
| `/dashboard/property-submissions` | reviewing owner-submitted listings from Hotel Connect |
| `/dashboard/hotel-owners` | Hotel Connect owner accounts |
| `/dashboard/hotels/meal-types`, `/diet-types` | small master tables used by room rate plans |
| `/dashboard/verify-hotels` | per-booking hotel confirmation queue (ops) |
| `/dashboard/hotel-requests` | fill-in queue for custom-package days sales couldn't source |
| `/dashboard/hotel-bookings` | direct (non-package) hotel bookings |

The **owner-facing** side of the same data (`/hotel-connect`) is documented separately in
[`../hotel-connect/hotel-connect-dashboard.md`](../hotel-connect/hotel-connect-dashboard.md);
the per-date availability ledger and channel sync live in
[`../channel-management/`](../channel-management/).

---

## 1. The `hotels` table

`hotels` is by far the widest model in the schema (~170 columns) because three different
products write to it:

1. **Admin/ops columns** — the original set: `name`, `slug`, `destination_id`,
   `location_id`, address block, `category`, `stay_type`, check-in/out times,
   `margin_percentage`, `gst_percentage`, `b2b_email`, `is_active`.
2. **Hotel-Connect wizard columns** — everything the owner onboarding wizard collects:
   `property_category` / `property_sub_type`, star rating, amenities JSON, ~40 policy
   booleans (pets, unmarried couples, smoking, extra beds…), homestay-specific `hs_*`
   fields, finance/legal fields (`bank_*`, `gstin_number`, `pan_number`,
   `property_documents`), and `wizard_step`.
3. **Review columns** — two *independent* review tracks, §3.

```prisma
model hotels {
  id                Int      @id @default(autoincrement())
  name              String
  slug              String   @unique
  destination_id    Int?     // marketing hierarchy
  location_id       BigInt?  // operational gazetteer
  category          String?  // see hotels/constants.ts
  stay_type         String?
  margin_percentage Decimal  @default(10) @db.Decimal(5, 2)
  gst_percentage    Decimal  @default(18) @db.Decimal(5, 2)
  is_active         Boolean  @default(true)
  owner_id          String?  // → HotelOwner; null = ops-managed only

  // Owner-submission track
  listing_status    HotelListingStatus @default(DRAFT)
  submitted_at      DateTime?
  approved_at       DateTime?
  approved_by_id    String?
  rejection_reason  String?

  // Internal QC track
  approval_status         HotelApprovalStatus @default(PENDING)
  approval_notes          String?
  approval_flags          String[]  @default([])
  approval_reviewed_at    DateTime?
  approval_reviewed_by_id String?
  …
}
```

Two trigram GIN indexes exist on `name` and `city` so the `ILIKE '%term%'` searches used by
Expiring Rates, Hotel Inventory and the package-builder hotel picker use an index instead
of scanning the table. `hotel_rooms.name` has one too.

### Child tables

```
hotels
├─ hotel_image_categories  → hotel_images        (gallery, grouped into named categories)
├─ hotel_rooms                                    (room types; unique per (hotel_id, slug))
│   ├─ hotel_room_images
│   ├─ hotel_room_pricing                         ("rate plan": room × meal plan × diet)
│   │   ├─ hotel_room_occupancy_prices            (per-occupancy overrides, unique per occupancy)
│   │   └─ hotel_room_pricing_season              (date-bounded overrides)
│   │        └─ hotel_room_pricing_season_occupancy
│   └─ hotel_room_availability                    (per-date ARI ledger — channel mgmt)
├─ hotel_meal_pricing → hotel_meal_pricing_season
├─ hotel_addons       → hotel_addon_seasons
└─ hotel_child_policies
```

### Rate resolution

The nightly rate for a stay is resolved in this precedence order:

1. `hotel_room_availability.price_override` for that exact date, when set.
2. The matching `hotel_room_pricing_season` (date within `valid_from..valid_to`) —
   and within it, an occupancy-specific row if one exists for the party size, else the
   season's `price_per_night`. Weekend nights use `weekend_price_per_night` when set.
3. Otherwise the parent `hotel_room_pricing` — again occupancy row first, then
   `price_per_night` / `weekend_price_per_night`.

Extras stack on top: `extra_bed_rate` / `extra_child_rate` (both overridable per season),
meal charges from `hotel_meal_pricing` (+ its seasons), `hotel_addons` (+ seasons), and
`hotel_child_policies` for age-banded child charging. `margin_percentage` and
`gst_percentage` are applied by the pricing engine, not stored on the resolved line.

Availability itself is `stop_sell ? 0 : max(0, total_units - booked_units)`, further
restricted by `min_los` / `max_los`, `min_advance_days` / `max_advance_days`,
`closed_to_arrival` / `closed_to_departure`, and the room's own `is_bookable`.
`hotel_rooms.is_active` is a **soft-delete** flag; `is_bookable` is the owner's
"open for sale" switch — they are not interchangeable.

---

## 2. Hotels list & editor — `/dashboard/hotels`

Files: [`(main)/hotels/`](<../../app/(dashboard)/dashboard/(main)/hotels/>) — `actions.ts`
is ~2,500 lines and backs this page, the inventory page, the detail page, and the meal/diet
master tables.

### List

`getHotels({ page, limit, search, destination, category, status, approval })`. Search spans
the hotel's own name/city/state/country **and** the linked `Location`'s name and its
city/state/country names. Rows are selected through a `SAFE_HOTEL_SCALARS` projection
(rather than `include`), `Decimal` margin/GST are cast to numbers, and `created_by` /
`updated_by` / `approval_reviewed_by_id` are resolved to team-member names. Stats: total,
active, total rooms across all hotels, approved, and pending-approval counts.

### Create

`hotels/new/HotelCreateForm.tsx` + `RoomPricingSection.tsx` — a single form that creates the
hotel and optionally its first room and rate plan. `HotelSchema` (zod) is notable for its
phone handling: a bare dial code like `"+91"` with no subscriber number is preprocessed to
`""` and then to `null`, and `whatsapp_number` must match full international format
`+[1-9]\d{6,14}`. `meta_title` ≤ 60, `meta_desc` ≤ 160.

### Editor tabs — `/dashboard/hotels/[id]`

One `getHotelById(id)` call feeds all six tabs; the page serialises every `Decimal` to a
`number` before crossing to client components (Prisma `Decimal` instances can't be passed
through the RSC boundary).

| Tab | What it edits |
|---|---|
| **Details** | identity, destination/location, address, contacts, times, margin/GST, SEO (`updateHotelDetails`, `updateHotelSeo`) |
| **Rooms** | `hotel_rooms` — occupancy, beds, amenity/feature JSON blobs, room images |
| **Pricing** | rate plans, occupancy prices, seasons — the densest tab (~1,700 lines) |
| **Meals & Add-ons** | `hotel_meal_pricing` + seasons, `hotel_addons` + seasons |
| **Child Policies** | `hotel_child_policies` age bands and charge types |
| **Images** | `hotel_image_categories` and `hotel_images`, primary selection |

Pricing offers both granular actions (`createRoomPricing`, `upsertOccupancyPrice`,
`createPricingSeason`, …) and composite ones — `createRoomPricingWithSeasons`,
`updateRoomPricingWithSeasons`, `updatePricingSeasonsOnly` — which write a plan and its full
season set in one transaction. Same pattern as activities: composite for the tab's Save
button, granular for inline edits.

### Delete

`deleteHotel` refuses when `packageBookings` exist, then removes all R2 objects (hotel
thumbnail, gallery, and every room image), then deletes images → image categories → room
images → room pricing → rooms → hotel in one `$transaction`. A residual FK violation
(`P2003`) is caught and reported with the offending field name rather than a raw Prisma
error.

### Migrate to Hotel Connect

`migrateHotelToHotelConnect(id, { ownerEmail, ownerName, propertyCategory, propertySubType })`
hands an ops-created hotel over to an owner account:

1. Refuses if the hotel already has an `owner_id`, or if **another hotel with the same
   name** is already migrated (ops data contains genuine duplicate rows for one physical
   property).
2. Reuses an existing `HotelOwner` by email, or creates one with a random never-sent
   placeholder password, `email_verified: true`, and a 7-day `password_reset_token`;
   a welcome email with the reset link goes out via Resend (best-effort).
3. Sets `owner_id`, `property_category`, `property_sub_type` and `wizard_step` to the
   category's tab count — **without touching `listing_status`**. The hotel stays `DRAFT`;
   going live still requires the owner to submit through the normal review flow.
4. Best-effort enrichment (each wrapped in its own try/catch so it can't fail the
   migration): converts image categories to owner-side tags, back-fills room fields, and
   converts child policies.

---

## 3. Two review tracks — and why they are separate

| | Property Submissions | Hotel Approvals |
|---|---|---|
| Column | `listing_status` | `approval_status` |
| Who initiates | the **owner**, by submitting the wizard | nobody — every hotel starts `PENDING` |
| Applies to | only hotels with an `owner_id` | **every** hotel, however created |
| Gates visibility? | yes — only `LIVE` listings sell | **no** — a `PENDING` hotel still sells |
| States | `DRAFT → SUBMITTED → UNDER_REVIEW → LIVE / REJECTED` (`APPROVED` exists but the flow jumps to `LIVE`) | `PENDING → APPROVED / CHANGES_REQUESTED` |

### 3.1 Property Submissions — `/dashboard/property-submissions`

- `startReview(hotelId)` — an `updateMany` guarded on `listing_status: "SUBMITTED"`, so
  opening the page claims the submission into `UNDER_REVIEW` exactly once and concurrent
  opens are harmless.
- `approveSubmission(hotelId)` — only from `SUBMITTED` or `UNDER_REVIEW`; sets `LIVE`,
  stamps `approved_at` / `approved_by_id`, clears `rejection_reason`, **and** mirrors the
  verdict into the internal track (`approval_status: APPROVED`) so the same content isn't
  queued for review twice.
- `rejectSubmission(hotelId, reason)` — requires a reason of ≥ 10 characters; sets
  `REJECTED` + `rejection_reason`, and mirrors to `approval_status: CHANGES_REQUESTED`.

Audit entity: `"hotel_submission"`.

### 3.2 Hotel Approvals — `/dashboard/hotel-approvals`

An internal content-QC queue. The interesting part is
[`approval-checklist.ts`](<../../app/(dashboard)/dashboard/(main)/hotel-approvals/approval-checklist.ts>):
a **pure, import-free** module (safe on both sides of the RSC boundary) that turns a hotel
into a list of `ChecklistItem`s across nine sections — `basics`, `location`, `contact`,
`rooms`, `pricing`, `images`, `policies`, `commercials`, `seo`. Each item is `required` or
nice-to-have; required items drive the readiness percentage shown on the list, the review
page and the hotels table. Thresholds: `MIN_HOTEL_PHOTOS = 5`,
`MIN_DESCRIPTION_CHARS = 120`. Failing items carry a `detail` string naming exactly what's
missing (e.g. rooms with no rates, rooms with no photos).

Nothing in the checklist blocks anything — a manager can approve a hotel with open issues.

Decisions:

- `approveHotel(hotelId, note)` — rejects if already `APPROVED`; note trimmed to 1,000
  chars; clears `approval_flags`.
- `requestHotelChanges(hotelId, notes, flags)` — requires ≥ 10 chars of notes; `flags` are
  sanitised against the nine valid section keys and deduped, so the UI can highlight
  exactly the sections that need work. Logged with `status: "REJECTED"`.
- `reopenHotelApproval(hotelId)` — puts a decided hotel back to `PENDING` and clears the
  reviewer stamps.

---

## 4. Hotel Directory — `/dashboard/hotels/overview`

`getAllHotelsForOverview()` returns every hotel with a flattened `lat`/`lng`, preferring the
linked `Location`'s coordinates and falling back to the destination's. The raw relations are
dropped rather than spread, because their `Decimal` coordinates would otherwise cross the
RSC boundary.

`getHotelTeamBreakdown()` (the "Hotel Team" sheet) joins the full active-member roster
against a `groupBy(created_by)` over hotels, so members with **zero** hotels still appear —
sorted by count desc, then name. Each row shows role, hotel count and last-added date.

---

## 5. Hotel Inventory — `/dashboard/hotel-inventory`

A read-only lens over the same `getHotels()` data — list with search/status filters and a
detail page (`hotel-inventory/[id]`) that renders identity, contacts, check-in/out times
formatted to 12-hour, rooms with their rate plans, and the gallery. No mutations at all.
It exists so roles that shouldn't edit the catalogue can still look things up; access is
controlled by giving the role `/dashboard/hotel-inventory` in `pageAccess` but not
`/dashboard/hotels`.

---

## 6. Expiring Rates — `/dashboard/expiring-rates`

Surfaces rate plans whose seasonal coverage is about to run out, so someone renegotiates
before the hotel silently falls back to base rate.

The core subtlety is **plan-level expiry**. A `hotel_room_pricing` plan may carry several
seasons (Winter / Summer / Peak); it doesn't actually lapse until the *last* one ends. The
query is raw SQL with a CTE computing `MAX(valid_to)` per `pricing_id`, then
`DISTINCT ON (pricing_id)` to pick the single season that carries that max date (ties
collapsed deterministically by `s.id`):

```sql
WITH plan_expiry AS (
  SELECT s.pricing_id, MAX(s.valid_to) AS plan_expiry, COUNT(*)::int AS season_count
  FROM hotel_room_pricing_seasons s
  JOIN hotel_room_pricing p ON p.id = s.pricing_id
  JOIN hotel_rooms r ON r.id = p.room_id
  JOIN hotels h ON h.id = p.hotel_id
  WHERE s.is_active AND p.is_active AND r.is_active AND h.is_active
  GROUP BY s.pricing_id
)
```

Judging expiry per individual season — the earlier behaviour — flagged plans that still had
months of later coverage.

Windows are defined once in `windows.ts` (a plain module, because `actions.ts` is
`"use server"` and may only export async functions) and shared by the action, the page's
searchParams validation and the filter dropdown: `7d`, `15d`, `1m`, `3m`, `6m`, `1y`, `2y`,
`expired`. Filters also include search and `uploadedBy` (the plan's hotel `created_by`).
The composite index `@@index([is_active, valid_to])` on `hotel_room_pricing_seasons` exists
specifically for this page.

---

## 7. Hotel Owners — `/dashboard/hotel-owners`

Admin view of `HotelOwner` accounts (the Hotel Connect side of the house).

```prisma
model HotelOwner {
  id, email @unique, password, name, phone, whatsapp, businessName
  status HotelOwnerStatus @default(PENDING_VERIFICATION)  // PENDING_VERIFICATION | ACTIVE | SUSPENDED | REJECTED
  verifiedAt, verifiedById, lastLoginAt
  email_verified, email_verification_token, password_reset_token, …
  hotels HotelOwner→hotels[]
  @@map("hotel_owners")
}
```

List (`getHotelOwners`) filters by verified/unverified and search; the detail page shows the
owner's properties and account state. `markOwnerVerified` / `unmarkOwnerVerified` stamp
`verifiedAt` / `verifiedById`. Note that only `ACTIVE` owners can sign in to
`/hotel-connect` (enforced in that portal's NextAuth provider).

---

## 8. Meal Types & Diet Types

Two intentionally tiny master tables, edited inline from
`/dashboard/hotels/meal-types` and `/dashboard/hotels/diet-types`:

```prisma
model meal_types { id, name @unique, covered_meals String[], hotelRoomPricings … }
model diet_types { id, name @unique, hotelRoomPricings … }
```

A meal type (EP / CP / MAP / AP) names which meals it covers; a rate plan
(`hotel_room_pricing`) points at one meal type and one diet type. CRUD lives in
`hotels/actions.ts` (`getMealTypes`, `createMealType`, `updateMealType`, `deleteMealType`,
and the diet-type equivalents).

---

## 9. Verify Hotels — `/dashboard/verify-hotels`

The **ops confirmation queue**: for a confirmed package booking, someone must actually call
each hotel and lock the rooms. This page lists bookings awaiting hotel confirmation and,
per booking, one row per itinerary day that needs a stay.

Helpers: `getRoomsForHotel` / `getRoomsForHotels` (rooms + resolved rates, optionally for a
check-in date), `getMealsForHotels`, and `getRoadDistances` (for picking an alternative
hotel nearby).

`confirmHotelStay(bookingId, dayNumber, hotelId, {...})` is the heart of it:

1. Upserts `BookingHotel` on the `(bookingId, dayNumber)` unique key with
   `isConfirmed: true`, `status: "CONFIRMED"`, `confirmedAt`, `confirmedById`.
2. **Recomputes the booking total.** The baseline is the previously confirmed row's cost,
   or — on first confirmation — the day's hotel total from `Booking.priceSnapshot`. Both
   sides are `Math.ceil`'d to whole rupees *before* subtracting, so the delta can never land
   on a fractional rupee, then applied to `totalAmount_paise` and `balanceAmount_paise`
   (balance floored at 0).
3. Notifies the hotel owner — but only on a genuinely new confirmation or when the hotel
   actually changed, not on every price/notes tweak.
4. Counts confirmed rows against the number of hotel days in the snapshot. When all are
   confirmed and the booking is in `PENDING_REVIEW` or `HOTEL_VERIFICATION`, it transitions
   to `HOTEL_CONFIRMED` (stamping `hotelConfirmedAt`, `hotelAgentName`) and writes a
   `DEPARTMENT_CONFIRMED` timeline entry — in one transaction. Otherwise it writes a
   per-day `NOTE_ADDED` entry.
5. Writes a separate `[PRICE CHANGE]` timeline note whenever the hotel changed or the cost
   moved by ≥ ₹1.
6. Calls `broadcastVerificationCounts()` so the sidebar badges update live — the booking
   leaves the hotel queue and may immediately enter the cab queue.

Booking statuses and the wider flow are documented in
[`../booking/status-tracking.md`](../booking/status-tracking.md).

---

## 10. Hotel Requests — `/dashboard/hotel-requests`

The **sourcing queue**. While building a custom package, a sales exec who can't find a
suitable catalog hotel for a day clicks "Add Hotels by Team", which sets
`custom_itineraries.hotelPending = true`. Those days land here for the hotel team to fill in
manually.

`fillPendingHotel(packageId, day, input)`:

- Requires an active team member; validates a hotel name and a positive B2B price.
- Refuses if the day isn't actually flagged `hotelPending` (guards double-fills).
- Writes the manual stay onto `custom_itineraries`: `accommodation` (`"Hotel — Room"`),
  room specs, one hotel photo and up to **3** room photos, check-in/out, meal plan and the
  `meals` array, `roomsCount`, `manualExtraBeds` + `manualExtraBedRate`,
  `manualHotelPricePerNight`, then clears `hotelPending` and stamps
  `hotelFilledAt` / `hotelFilledById` / `hotelFilledByName` / `hotelFillNote`.
- **Does NOT advance the package.** It used to call `markPackageReady()`, which requires
  the exec who *owns* the package and so never once succeeded from a hotel-team fill.
  Submitting is the exec's own call and a one-way door — once a package is with costing
  they cannot edit it until it comes back — so a filled hotel goes back to them to check.
- Mirrors the day rows onto the recommended stay option (`syncRecommendedStayFromDays`).
  Costing prices from `custom_itinerary_stays`, not from the day rows, so skipping this
  showed the night at ₹0.
- Resolves photo values through `resolveStayPhoto` before writing. Day rows are rendered
  raw everywhere (builder, PDF, client-facing page), so they must hold resolved URLs — a
  bare R2 key silently fails to load. The read paths resolve too, so older rows heal.
- Broadcasts verification counts and revalidates the builder, sales-query, verify-packages
  and hotel-requests routes.
- Never throws: failures come back as `{ success: false, error }`. A thrown server action
  is re-thrown client-side and escapes to the unstyled global error page.

`alsoDays` fills several days from one submit. The v2 queue groups **consecutive** pending
days with the same town and the same request into one card and pre-ticks them; the exec's
request drawer can likewise send one request across several days. Rooms and mattresses are
deliberately *not* shared — those come from each day's own request and can differ per night.

Note `hotelMealPlan` (free text) and `meals` (string array) are different fields: only
`meals` is rendered in the day-wise summary and the itinerary PDF.

A rejected day keeps `hotelPending = true` (it stays in the exec's queue until they
resubmit), so `hotelPending` alone never means "still with the hotel team" — every such
query must also check `hotelRejectedAt: null`. Getting this wrong is what stopped
`getMyUnseenPackageEvents` from ever telling an exec their hotels had been filled.

---

## 11. Hotel Bookings — `/dashboard/hotel-bookings`

Lists **direct** hotel bookings only — `Booking.packageId == null`, i.e. a guest booking a
room straight from a hotel page. It reuses `PackageBookingsTable` for rendering; package
bookings live at `/dashboard/package-bookings`, which lists both kinds. Filters: search,
`payment` (`PaymentStatus`) and `status` (`BookingStatus`), both whitelisted in `page.tsx`.

---

## 12. Gotchas

- `listing_status` and `approval_status` are independent. Approving a submission writes
  both; approving in Hotel Approvals writes only the latter. Neither hides a hotel from
  sale except `listing_status` for owner-managed listings.
- `hotel_rooms.is_active` (soft delete) vs `is_bookable` (open for sale) — check both.
- Rate plan expiry must be computed as `MAX(valid_to)` across a plan's seasons.
- `Decimal` fields must be cast to `number` before crossing to client components; the
  detail page does this exhaustively and new fields must be added there too.
- `deleteHotel` deletes R2 objects before the DB transaction — a failed transaction leaves
  images gone. Deletion is already blocked for hotels used by package bookings.
- `confirmHotelStay` mutates booking money. Any change to its rounding must keep both sides
  of the delta rounded the same way.
