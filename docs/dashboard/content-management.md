# Content Management — Regions, Destinations, Locations, Categories, Policies

Covers the sidebar groups **Content Management** (Regions, Destinations, Policies),
**Overview → Locations**, and **Packages → Package Categories**. These five modules are
the taxonomy layer everything else hangs off: hotels, activities and packages all point at
a destination and/or a location, packages point at categories and policies.

Shared conventions (auth guard, zod → `FormState`, R2 cleanup, `createLog`, URL-driven
filters) are described once in [`README.md`](./README.md) §3 and not repeated here.

---

## 1. How the two geography systems relate

There are **two independent geography tables**, and that is deliberate:

```
custom_regions ("regions")        Location ("locations")
  └─ destinations                   ├─ self-referential hierarchy (parent/country/state/city)
       ├─ hotels                    ├─ hotels.location_id
       ├─ packages                  ├─ activities.location_id
       ├─ activities                ├─ route_stops.location_id
       └─ cab_pricing               ├─ transfer_routes.pickup/drop_location_id
                                    ├─ cab_pricing.location_id
                                    └─ permits.location_id
```

- **`custom_regions` → `destinations`** is the *marketing* hierarchy — a curated two-level
  tree ("Himachal" → "Manali") with SEO fields, cover art and slugs that drive public URLs
  (`/region/[slug]`, `/destination/[slug]`).
- **`Location`** is the *operational* gazetteer — a generic, arbitrarily deep place graph
  with 21 types, coordinates, timezone, and external ids (GeoNames / OSM / Mapbox). It is
  what pricing, routes, transfers and permits resolve against, and what feeds Meilisearch.

`destinations.location_id` optionally ties a marketing destination back to its gazetteer
entry. Nothing enforces the link — it is a convenience, not a constraint.

---

## 2. Regions — `/dashboard/regions`

Files: [`(main)/regions/`](<../../app/(dashboard)/dashboard/(main)/regions/>) —
`page.tsx`, `RegionsClient.tsx`, `Regionstable.tsx`, `RegionDialog.tsx`, `RegionSheet.tsx`,
`Deleteregiondialog.tsx`, `actions.ts`.

### Schema

```prisma
model custom_regions {
  id           Int       @id @default(autoincrement())
  name         String
  slug         String    @unique
  country      String    @default("India")
  description  String?
  meta_title   String?
  meta_desc    String?
  cover_image  String?
  thumbnail    String?
  is_active    Boolean   @default(true)
  is_deleted   Boolean   @default(false)
  deleted_at   DateTime?
  deleted_by   String?
  created_by   String?
  updated_by   String?
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  destinations destinations[]
  @@map("regions")
}
```

Note the `@@map` — the Prisma model is `custom_regions` but the table is `regions`.

### Behaviour

| Concern | Rule |
|---|---|
| Slug | lowercase-hyphen regex, unique. `checkSlugAvailability()` probes live while typing and returns the next free `-2`, `-3`… suffix |
| Name | title-cased on save (`\b\w` → uppercase) |
| SEO gate | `is_active` cannot be true without `meta_title` **and** `meta_desc` — enforced in `RegionSchema.superRefine` and re-checked in `toggleRegionActive` |
| Thumbnail | required; `cover_image` optional. Replaced images are pruned from R2 after the DB update commits |
| Delete | refused while any destination points at the region; the error names up to 5 of them plus "and N more". Otherwise the row is stamped (`is_deleted`, `deleted_at`, `deleted_by`), images are removed from R2, and the row is then **hard-deleted** |
| Audit | `entity: "Region"`; `getRegionHistory(id)` returns the last 50 `ActivityLog` rows |

Field limits: name ≤ 100, slug ≤ 120, description ≤ 2000, `meta_title` ≤ 60,
`meta_desc` ≤ 160 (`app/lib/validators/regions.ts`).

### List page

`getRegions({ page, limit, search, country, status, destCount })` returns rows plus a
`stats` block (total / active / inactive / destination count) and a `memberNames` map that
resolves `created_by` / `updated_by` ids to team-member names. `destCount`
(`0` | `1-5` | `6-15` | `15+`) is applied **in memory** after the SQL filters, so it filters
the current page rather than the whole table — a deliberate trade-off for a small table.

---

## 3. Destinations — `/dashboard/destinations`

Files: [`(main)/destinations/`](<../../app/(dashboard)/dashboard/(main)/destinations/>) —
`page.tsx`, `DestinationsClient.tsx`, `Destinationstable.tsx`, `Destinationdialog.tsx`,
`actions.ts`.

### Schema

```prisma
model destinations {
  id          Int      @id @default(autoincrement())
  name        String
  slug        String   @unique
  country     String   @default("India")
  region_id   Int                        // → custom_regions
  location_id String?                    // → Location (soft pointer, not an FK relation)
  latitude    Decimal? @db.Decimal(10, 8)
  longitude   Decimal? @db.Decimal(11, 8)
  place_id    String?
  description String?
  meta_title  String?
  meta_desc   String?
  cover_image String?
  thumbnail   String?
  is_active   Boolean  @default(true)
  is_deleted  Boolean  @default(false)
  deleted_at  DateTime?
  deleted_by  String?
  created_by  String?
  updated_by  String?
  region      custom_regions @relation(fields: [region_id], references: [id])
  activities  activities[]
  bookings    Booking[]
  cabPricings cab_pricing[]
  hotels      hotels[]
  packages    packages[]
}
```

