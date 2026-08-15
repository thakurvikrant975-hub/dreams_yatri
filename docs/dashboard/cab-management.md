# Cab Management — vehicles, rates, permits, drivers, and the ops queues

The sidebar **Cab management** group plus `/dashboard/cab-directory` (which sits under
Sales). Files live in [`(main)/(cabs)/`](<../../app/(dashboard)/dashboard/(main)/(cabs)/>)
— the route group doesn't appear in URLs — and in the top-level `cab-inventory`,
`cab-directory`, `verify-cabs` and `assign-driver` folders.

| Page | Purpose |
|---|---|
| `/dashboard/vehicles` | vehicle types (the fleet catalogue) + their generic rate card |
| `/dashboard/cab-pricing` | per-city, per-vehicle rates with seasons |
| `/dashboard/permits` | entry fees / mountain passes, priced per vehicle |
| `/dashboard/cab-drivers` | driver roster, documents, payout details |
| `/dashboard/cab-inventory` | read-only vehicle catalogue |
| `/dashboard/cab-directory` | read-only driver directory for sales |
| `/dashboard/verify-cabs` | per-booking cab confirmation queue (ops) |
| `/dashboard/assign-driver` | assigning a named driver to each confirmed leg |

---

## 1. Data model

```
vehicles  (a vehicle *type*: "Innova Crysta 6+1", not a physical car)
 ├─ vehicle_rates          generic rate card (PER_KM | FLAT_TRIP | PER_DAY)
 ├─ cab_pricing            per-location rate  ─ unique(destination_id, vehicle_id)
 │    └─ cab_pricing_season   date-bounded weekday/weekend override
 ├─ permit_vehicle_rates   per-vehicle permit charge ─ unique(permit_id, vehicle_id)
 ├─ cab_drivers            drivers assigned to this vehicle type
 ├─ itinerary_transfers    package day transfers using this vehicle
 └─ package_cab_types      cab options offered on a package
```

```prisma
model vehicles {
  id                 Int         @id @default(autoincrement())
  name               String
  type               VehicleType // HATCHBACK SEDAN SUV LUXURY_SEDAN LUXURY_SUV TEMPO_TRAVELLER MINI_BUS BUS Rikshaw
  passenger_capacity Int
  luggage_bags       Int         @default(0)
  has_ac             Boolean     @default(false)
  fuel_type          FuelType?   // PETROL DIESEL CNG ELECTRIC HYBRID
  image_key          String?
  is_active          Boolean     @default(true)
}

model vehicle_rates {
  vehicle_id Int
  label      String
  rate_type  VehicleRateType   // PER_KM | FLAT_TRIP | PER_DAY
  price      Decimal @db.Decimal(10, 2)
  cost_price Decimal? @db.Decimal(10, 2)
  is_active  Boolean @default(true)
  @@index([vehicle_id, is_active])
}

model cab_pricing {
  destination_id Int?           // legacy pointer
  location_id    BigInt?        // current pointer — a CITY Location
  vehicle_id     Int
  price          Decimal        @db.Decimal(10, 2)
  cost_price     Decimal?       @db.Decimal(10, 2)
  pricing_type   CabPricingType @default(PER_DAY)   // PER_DAY | PER_KM
  seasons        cab_pricing_season[]
  @@unique([destination_id, vehicle_id])
  @@map("cab_pricings")
}

model cab_pricing_season {
  pricing_id    Int
  pricing_type  CabPricingType @default(PER_DAY)
  valid_from    DateTime
  valid_to      DateTime
  weekday_price Decimal  @db.Decimal(10, 2)
  weekday_cost  Decimal?
  weekend_price Decimal?
  weekend_cost  Decimal?
  season_name   String?
  color         String?
  @@map("cab_pricing_seasons")
}
```

**Two location pointers, one unique constraint.** `cab_pricing` still carries the older
`destination_id` and a `@@unique([destination_id, vehicle_id])`, but the admin page now
works entirely off `location_id` (a `CITY`-type `Location`) — and there is **no** unique
constraint on `(location_id, vehicle_id)`. That missing constraint is why
`moveCabPricingLocation` has to check for collisions in application code (§3).

`transfer_routes` (pickup/drop pair with distance and duration) and `itinerary_transfers`
belong to the package itinerary builder and are documented in
[`../packages/admin-package-itinerary-builder.md`](../packages/admin-package-itinerary-builder.md).

---

## 2. Vehicle Types — `/dashboard/vehicles`

A single-page CRUD (`VehiclesClient.tsx`, ~700 lines) over `vehicles` plus their
`vehicle_rates`. Actions: `getVehiclesWithRates`, `createVehicle`, `updateVehicle`,
`toggleVehicleActive`, `deleteVehicle`, and `createVehicleRate` / `updateVehicleRate` /
`deleteVehicleRate`.

