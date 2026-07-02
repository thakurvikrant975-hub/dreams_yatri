# Dreams Yatri — Admin Travel Packages & Itinerary Builder (Reference)

In-depth documentation of the admin/dashboard **travel package** feature: package CRUD,
the **route builder** (durations → routes → stops), the **itinerary builder** (day-by-day
content: stays, activities, transfers, notes, attractions), stay tiers, and the **pricing
engine + calculator preview**. For every server action's full signature/side-effects, see
[`docs/API_REFERENCE.md`](../API_REFERENCE.md) (§ "Packages — CRUD, Pricing, Itinerary,
Cabs, Gallery"). For the high-level data-model index, see
[`docs/PROJECT_OVERVIEW.md`](../PROJECT_OVERVIEW.md) §6.

---

## 1. What this feature does

A **package** (`packages`) is a sellable trip template for a destination. It is not priced
or scheduled directly — it's a matrix of reusable building blocks:

```
package
 └─ duration (e.g. "5D/4N")            — package_durations
     └─ route (e.g. "Manali–Solang–Kasol") — package_routes
         ├─ stops (ordered cities, stay_days each) — route_stops
         └─ itinerary days (1..N)      — package_itineraries
             ├─ hotel stay(s)          — itinerary_stays        → hotel_room_pricing
             ├─ activities             — itinerary_activities   → activities / activity_variants
             ├─ transfers              — itinerary_transfers    → transfer_routes, vehicles
             ├─ notes                  — itinerary_notes
             └─ attraction images      — itinerary_attractions
     └─ stay tier (e.g. "Budget"/"Luxury") — package_stay_categories
     └─ pricing config (margin % + GST %) — package_pricing  [duration × stay_category]
     └─ cab types + day-range segments  — package_cab_types / package_cab_segments → cab_pricing
     └─ permits                         — package_permits
```

A single **day** of an itinerary is always scoped to one `(package_id, duration_id,
route_id, day)` tuple — the same physical "Day 3" content differs per route and per
duration, since a 7-day and a 5-day version of the same destination may visit different
places on day 3. Content itself (hotel stay, activities) is further scoped by
**stay tier** for hotels only — activities/transfers/notes are shared across tiers.

Nothing in the itinerary stores a price directly. All money lives in the *source* master
records (`hotel_room_pricing`, `activity_variant_pricing`, `cab_pricing`,
`hotel_meal_pricing`) and is resolved live by the pricing engine (§8) at quote/booking
time, keyed off the selected duration + route + stay tier + travel date + traveller counts.

---

## 2. Data model (Prisma)

All models below are in `prisma/schema.prisma`. Field lists are quoted verbatim.

### 2.1 Core package

```prisma
model packages {
  id              Int                       @id @default(autoincrement())
  title           String
  slug            String                    @unique
  thumbnail       String?
  description     String?
  destination_id  Int
  inclusions      String[]
  exclusions      String[]
  is_active       Boolean                   @default(false)
  created_at      DateTime                  @default(now())
  updated_at      DateTime                  @updatedAt
  created_by      String?
  updated_by      String?
  bookings        Booking[]
  cabOptions      package_cab_options[]
  cabTypes        package_cab_types[]
  categories      package_categories[]
  durations       package_durations[]
  gallery         package_gallery[]
  images          package_images[]
  itineraries     package_itineraries[]
  permits         package_permits[]
  policies        package_policy_map[]
  packagePricings package_pricing[]
  packageRoutes   package_routes[]
  stay_categories package_stay_categories[]
  tags            package_tags[]
  destination     destinations              @relation(fields: [destination_id], references: [id])

  @@index([destination_id, is_active])
  @@index([slug])
}
```
`slug` is globally unique and **immutable after creation** (SEO — see §3.1).
`package_tags` / `package_categories` are join tables to global `tags` / `categories`
(auto-created on first use, upserted by name).

### 2.2 Durations, routes, stops

```prisma
model package_durations {
  id            Int                   @id @default(autoincrement())
  package_id    Int
  slug          String
  label         String
  days          Int
  nights        Int
  is_default    Boolean               @default(false)
  sort_order    Int                   @default(0)
  is_active     Boolean               @default(true)
  created_at    DateTime              @default(now())
  updated_at    DateTime              @updatedAt
  thumbnail_url String?
  cabTypes      package_cab_types[]
  package       packages              @relation(fields: [package_id], references: [id])
  itineraries   package_itineraries[]
  permits       package_permits[]
  pricing       package_pricing[]
  routes        package_routes[]

  @@unique([package_id, slug])
  @@index([package_id, is_active])
}

model package_routes {
  id                 Int                   @id @default(autoincrement())
  duration_id        Int
  name               String
  slug               String
  meta_title         String?
  meta_desc          String?
  sort_order         Int                   @default(0)
  is_active          Boolean               @default(true)
  polyline           Json?
  total_distance_km  Float?
  total_duration_min Int?
  packagesId         Int?
  gallery            package_gallery[]
  itineraries        package_itineraries[]
  duration           package_durations     @relation(fields: [duration_id], references: [id], onDelete: Cascade)
  packages           packages?             @relation(fields: [packagesId], references: [id])
  stops              route_stops[]

  @@unique([duration_id, slug])
  @@index([duration_id])
}

model route_stops {
  id          Int            @id @default(autoincrement())
  route_id    Int
  place_name  String
  stay_days   Int
  sort_order  Int            @default(0)
  location_id BigInt?
  location    Location?      @relation(fields: [location_id], references: [id])
  route       package_routes @relation(fields: [route_id], references: [id], onDelete: Cascade)

  @@unique([route_id, sort_order])
  @@index([route_id])
  @@index([location_id])
}
```
A route belongs to exactly one duration (a route is not shared across durations — each
duration defines its own route variants, even if the geography overlaps). `route_stops`
are ordered by `sort_order`; each stop's `stay_days` determines which itinerary days
"belong" to that stop (see `getStopIndex` in `ItineraryBuilderTab.tsx:61`, which walks
stops accumulating `stay_days`, +1 on the last stop for the departure day).

### 2.3 Itinerary day + its child records

```prisma
model package_itineraries {
  id                    Int                     @id @default(autoincrement())
  package_id            Int
  duration_id           Int
  route_id              Int
  day                   Int
  title                 String
  description           String?
  meals                 String[]
  excluded_meals        String[]                @default([])
  itinerary_activities  itinerary_activities[]
  itinerary_attractions itinerary_attractions[]
  itinerary_notes       itinerary_notes[]
  itineraryStays        itinerary_stays[]
  itinerary_transfers   itinerary_transfers[]
  duration              package_durations       @relation(fields: [duration_id], references: [id])
  package               packages                @relation(fields: [package_id], references: [id])
  route                 package_routes          @relation(fields: [route_id], references: [id])

  @@unique([package_id, duration_id, route_id, day])
  @@index([route_id, duration_id])
}

model itinerary_stays {
  id               Int                     @id @default(autoincrement())
  itinerary_id     Int
  stay_category_id Int
  room_pricing_id  Int
  sort_order       Int                     @default(0)
  occupancy        Int                     @default(2)
  rooms_count      Int                     @default(1)
  num_nights       Int                     @default(1)
  active_meals     String[]                @default([])
  itinerary        package_itineraries     @relation(fields: [itinerary_id], references: [id])
  room_pricing     hotel_room_pricing      @relation(fields: [room_pricing_id], references: [id])
  stay_category    package_stay_categories @relation(fields: [stay_category_id], references: [id])

  @@unique([itinerary_id, stay_category_id])
}

model itinerary_activities {
  id           Int                 @id @default(autoincrement())
  itinerary_id Int
  activity_id  Int
  sort_order   Int                 @default(0)
  is_optional  Boolean             @default(false)
  variant_id   Int?
  activity     activities          @relation(fields: [activity_id], references: [id])
  itinerary    package_itineraries @relation(fields: [itinerary_id], references: [id], onDelete: Cascade)
  variant      activity_variants?  @relation(fields: [variant_id], references: [id])

  @@index([itinerary_id, sort_order])
}

model itinerary_transfers {
  id           Int                 @id @default(autoincrement())
  itinerary_id Int
  sort_order   Int                 @default(0)
  notes        String?
  route_id     Int?
  vehicle_id   Int?
  num_vehicles Int                 @default(1)
  itinerary    package_itineraries @relation(fields: [itinerary_id], references: [id], onDelete: Cascade)
  route        transfer_routes?    @relation(fields: [route_id], references: [id])
  vehicle      vehicles?           @relation(fields: [vehicle_id], references: [id])

  @@index([itinerary_id, sort_order])
}

model itinerary_notes {
  id                 Int                 @id @default(autoincrement())
  itinerary_id       Int
  message            String
  type               String              @default("info")
  position           String              @default("bottom")
  optional_link_text String?
  optional_link_url  String?
  sort_order         Int                 @default(0)
  itinerary          package_itineraries @relation(fields: [itinerary_id], references: [id], onDelete: Cascade)

  @@index([itinerary_id, sort_order])
}

model itinerary_attractions {
  id           Int                 @id @default(autoincrement())
  itinerary_id Int
  image_key    String
  caption      String              @default("") @db.VarChar(50)
  sort_order   Int                 @default(0)
  created_at   DateTime            @default(now())
  itinerary    package_itineraries @relation(fields: [itinerary_id], references: [id], onDelete: Cascade)

  @@index([itinerary_id])
}
```

**Key constraint:** `itinerary_stays` is `@@unique([itinerary_id, stay_category_id])` — a
day can have **at most one hotel stay per stay tier**. A multi-night stay is recorded once
(on the check-in day) with `num_nights > 1`; it is *not* duplicated across the nights it
covers — the pricing engine and page loader both propagate it forward via
`stayByDay`/day-range logic instead (§8.3).

`itinerary_notes.type` is a free-form `String`, not a Prisma enum — the allowed values
(`"info" | "warning" | "tip" | "important"`) are enforced only at the zod layer
(`NoteTypeSchema`, §7.1), same for `position` (`"top" | "bottom"`).

### 2.4 Transfers & vehicles

```prisma
model transfer_routes {
  id                 Int                   @id @default(autoincrement())
  pickup_name        String
  pickup_place_id    String?
  pickup_lat         Decimal?              @db.Decimal(10, 7)
  pickup_lng         Decimal?              @db.Decimal(10, 7)
  drop_name          String
  drop_place_id      String?
  drop_lat           Decimal?              @db.Decimal(10, 7)
  drop_lng           Decimal?              @db.Decimal(10, 7)
  distance_km        Decimal?              @db.Decimal(8, 2)
  duration_min       Int?
  created_at         DateTime              @default(now())
  drop_location_id   BigInt?
  pickup_location_id BigInt?
  transfers          itinerary_transfers[]
  drop_location      Location?             @relation("drop_routes", fields: [drop_location_id], references: [id])
  pickup_location    Location?             @relation("pickup_routes", fields: [pickup_location_id], references: [id])

  @@index([pickup_location_id, drop_location_id])
  @@index([pickup_name, drop_name])
}
```
`transfer_routes` rows are **deduplicated by pickup/drop location pair** — adding a
transfer with a pickup/drop combo that already has a route reuses it instead of creating a
new row; a fresh row is only created (with distance/duration auto-computed via the Mapbox
Directions API) when no matching route exists yet.

`vehicles`, `vehicle_rates`, `cab_pricing`, `cab_pricing_season` are the cab masters (see
[`docs/PROJECT_OVERVIEW.md`](../PROJECT_OVERVIEW.md) §6 "Cabs" and the cab-pricing overhaul
noted in project memory) — package-level cab config (`package_cab_types`,
`package_cab_segments`) only *references* them, never stores its own price.

### 2.5 Stay tiers & pricing config

```prisma
model package_stay_categories {
  id                Int               @id @default(autoincrement())
  package_id        Int
  label             String
  description       String?
  min_duration_days Int?
  is_default        Boolean           @default(false)
  sort_order        Int               @default(0)
  is_active         Boolean           @default(true)
  slug              String
  itineraryStays    itinerary_stays[]
  pricing           package_pricing[]
  package           packages          @relation(fields: [package_id], references: [id])

  @@unique([package_id, slug])
  @@index([package_id, is_active])
}

model package_pricing {
  id                Int                     @id @default(autoincrement())
  package_id        Int
  duration_id       Int
  stay_category_id  Int
  gst_percentage    Decimal                 @default(5) @db.Decimal(5, 2)
  margin_percentage Decimal                 @default(10) @db.Decimal(5, 2)
  duration          package_durations       @relation(fields: [duration_id], references: [id])
  package           packages                @relation(fields: [package_id], references: [id])
  stay_category     package_stay_categories @relation(fields: [stay_category_id], references: [id])

  @@unique([package_id, duration_id, stay_category_id])
  @@index([package_id])
}
```
`package_pricing` is a **matrix cell**, one row per `(duration, stay_category)` pair —
it stores only the markup (`margin_percentage`) and tax (`gst_percentage`) for that
combination. Item costs (hotel/activity/cab/meal) are never duplicated here; they're
resolved live from the source masters by `computePackagePrice` (§8).

### 2.6 Cab types, permits, images, gallery, policies

```prisma
model package_cab_types {
  id          Int                    @id @default(autoincrement())
  package_id  Int
  duration_id Int
  vehicle_id  Int
  label       String?
  note        String?
  is_default  Boolean                @default(false)
  is_active   Boolean                @default(true)
  sort_order  Int                    @default(0)
  created_at  DateTime               @default(now())
  updated_at  DateTime               @updatedAt
  segments    package_cab_segments[]
  duration    package_durations      @relation(fields: [duration_id], references: [id], onDelete: Cascade)
  package     packages               @relation(fields: [package_id], references: [id], onDelete: Cascade)
  vehicle     vehicles               @relation(fields: [vehicle_id], references: [id])

  @@unique([package_id, duration_id, vehicle_id])
  @@index([package_id, duration_id])
}

model package_cab_segments {
  id             Int               @id @default(autoincrement())
  cab_type_id    Int
  day_from       Int
  day_to         Int
  cab_pricing_id Int
  sort_order     Int               @default(0)
  cab_pricing    cab_pricing       @relation(fields: [cab_pricing_id], references: [id])
  cab_type       package_cab_types @relation(fields: [cab_type_id], references: [id], onDelete: Cascade)

  @@index([cab_type_id])
  @@map("package_cab_segments")
}

model package_permits {
  id          Int               @id @default(autoincrement())
  package_id  Int
  duration_id Int
  name        String
  price       Decimal           @default(0) @db.Decimal(10, 2)
  is_included Boolean           @default(true)
  sort_order  Int               @default(0)
  created_at  DateTime          @default(now())
  updated_at  DateTime          @updatedAt
  duration    package_durations @relation(fields: [duration_id], references: [id], onDelete: Cascade)
  package     packages          @relation(fields: [package_id], references: [id], onDelete: Cascade)

  @@index([package_id, duration_id])
}

model package_images {
  id         Int      @id @default(autoincrement())
  package_id Int
  url        String
  thumbnail  String?
  alt        String?
  sort_order Int      @default(0)
  is_primary Boolean  @default(false)
  created_at DateTime @default(now())
  package    packages @relation(fields: [package_id], references: [id])

  @@index([package_id])
}

model package_gallery {
  id          Int               @id @default(autoincrement())
  package_id  Int
  image_url   String
  source_type GallerySourceType
  source_id   Int?
  position    Int
  created_at  DateTime          @default(now())
  label       String?
  route_id    Int?
  package     packages          @relation(fields: [package_id], references: [id], onDelete: Cascade)
  route       package_routes?   @relation(fields: [route_id], references: [id], onDelete: Cascade)

  @@index([package_id])
  @@index([route_id])
}

model package_policy_map {
  package_id Int
  policy_id  Int
  package    packages @relation(fields: [package_id], references: [id])
  policy     policies @relation(fields: [policy_id], references: [id])

  @@id([package_id, policy_id])
  @@index([policy_id])
}
```
A `package_cab_type` (one vehicle option for a duration, e.g. "Sedan") owns one or more
`package_cab_segments`, each a `(day_from, day_to)` day-range priced against one
`cab_pricing` master row (vehicle × destination). Multiple cab types can cover the same
day-range — the pricing engine "upgrades" between them at quote time if the selected
vehicle can't fit the traveller count (§8.4). `package_gallery.source_type` distinguishes
where a gallery image originated (package/hotel/activity/room) via the `GallerySourceType`
enum; `route_id` scopes a gallery to one specific route variant.

---

## 3. Admin UI — page & tab map

Route: `app/(dashboard)/dashboard/(main)/packages/`

| Page/Component | Path | Purpose |
|---|---|---|
| List | `packages/page.tsx` + `components/PackagesTableClient.tsx` | Paginated table of all packages |
| Create | `packages/new/page.tsx` | Basic-info-only creation form |
| Edit (tab shell) | `packages/[id]/page.tsx` | Loads the package + renders the tabbed editor below |
| Basic Info | `components/PackageForm.tsx`, `components/InclusionExclusionField.tsx` | Title/slug/destination/inclusions/tags |
| Route Builder | `[id]/RouteBuilderTab.tsx`, `RouteBuilderSidebar.tsx`, `RoutePreviewMap.tsx` | Durations → routes → stops, map preview |
| Itinerary Builder | `[id]/ItineraryBuilderTab.tsx`, `ItineraryDaySidebar.tsx`, `MealsEditor.tsx`, `StayTiersSection.tsx` | Day-by-day content editor |
| Images | `[id]/ImagesTab.tsx` | Package asset pool (source images for gallery/attractions) |
| Gallery | `[id]/GalleryTab.tsx` | Curated public-facing image sequence, per route |
| Policies | `[id]/PoliciesTab.tsx` | Attach cancellation/refund/T&C master policies |
| Pricing | `[id]/PricingTab.tsx` | Margin % / GST % matrix per duration × stay tier |
| Pricing Preview | `[id]/PricingPreviewTab.tsx` | Interactive calculator (calls `computePackagePrice`) |

### 3.1 Basic Info tab
**Component:** `PackageForm.tsx` · **Validator:** `app/validators/package.validator.ts`

```ts
export const createPackageSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  thumbnail: z.string().max(400).optional().or(z.literal("")),
  description: z.string().max(700).optional().or(z.literal("")),
  destination_id: z.number().int().positive(),
  inclusions: z.array(z.string().min(1).max(450)).max(100),
  exclusions: z.array(z.string().min(1).max(450)).max(100),
  tags: z.array(z.string().min(1).max(50)).max(12),
  category: z.array(z.string().min(1).max(100)).max(10),
});
```
Fields: title, slug (auto-slugified from title on create, `regex`-enforced), thumbnail URL,
description, destination (searchable single-select), inclusions/exclusions (repeatable
text rows via `InclusionExclusionField`), tags/categories (multi-select, auto-creates new
names via `createTag`/`createCategory` in `search.actions.ts`).

**Actions** (`app/actions/packages/package.actions.ts`):
- `createPackage(data: createPackagesTypes)` — `package.actions.ts:17`. Validates, calls
  `createPackages` service, logs a `CREATE` audit entry (`createLog`). Returns
  `{ success: false, type: "conflict" }` on slug collision (Prisma `P2002`).
- `updatePackageBasicInfo(id, data)` — `package.actions.ts:72`. **Slug is intentionally
  never re-written** — the current slug is loaded and the submitted value is discarded, to
  preserve SEO. Tags/categories are synced by delete-all-then-recreate inside a
  `db.$transaction`. Logs an `UPDATE` audit entry with before/after diff.

### 3.2 Route Builder tab
**Components:** `RouteBuilderTab.tsx`, `RouteBuilderSidebar.tsx`, `RoutePreviewMap.tsx`
(Leaflet map showing stop pins + polyline)
**Actions:** `app/actions/packages/route-builder.actions.ts`
- `handleGetRouteData(packageId)` — `:15`
- `handleSaveRouteVariant(...)` — `:25` (create/update a route + its ordered stops)
- `handleDeleteRouteVariant(routeId, packageId)` — `:44`
- `handleUpdateRouteMeta(...)` — `:54` (name/slug/meta title/desc)
- `handleUpdateDurationMeta(...)` — `:69` (label/days/nights/default flag)

Admins add durations, then for each duration add one or more route variants, then for each
route add ordered stops with a `stay_days` count. `route_stops.stay_days` is what drives
day-count math in the itinerary builder (§2.2, `getStopIndex`).

### 3.3 Itinerary Builder tab
See §4 (dedicated section — this is the core of the feature).

### 3.4 Images / Gallery / Policies tabs
- **Images** (`ImagesTab.tsx`, `package-image.actions.ts`): upload/reorder/delete/set-primary
  over `package_images` — this is the *asset pool*, not what's shown publicly.
  `handleGetPackageImages`, `handleAddImages`, `handleSetPrimaryImage`,
  `handleReorderImages`, `handleDeleteImage`.
- **Gallery** (`GalleryTab.tsx`, `gallery.actions.ts`): assigns pool images (or
  hotel/activity/room images, via `source_type`) into fixed, ordered `position` slots per
  route — `handleGetPackageGallery`, `handleGetSourceImages`, `handleUpsertGallerySlot`,
  `handleClearGallerySlot`, `handleUpdateGallerySlotLabel`.
- **Policies** (`PoliciesTab.tsx`, `policies.actions.ts`): attach one global `policies`
  record per `type` (cancellation/date-change/etc.) — `searchPoliciesByType`,
  `setPackagePolicy`, `removePackagePolicy`. Policies are master records edited elsewhere;
  this tab only maps them onto the package via `package_policy_map`.
- **Permits** (surfaced inside Route Builder / Pricing context, `permit.actions.ts`):
  `createPackagePermit`, `updatePackagePermit`, `deletePackagePermit` over
  `package_permits`, scoped per duration.

---

## 4. Itinerary Builder — internals

### 4.1 Component tree & state

```
ItineraryBuilderTab (client, "use client")
  props: { packageId, destinationId, durations, stayCategories }
  state: selected durationId / routeId, fetched DayData[] (via handleGetItineraryData)
  renders:
    StayTiersSection         — CRUD for package_stay_categories
    grid of day cards        — one per package_itineraries.day, click opens sidebar
    ItineraryDaySidebar      — the day editor (sheet/drawer)
```
`ItineraryBuilderTab.tsx` (503 lines) fetches all days for the selected
`(packageId, durationId, routeId)` via `handleGetItineraryData` and derives, per day, which
route **stop** it belongs to (`getStopIndex`, walks `route_stops` accumulating
`stay_days`, giving the last stop one extra day for the "departure" day) and that stop's
lat/lng (`getStopCoords`), which is used to bias hotel/activity search results toward the
right place.

`ItineraryDaySidebar.tsx` (2,535 lines — the single largest component in the feature) is a
`"use client"` component using local `useState`/`useMemo`/`useCallback` (no global store)
plus **`@dnd-kit/core` + `@dnd-kit/sortable`** (`DndContext`, `useSortable`, `CSS` from
`@dnd-kit/utilities`) for drag-reordering activities/transfers/notes within a day. Every
mutation (add/update/delete/reorder) round-trips through a server action immediately —
there is no separate "save" step for most fields, except meal toggles (see below).

### 4.2 `DayData` shape (`app/services/itinerary-builder.service.ts:124`)

```ts
export type DayData = {
  id: number | null;
  day: number;
  title: string;
  description: string | null;
  meals: string[];
  excluded_meals: string[];
  activities: ActivityItem[];
  transfers: TransferItem[];
  notes: NoteItem[];
  stays: StayItem[];
  attractions: AttractionItem[];
};

export type ActivityItem = {
  id: number; sort_order: number; is_optional: boolean; variant_id: number | null;
  variant: { id: number; name: string } | null;
  activity: { id: number; name: string; category: string | null; duration_hours: number | null; included_meals: string[] };
};

export type TransferItem = {
  id: number; itinerary_id: number; route_id: number | null; vehicle_id: number | null;
  num_vehicles: number; notes: string | null; sort_order: number;
  route: { id: number; pickup_name: string; pickup_location_id: string | null; pickup_location_type: string | null;
    pickup_lat: number | null; pickup_lng: number | null; drop_name: string; drop_location_id: string | null;
    drop_location_type: string | null; drop_lat: number | null; drop_lng: number | null;
    distance_km: number | null; duration_min: number | null } | null;
  vehicle: { id: number; name: string; type: string; passenger_capacity: number } | null;
};

export type StayItem = {
  id: number; stay_category_id: number; sort_order: number; num_nights: number; active_meals: string[];
  room_pricing: {
    id: number; plan_name: string | null; price_per_night: number;
    meal_type: { id: number; name: string; covered_meals: string[] } | null;
    hotel: { id: number; name: string; category: string | null; stay_type: string | null; thumbnail: string | null };
    room: { id: number; name: string; bed_type: string | null; images: { url: string; thumbnail: string | null }[] } | null;
  };
  stay_category: { id: number; label: string; slug: string };
};

export type NoteItem = {
  id: number; itinerary_id: number; message: string; type: string; position: string;
  optional_link_text: string | null; optional_link_url: string | null; sort_order: number;
};

export type AttractionItem = { id: number; itinerary_id: number; image_key: string; caption: string; sort_order: number };
```
`id: number | null` on `DayData` — a day row for `(duration, route, day)` may not exist yet
in `package_itineraries`; it's created on first `handleUpsertDayMeta` call.

### 4.3 Server actions (`app/actions/packages/itinerary-builder.actions.ts`)

All wrap a service function from `app/services/itinerary-builder.service.ts` in a
try/catch returning `{ success: true, ... } | { success: false, message }`, and (except
meal toggles) call `revalidatePath(\`/dashboard/packages/${packageId}\`)`.

| Action | Line | Does |
|---|---|---|
| `handleGetItineraryData(packageId, durationId, routeId)` | 49 | Loads `DayData[]` for the combo |
| `handleUpsertDayMeta(packageId, durationId, routeId, day, {title, description?, meals?, excluded_meals?})` | 59 | Creates/updates the `package_itineraries` row itself |
| `handleAddActivity/UpdateActivity/DeleteActivity` | 88/105/120 | `itinerary_activities` CRUD |
| `handleAddTransfer/UpdateTransfer/DeleteTransfer` | 131/142/153 | `itinerary_transfers` CRUD (dedupes `transfer_routes`, see §2.4) |
| `handleAddNote/UpdateNote/DeleteNote` | 164/175/186 | `itinerary_notes` CRUD |
| `handleUpsertStay(itineraryId, stayCategoryId, roomPricingId, sortOrder, packageId, numNights=1)` | 197 | `itinerary_stays` upsert (unique per stay tier); returns computed `active_meals` |
| `handleDeleteStay` | 215 | — |
| `handleUpdateStayActiveMeals(id, activeMeals[], packageId)` | 226 | **Does NOT call `revalidatePath`** — see note below |
| `handleReorderItems(updates: ReorderItem[], packageId)` | 240 | Bulk `sort_order` update across activities/transfers/notes/stays |
| `handleGetVehicles` | 251 | Active `vehicles` list for the transfer picker |
| `handleSearchActivities(destinationId, query)` | 261 | Typeahead search scoped to destination |
| `handleSearchRoomPricings(destinationId, query, itineraryId?, stayBlockOrder?, stopIndex?)` | 271 | Typeahead room search, location-biased by `stopIndex` |
| `handleGetRoomPricingById(id)` | 287 | Full detail fetch when a room is selected |
| `handleGetStayCategories/CreateStayCategory/UpdateStayCategory/DeleteStayCategory/ReorderStayCategories` | 299–354 | `package_stay_categories` CRUD (delete fails if a tier is referenced by any `itinerary_stays`) |
| `handleGetDaySourceImages(itineraryId, packageId)` | 358 | Candidate images for attractions (from `package_images` pool) |
| `handleAddAttraction/BulkAddAttractions/UpdateAttraction/DeleteAttraction/ReorderAttractions` | 370–435 | `itinerary_attractions` CRUD |
| `handleCheckItineraryDaysContent(packageId, routeId, durationId, fromDay, toDay)` | 437 | Used before shrinking a duration/route's day count, to warn if content would be lost |
| `handleGetHotelMealPricings(hotelId)` | 453 | Meal options for the Meals Editor, scoped to a hotel |

**Deliberate exception, `itinerary-builder.actions.ts:226-232`:**
```ts
export async function handleUpdateStayActiveMeals(id: number, activeMeals: string[], packageId: number) {
  try {
    await updateStayActiveMeals(id, activeMeals);
    // No revalidatePath — meal toggles are managed in client state.
    // revalidatePath would trigger an RSC re-render that remounts the sidebar
    // and reinitializes localPrevStays from stale props, breaking optimistic updates.
    void packageId;
    return { success: true as const };
  } ...
}
```
Meal toggles inside `MealsEditor.tsx` are optimistic-only on the client; skipping
`revalidatePath` here is intentional, not an oversight — keep it that way if touching this
code path.

### 4.4 Meals Editor
**Component:** `MealsEditor.tsx`. Renders one toggle per meal in the selected room plan's
`meal_type.covered_meals` (e.g. `["breakfast", "lunch", "dinner"]`), writing the enabled
subset to `itinerary_stays.active_meals` via `handleUpdateStayActiveMeals`. Meal keys are
normalized lowercase/underscored (`"BREAKFAST"` → `"breakfast"`, `"Morning Snacks"` →
`"morning_snacks"`) for consistent lookup in the pricing engine (§8.2).

---

## 5. Validation (zod)

`app/lib/validators/packages/itinerary.validator.ts`:

```ts
export const AddStaySchema = z.object({
  itinerary_id: z.number().int().positive(),
  stay_category_id: z.number().int().positive("Stay category is required"),
  room_pricing_id: z.number().int().positive("Room pricing is required"),
  sort_order: z.number().int().min(0).default(0),
});

export const AddActivitySchema = z.object({
  itinerary_id: z.number().int().positive(),
  activity_id: z.number().int().positive("Activity is required"),
  sort_order: z.number().int().min(0).default(0),
  is_optional: z.boolean().default(false),
});

export const AddTransferSchema = z.object({
  itinerary_id: z.number().int().positive(),
  pickup_name: z.string().min(1).max(255),
  pickup_place_id: z.string().max(255).optional().nullable(),
  pickup_lat: z.number().optional().nullable(),
  pickup_lng: z.number().optional().nullable(),
  drop_name: z.string().min(1).max(255),
  drop_place_id: z.string().max(255).optional().nullable(),
  drop_lat: z.number().optional().nullable(),
  drop_lng: z.number().optional().nullable(),
  vehicle_id: z.number().int().positive().optional().nullable(),
  num_vehicles: z.number().int().min(1).default(1),
  cost_price: z.number().min(0).optional().nullable(),
  sell_price: z.number().min(0).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
});

export const NoteTypeSchema = z.enum(["info", "warning", "tip", "important"]);
export const NotePositionSchema = z.enum(["top", "bottom"]);

export const AddNoteSchema = z.object({
  itinerary_id: z.number().int().positive(),
  message: z.string().min(1, "Note message is required").max(1000, "Note too long"),
  type: NoteTypeSchema.default("info"),
  position: NotePositionSchema.default("bottom"),
  optional_link_text: z.string().max(100).optional(),
  optional_link_url: z.union([z.url(), z.literal("")]).optional(),
  sort_order: z.number().int().min(0).default(0),
}).refine(
  (data) => !!data.optional_link_text === !!data.optional_link_url,
  { message: "Link text and URL must both be provided or both omitted", path: ["optional_link_text"] }
);

export const UpsertItineraryDaySchema = z.object({
  package_id: z.number().int().positive(),
  duration_id: z.number().int().positive("Duration is required"),
  route_id: z.number().int().positive("Route is required"),
  day: z.number().int().min(1, "Day number must be at least 1"),
  title: z.string().min(2, "Day title must be at least 2 characters").max(255),
  description: z.string().max(5000).optional(),
});

// Full day payload — composes the above, plus two cross-field invariants:
export const FullDayItinerarySchema = UpsertItineraryDaySchema.extend({
  stays: z.array(StayInputSchema).default([]),
  activities: z.array(ActivityInputSchema).default([]),
  transfers: z.array(TransferInputSchema).default([]),
  notes: z.array(NoteInputSchema).default([]),
})
  .refine(/* no duplicate stay_category_id within stays[] */)
  .refine(/* activities[].sort_order values must be unique within the day */);
```
`app/validators/package.validator.ts` holds `createPackageSchema` (§3.1) for the
package-level basic-info form; it's a separate file/concern from the itinerary validators.

---

## 6. Route Builder ↔ Itinerary Builder day-count relationship

Changing a duration's `days` or a route's stop list can orphan itinerary day content (e.g.
shrinking 7 days → 5 days leaves days 6–7's stays/activities dangling). Before applying such
a change, the UI calls `handleCheckItineraryDaysContent(packageId, routeId, durationId,
fromDay, toDay)` to check whether the affected day range has saved content, and warns the
admin rather than silently deleting it.

---

## 7. Stay tiers (`package_stay_categories`)

Independent of duration/route, a package defines its own tiers (e.g. "Budget",
"Standard", "Luxury") via `StayTiersSection.tsx`. Each tier:
- has a `slug` unique per package, a `label`, optional `min_duration_days` gate, and
  `is_default`/`sort_order`/`is_active` flags.
- is the second axis of the `package_pricing` matrix (duration × stay_category).
- is referenced by `itinerary_stays.stay_category_id` — a day can carry one hotel stay per
  tier, meaning the *content* (which hotel) legitimately differs by tier, not just the price.
- **cannot be deleted while any `itinerary_stays` row references it**
  (`handleDeleteStayCategory`, `itinerary-builder.actions.ts:331`, fails with "Cannot
  delete — this tier is in use by an itinerary").

---

## 8. Pricing engine

### 8.1 Entry point
`computePackagePrice(input: PricingInput): Promise<FullPricingBreakdown>` —
`app/services/package-pricing.service.ts:330`. Exposed to the dashboard via
`handleComputePackagePrice` (`pricing.actions.ts:68`) and used by the **Pricing Preview**
tab (`PricingPreviewTab.tsx`) and by the public package page / quote flow
(`getDurationStartingPrices`, `fetch-page-data.ts:1198`).

```ts
export type PricingInput = {
  package_id: number; duration_id: number; route_id: number; stay_category_id: number;
  adults: number; children: number; infants: number; child_ages?: number[];
  cab_type_ids?: number[] | null;   // null/empty → auto-select smallest-fitting cab per day-range
  travel_date?: string | null;       // ISO "YYYY-MM-DD"; null = base (non-seasonal) price
};
```

`FullPricingBreakdown` (§ full type in `package-pricing.service.ts:111-134`) returns a
per-day array (`DayPricingBreakdown[]`, each with hotel/meals/activities/transfers/cab_cost
lines) plus rolled-up subtotals, `base_cost`, `margin_amount`, `gst_amount`, `final_price`,
and `price_per_adult`. `missing_pricing_config: true` flags that no `package_pricing` row
exists for the requested `(duration, stay_category)` — margin/GST then fall back to
defaults (10% / 5%) rather than failing the calculation.

### 8.2 Hotel + meal pricing (per day)
- **Room capacity:** `bed_capacity` = room's `max_occupancy`; `extra_bed_capacity` =
  additional mattresses. `persons = adults + children` (infants excluded).
  `rooms_count = ceil(persons / (bed_capacity + extra_bed_capacity))`;
  `mattresses = max(0, persons - rooms_count * bed_capacity)`.
- **Price resolution:** `resolveHotelSeasonPricing` finds a season whose `valid_from`–
  `valid_to` (normalized to year 2000, so seasons recur every calendar year regardless of
  booking year) contains the travel date, using its weekend price on Sat/Sun if set, else
  its weekday price; falls back to the room's base `price_per_night`/`occupancy_prices` if
  no date or no matching season. Occupancy-tiered pricing picks the highest occupancy tier
  `<= typical occupancy` (`min(adults, bed_capacity)`).
  `total = rooms_count × price_per_room × num_nights + mattresses × extra_bed_rate × num_nights`.
- **Meals — day-shift rule:** breakfast on day *N* is billed from the **previous night's**
  hotel (`stayByDay.get(day - 1)`, i.e. the hotel checked out of that morning); every other
  meal on day *N* is billed from **that day's** hotel (`stayByDay.get(day)`, arrival
  evening). `stayByDay` is built by expanding each stay across
  `[itin.day, itin.day + num_nights - 1]`. Meal persons = `adults + children` only.
  Price resolution (`resolveMealPrice`) follows the same year-2000 seasonal + weekend
  pattern as hotels.

### 8.3 Activity pricing (per day)
Each `itinerary_activities` row resolves pricing tiers from its `variant` (or, if none was
ever assigned, the activity's first active variant as a **fallback** —
`fallbackVariantMap`), seasonally adjusted the same year-2000-normalized way, with a
weekend override on `variant.seasons[].weekend_price`. `pricing_type`:
- `PER_GROUP` / `FLAT_RATE` / `PER_VEHICLE` → one flat price, ignored (`total = 0`) if the
  activity is marked `is_optional`.
- `PER_PERSON` (default) → matches `"adult"` / `"child"`/`"children"` /
  `"infant"`/`"baby"`/`"toddler"` tier labels (`matchTier`, substring match, case-insensitive);
  child tier falls back to the adult price if absent; total is `adult_price×adults +
  child_price×children + infant_price×infants`, or `0` if optional.

### 8.4 Cab pricing — upgrade logic, not multiplication
Cab types are grouped by their **first segment's day range**. For each group, the
"preferred" cab is either explicitly selected (`cab_type_ids`) or auto-picked as the
smallest vehicle whose `passenger_capacity` covers `adults + children` (mirrors CRM
default logic). If the preferred cab can't fit the party, the engine **upgrades to the
smallest cab in that same group that does fit** — it never multiplies vehicle count; the
breakdown always reports `num_vehicles: 1` per segment, with `upgraded: true` and
`original_vehicle_name` set when a swap happened. Segment price resolution
(`resolveCabPrice`) uses the same year-2000 seasonal pattern; `PER_DAY` sums per-day
weekday/weekend rates across `[day_from, day_to]`, `PER_KM` multiplies the weekday rate by
the summed `transfer_routes.distance_km` of that day range (via `dayKmMap`, built from
`itinerary_transfers`).

### 8.5 Permits & totals
`permit_subtotal` = sum of `package_permits` where `is_included = true` for the duration
(non-included permits are informational/optional add-ons, not priced in). Final rollup:
```
base_cost      = hotel_subtotal + meal_subtotal + activity_subtotal + cab_subtotal + permit_subtotal
margin_amount  = round(base_cost × margin_percentage / 100, 2)
gst_amount     = round((base_cost + margin_amount) × gst_percentage / 100, 2)   // GST is on cost+margin
final_price    = base_cost + margin_amount + gst_amount
price_per_adult= round(final_price / adults)   // final_price itself if adults == 0
```

### 8.6 Pricing config actions (`app/actions/packages/pricing.actions.ts`)
| Action | Line | Does |
|---|---|---|
| `handleGetPackagePricings(packageId)` | 10 | List all `package_pricing` rows for the matrix UI |
| `handleUpsertPackagePricing({package_id, duration_id, stay_category_id, margin_percentage, gst_percentage})` | 38 | Upsert one matrix cell |
| `handleComputePackagePrice(input: PricingInput)` | 68 | Runs the full engine (§8.1) — powers the Pricing Preview tab |

---

## 9. Publishing requirements

For a package to resolve on the public site with a canonical URL, it needs: `is_active =
true`, at least one `package_durations` row with `is_default = true` and `is_active =
true`, that duration's default/first active `package_routes` row, and a default
`package_stay_categories` row with priced (`package_pricing`) content. `fetchPackagePageData`
(`app/actions/packages/fetch-page-data.ts:223`) is the public-page loader that resolves
these defaults and falls back gracefully when a requested duration/route/stay slug doesn't
match.

---

## 10. Gotchas / invariants worth remembering

1. **Slug is immutable post-creation** (`updatePackageBasicInfo`) — never wire up slug
   editing on the edit form without also handling redirect/SEO implications.
2. **`itinerary_stays` is unique per `(itinerary_id, stay_category_id)`** — one hotel per
   tier per day, not one hotel per day. A multi-night stay is one row with `num_nights > 1`,
   not N duplicate rows.
3. **`handleUpdateStayActiveMeals` intentionally skips `revalidatePath`** (§4.3) — don't
   "fix" this without understanding the sidebar remount bug it avoids.
4. **`transfer_routes` are deduplicated by pickup/drop location**, not created fresh per
   transfer — reuses an existing route row when the location pair matches.
5. **All seasonal pricing (hotel/meal/activity/cab) is year-agnostic**, matched by
   normalizing dates to year 2000 — a season defined "Apr 1 – Sep 30" applies to every
   year, not just one.
6. **Cabs upgrade, never multiply** — the engine always reports exactly 1 vehicle per
   segment; capacity shortfalls are solved by picking a bigger vehicle in the same
   day-range group, not by adding a second vehicle.
7. **Stay categories can't be deleted while in use** — `handleDeleteStayCategory` fails
   loudly rather than cascading, since that would silently drop priced content.
8. **No item-level price lives on the itinerary** — hotels/activities/cabs/meals are
   resolved live from their master tables every time `computePackagePrice` runs; editing a
   room's price retroactively changes what every package quoting that room shows.