### Behaviour

Same validation shape as regions (name ≤ 150, slug ≤ 180, SEO gate on activation), plus:

- **`region_id` is required** — a destination always belongs to exactly one region.
- **Soft-delete with restore.** `deleteDestination` refuses while packages or hotels are
  linked (naming up to 5), then sets `is_deleted = true`, `is_active = false`, stamps
  `deleted_by`/`deleted_at`, and prunes R2 images. The row stays in the table.
  If someone later creates a destination with the same slug, `createDestination` **restores
  the soft-deleted row in place** — refreshing every field, clearing the delete stamps, and
  logging `metadata.operation: "restore"` — instead of inserting a duplicate. This is why
  the slug-conflict check distinguishes `existing && !existing.is_deleted` from
  `existing && existing.is_deleted`.
- Every list query filters `is_deleted: false`; soft-deleted rows are invisible in the UI.
- Audit entity string is lowercase `"destination"` (regions use `"Region"`).

---

## 4. Locations — `/dashboard/locations`

Files: [`(main)/locations/`](<../../app/(dashboard)/dashboard/(main)/locations/>) —
`page.tsx`, `LocationsClient.tsx`, `LocationsTable.tsx`, `LocationDialog.tsx`,
`LinkedItemsSheet.tsx`, `MergeLocationsDialog.tsx`, `actions.ts` (~900 lines, the largest
of the taxonomy modules).

### Schema

```prisma
model Location {
  id               BigInt   @id @default(autoincrement())
  parent_id        BigInt?
  type             LocationType
  name             String
  official_name    String?
  slug             String   @unique
  short_code       String?
  iso_code         String?
  latitude         Decimal? @db.Decimal(10, 7)
  longitude        Decimal? @db.Decimal(10, 7)
  elevation_meters Int?
  timezone         String?
  population       Int?
  seo_title        String?
  seo_description  String?
  description      String?
  hero_image       String?
  is_featured      Boolean  @default(false)
  is_popular       Boolean  @default(false)
  is_searchable    Boolean  @default(true)
  is_active        Boolean  @default(true)
  country_id       BigInt?
  state_id         BigInt?
  city_id          BigInt?
  geonames_id      Int?
  osm_id           String?
  mapbox_id        String?
  metadata         Json?
  // back-refs: hotels, activities, route_stops, pickup_routes, drop_routes,
  //            cabPricings, permits, children/city_children/state_children/country_children
  @@map("locations")
}

enum LocationType {
  REGION SUBREGION COUNTRY STATE CITY DISTRICT AREA NEIGHBORHOOD VILLAGE
  LANDMARK AIRPORT BEACH MOUNTAIN ISLAND TOURISM_ZONE
  BUS_STATION TRAIN_STATION PORT HOTEL ACTIVITY ROUTE_STOP
}
```

**Four separate hierarchy pointers.** `parent_id` is the generic tree edge;
`country_id` / `state_id` / `city_id` are denormalised shortcuts so a landmark can name its
city/state/country without walking the tree. All four are self-references to `locations`,
which is why the merge routine has to rewrite them explicitly (§4.4).

`id` is a `BigInt`, so every action serialises it to a string at the boundary
(`serialize()` also converts the `Decimal` lat/lng to numbers) — JSON can't carry BigInt.

### 4.1 The "used" scope

The table has tens of thousands of imported gazetteer rows, so the list defaults to
`scope=used`:

```ts
const USED_FILTER = { OR: [
  { hotels: { some: {} } }, { activities: { some: {} } }, { route_stops: { some: {} } },
  { pickup_routes: { some: {} } }, { drop_routes: { some: {} } },
  { metadata: { path: ["source"], equals: "manual" } },
]};
```

The last branch matters: `createLocation` always writes `metadata: { source: "manual" }`,
so a location you just added here stays visible even before anything links to it.
Switching the scope filter to `all` drops the filter entirely. Stats returned alongside:
`total` (all rows), `used`, `active`, `inactive`, and `recent` (created in the last 7 days).

### 4.2 Duplicate prevention

Two different probes, both matching on `name contains` + same `type`:

- `checkLocationDuplicate(name, type, excludeId?)` — up to 3 matches, annotated with the
  creator's name pulled from the `CREATE` `ActivityLog` row. Powers the "heads up, this may
  already exist" warning inside the create form.
- `searchLocationsForMerge(name, type)` — up to 20 matches, each with a `linkedCount`
  summed across **eleven** relations (hotels, activities, route stops, pickup/drop routes,
  cab pricing, permits, and the four self-referential child counts). Powers the merge picker,
  where an accurate impact preview matters.

`checkLocationSlug` behaves like the region equivalent. `updateLocation` additionally
rejects a location being set as its own parent/country/state/city.

### 4.3 Linked items — unlink & relink