`vehicle_rates` is the **generic** rate card — used where no city-specific rate exists.
`cab_pricing` is the city-specific one and takes precedence in the pricing engine.

`deleteVehicle` explicitly counts `cab_pricing` rows and refuses with the count if any
exist. `vehicle_rates` and `permit_vehicle_rates` cascade; every other reference
(`cab_drivers`, `itinerary_transfers`, `package_cab_types`) is only caught by the FK
constraint, so those surface as the generic *"Failed to delete vehicle"* rather than a
message naming what is blocking it.

`/dashboard/cab-inventory` is the read-only counterpart of this page (same data, no
mutations) for roles that shouldn't edit the fleet.

---

## 3. Cab Pricing — `/dashboard/cab-pricing`

The page presents **one card per city**, not per row. `getCabPricings` fetches every
`cab_pricing` row that has a `location_id`, groups them in memory by location, and returns
a `CabPricingGroup` per city containing every vehicle entry, its seasons, counts
(`active_count`, `total_count`, `season_count`) and the newest `updated_at` / `updated_by`
across the group. Filtering by status and pagination both happen **in memory** after
grouping, since the row count is small and the grouping can't be expressed as a single
paginated query.

### Saving

`upsertCabPricingForCity(cityLocationId, cityName, entries)` — used when adding a new city;
`_getOrCreateCityLocation` resolves or creates the `Location` first.
`upsertCabPricingForLocation(locationId, entries)` — used by the edit sheet, where the
location already exists.

Both funnel into `_performUpsert`, which in one `$transaction`, per vehicle entry:

1. Finds an existing `cab_pricing` row for `(location_id, vehicle_id)` and updates it, or
   creates one.
2. `deleteMany`s that row's seasons and recreates them from the input.

So seasons are **replaced wholesale on every save** — their ids are not stable. One audit
entry is written per save against entity `"CabPricing"` with the location id as `entityId`
(that's also what `getCabPricingHistory(locationId)` reads back), carrying the vehicle and
season counts.

### Moving a city

`moveCabPricingLocation(oldLocationId, newLocationId, newLocationName)` moves **all** rows
of the group together, because a city card is the unit users think in. It refuses when the
destination city already has pricing for any of the same vehicles — with no unique
constraint to catch a collision, a silent merge would orphan one side's rates.

Other actions: `toggleCabPricingActive`, `deleteCabPricingForLocation`,
`searchCityLocations(query, excludeAlreadyPriced)` for the city picker, and
`getActiveVehicles` for the vehicle picker.

---

## 4. Permits — `/dashboard/permits`

```prisma
model permits {
  name              String
  category          PermitCategory     @default(OTHER)  // ENTRY_FEE MOUNTAIN_PASS WILDLIFE BORDER_AREA NATIONAL_PARK FOREST OTHER
  custom_category   String?
  location_id       BigInt?            // → Location, onDelete: SetNull
  issuing_authority String?
  validity_type     PermitValidityType @default(SINGLE_TRIP)  // SINGLE_TRIP | PER_DAY | MULTI_DAY
  validity_days     Int?
  notes             String?
  is_active         Boolean @default(true)
  // legacy, see below
  price_per_vehicle Decimal  @default(0) @db.Decimal(10, 2)
  price_per_person  Decimal? @db.Decimal(10, 2)
  vehicleRates      permit_vehicle_rates[]
}

model permit_vehicle_rates {
  permit_id         Int
  vehicle_id        Int
  price_per_vehicle Decimal  @db.Decimal(10, 2)
  price_per_km      Decimal?
  @@unique([permit_id, vehicle_id])
}
```

**The two flat price columns on `permits` are legacy.** They're kept only because the older
catalog-package pricing engine still reads them directly; the admin page no longer collects
them and always writes `0` / `null`. Current pricing lives in `permit_vehicle_rates`, one
row per vehicle type — a mountain pass like Rohtang charges a different flat amount for an
SUV than a bus, with an optional `price_per_km` for permits that scale with distance.

The vehicle picker (`VehicleRatesPicker.tsx`) is helped by two actions:
`getCabPricingCities` returns cities that already have cab pricing, ranked by
`haversineKm()` straight-line distance from the permit's location (an approximation, not a
driving distance), and `getVehiclesForCabPricingCities(cityKeys)` returns the vehicle types
actually priced in those cities — so you're offered the vehicles that plausibly drive
through the permit area rather than the whole fleet.

---

## 5. Cab Drivers — `/dashboard/cab-drivers`