`getLocationLinkedItems(id)` returns everything pointing at a location across five kinds —
`hotel`, `activity`, `route_stop`, `transfer_pickup`, `transfer_drop` — each with a label,
a context string (e.g. `Route stop in "Kasol Explorer"`) and a deep link to the owning
record's edit page.

- `unlinkLocationReference(kind, refId)` nulls the pointer. Safe for all five kinds — none
  of them require a non-null location.
- `relinkLocationReference(kind, refId, newLocationId)` re-points it at a different
  location instead.

Both write an `ActivityLog` entry against the *referencing* entity (Hotel / Activity /
RouteStop / TransferRoute) with `metadata.operation` set to `unlink_location`,
`relink_location`, `unlink_pickup_location`, etc.

### 4.4 Merge

`mergeLocations(targetId, sourceIds)` is the bulk correction path. Guards: sources must
exist, must exclude the target, and must all share the target's `type`. Then a single
`db.$transaction` re-points **every** reference and deletes the sources:

| Moved | Why it's in the transaction |
|---|---|
| `hotels`, `activities`, `route_stops`, `transfer_routes.pickup/drop` | the five kinds the Linked Items sheet shows |
| `cab_pricing`, `permits` | both use `onDelete: SetNull` — skipping them would silently blank real pricing/permit data |
| `locations.parent_id / city_id / state_id / country_id` | self-refs default to `onDelete: Restrict` — skipping them would make the delete fail outright |

The result carries a `movedCounts` breakdown, which is also stored on the audit entry
(`metadata.operation: "merge"`) and surfaced in the success toast
(*"Merged 2 locations into "Manali" — 37 links moved."*).

---

## 5. Package Categories — `/dashboard/categories`

Files: [`(main)/categories/`](<../../app/(dashboard)/dashboard/(main)/categories/>).

```prisma
model categories {
  id          Int     @id @default(autoincrement())
  name        String  @unique
  slug        String  @unique
  description String?
  meta_title  String?
  meta_desc   String?
  parent_id   Int?                       // self-referential, one level used in practice
  sort_order  Int     @default(0)
  is_active   Boolean @default(true)
  created_by  String?
  updated_by  String?
  parent      categories?  @relation("CategoryTree", fields: [parent_id], references: [id])
  children    categories[] @relation("CategoryTree")
  packages    package_categories[]       // M:N with packages
}
```

Categories classify **travel packages** (Honeymoon, Adventure, Pilgrimage…) via the
`package_categories` join table. Activities have their own separate category table (see
[`activities.md`](./activities.md)).

**Two list modes.** `getCategories` sets `isFiltering = !!(search || status !== "all" ||
parent_id !== "all")`:

- *Not filtering* — paginates **top-level rows only** (`parent_id: null`) and eager-loads
  children, so the table renders as an expand/collapse tree.
- *Filtering* — paginates the flat matching set, so a search can surface a subcategory
  without its parent.

Ordering is `sort_order asc, name asc`; `updateSortOrder` persists drag-reorder.
`parent` filter accepts `all`, `top` (top-level only) or a numeric parent id.
Stats: total, active, subcategory count, and total package links summed across all rows.

Delete is blocked while children or linked packages exist. Audit entity: `"category"`.

---

## 6. Policies — `/dashboard/policies`

Files: [`(main)/policies/`](<../../app/(dashboard)/dashboard/(main)/policies/>).

```prisma
model policies {
  id         Int        @id @default(autoincrement())
  type       PolicyType
  title      String
  points     String[]              // Postgres text[] — the bullet list
  is_active  Boolean    @default(true)
  sort_order Int        @default(0)
  packages   package_policy_map[]
  @@index([type, is_active])
}

enum PolicyType { CANCELLATION DATE_CHANGE REFUND TERMS_AND_CONDITIONS }
```

A policy is a titled bullet list. `points` is a native string array, not a relation — the
dialog edits it as a repeatable field and posts it as a JSON string, which the action
`JSON.parse`s before validation (a malformed value returns *"Invalid points data"*
before zod ever runs).

Policies attach to packages through `package_policy_map`, so one cancellation policy can be
reused across many packages; the package's quote/booking snapshot copies the text at
booking time (see the booking docs), meaning later edits don't retroactively change
existing bookings.

List: filter by `type` and `status`, ordered `type asc, sort_order asc`. Stats show total /
active / inactive plus the number of package links. `togglePolicyActive` and
`deletePolicy` are simple row actions — a policy in use by packages cannot be deleted.

---

## 7. Gotchas

- The Prisma model `custom_regions` maps to table `regions`; `db.custom_regions` in code,
  `regions` in SQL and in migrations.
- Regions **hard-delete** after stamping the soft-delete columns; destinations **stay**
  soft-deleted. Only destinations have the restore-on-recreate path.
- Audit `entity` strings are inconsistent by module: `"Region"`, `"Location"` vs
  `"destination"`, `"category"`. Query history with the exact string the module writes.
- `Location.id` is a `BigInt` — never pass it through JSON unserialised, and never compare
  it to a `destinations.location_id` (a `String`) without converting.
- Activating a region/destination without SEO fields fails in two places; changing one
  without the other leaves an inconsistent gate.