```prisma
model cab_drivers {
  name, mobile, mobile_secondary, profile_image_key, city, state
  vehicle_id          Int?      // the vehicle type they drive
  license_number, license_expiry, license_image_key
  vehicle_reg_number, vehicle_reg_expiry, insurance_expiry
  vehicle_image_keys  String[]
  bank_name, bank_account_number, bank_ifsc, bank_account_holder, upi_id
  salary_type         SalaryType?   // FIXED_MONTHLY | PER_TRIP | PER_DAY | COMMISSION
  salary_amount       Decimal?
  is_active           Boolean @default(true)
  is_verified         Boolean @default(false)
  avg_rating          Decimal? @db.Decimal(3, 2)
  rating_count        Int      @default(0)
}
```

The roster holds compliance documents (licence, registration, insurance — each with an
expiry date so the UI can flag lapses), payout details and a verification flag.
`toggleDriverVerified` is separate from `toggleDriverActive`: verified is a vetting state,
active is availability. `getCabPricingRateForDriver` looks up what the driver's vehicle type
costs in a given city, so a dispatcher can see the applicable rate while assigning.

`/dashboard/cab-directory` is the read-only lens on the same roster, aimed at sales staff
who need a driver's contact details but shouldn't edit the record.

---

## 6. Verify Cabs — `/dashboard/verify-cabs`

The cab equivalent of Verify Hotels: for each confirmed booking, ops confirms every
transfer leg. A booking normally reaches this queue only after
`HOTEL_CONFIRMED` (the hotel queue's status filter excludes it until then).

`confirmCabLeg(bookingId, legNumber, {...})`:

1. Validates that the booking's `priceSnapshot` actually has a transfer on that day.
2. **Derives the baseline cost carefully.** A `cab_segments` entry in the snapshot covers a
   *range* of days behind one vehicle, and `seg.total` is the whole segment's cost — so it
   is divided by the segment's day span before being used as a single leg's baseline.
   Without that split, the first confirmation of a multi-day segment would apply the whole
   segment cost as a one-day delta.
3. Rounds both the new cost and the baseline up to whole rupees before subtracting, so
   `totalAmount_paise` / `balanceAmount_paise` can never land on a fractional rupee — the
   same discipline as `confirmHotelStay`.
4. Upserts `BookingCab` on `(bookingId, legNumber)` with driver name/phone/vehicle number,
   `isConfirmed`, `status: "CONFIRMED"`, `confirmedAt`, `confirmedById`.
5. Records the vehicle name on **every** confirm, not only when it changes — otherwise a
   re-confirm would erase what the customer status page compares against the planned
   vehicle. A "Change Cab" pick is folded into `notes` (there is no dedicated column for it)
   and written to the booking timeline.
6. When every transfer day is confirmed and the booking is in `CAB_VERIFICATION` or
   `HOTEL_CONFIRMED`, transitions it to `CAB_CONFIRMED` with `cabConfirmedAt` /
   `cabAgentName` and a timeline entry, in one transaction.

`confirmAllCabLegs` is the bulk version used by `BulkCabConfirmPanel`.
`getVehicleOptionsForDestination` / `searchVehicleOptionsByCity` back the
`VehiclePickerModal`, returning vehicles with their resolved city rate.

---

## 7. Assign Driver — `/dashboard/assign-driver`

Once legs are confirmed, this page attaches a **named driver** to them. Two panels:
`QuickAssignPanel` (one driver for the whole trip) and `LegDriverPicker` (per leg).

`_assignDriver(bookingId, legs, driver, …)` upserts each `BookingCab` leg by
`(bookingId, legNumber)`, computing `transferDate` as `startDate + (legNumber - 1) days` and
taking `capacity` from the matching snapshot `cab_segment` (default 4). Rows created here
are written with `ratePerCab: 0, totalCost: 0` — assignment is a dispatch action, not a
pricing one, so it deliberately does not touch booking totals.

It then counts legs with a `driverName` against the number of snapshot days that have
transfers, and — when all are covered and the booking is in `CAB_VERIFICATION` or
`HOTEL_CONFIRMED` — moves it to `CAB_CONFIRMED` with a timeline entry, mirroring
`confirmCabLeg`.

---

## 8. Gotchas

- `cab_pricing` has a unique constraint on `(destination_id, vehicle_id)` but the app keys
  off `location_id`, which has **no** unique constraint. Application code must check for
  duplicates itself (as `moveCabPricingLocation` does).
- Seasons are deleted and recreated on every cab-pricing save; ids churn.
- `permits.price_per_vehicle` / `price_per_person` are legacy zeros — read
  `permit_vehicle_rates` instead.
- `VehicleType` (used by `vehicles`) and `CabType` (used by `Booking`/`BookingCab`) are
  **different enums** with overlapping but non-identical members.
- Assign-driver writes zero costs; only `confirmCabLeg` re-prices a booking.
- A segment's `total` in the price snapshot spans multiple days — always divide by the span
  before treating it as a per-day figure.
