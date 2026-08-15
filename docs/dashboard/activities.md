# Activities — `/dashboard/activities`, `/dashboard/activities/categories`

An **activity** is a bookable experience at a place (rafting, paragliding, a temple tour).
Activities are sold two ways: standalone on the public site, and as itinerary line items
inside travel packages (`itinerary_activities`). This module is where ops create them,
attach photos, and maintain the price matrix.

Files: [`(main)/activities/`](<../../app/(dashboard)/dashboard/(main)/activities/>) —
`page.tsx`, `ActivityClient.tsx`, `ActivitiesTableClient.tsx`, `ActivityImagesSheet.tsx`,
`ActivityPackagesSheet.tsx`, `new/CreateActivityForm.tsx`, `[id]/page.tsx` + `[id]/tabs/*`,
`categories/`, `actions.ts` (~1,330 lines).

---

## 1. Data model

```
activity_categories
  └─ activities                     (1 category, 1 destination, 1 Location)
       ├─ activity_images           (gallery; exactly one is_primary)
       ├─ activity_addons           (optional paid extras)
       └─ activity_variants         (what you actually book — "Private Rafting, 6 pax")
            ├─ activity_variant_pricing         ← flat, always-on price rows
            └─ activity_variant_season          ← date-bounded price rows
                 └─ activity_variant_season_pricing
```

Two pricing layers exist on purpose: `activity_variant_pricing` is the base rate card, and
`activity_variant_season` overrides it for a date window (peak/off-peak), each season
carrying its own set of labelled price rows plus an optional `weekend_price`.

### `activities`

```prisma
model activities {
  id             Int      @id @default(autoincrement())
  name           String
  slug           String   @unique
  description    String?
  meta_title     String?
  meta_desc      String?
  duration_hours Decimal? @db.Decimal(4, 1)
  difficulty     String?
  is_active      Boolean  @default(true)
  address        String?
  city           String?
  state          String?
  country        String?  @default("India")
  pincode        String?
  phone          String?
  email          String?
  category_id    Int?     // → activity_categories
  destination_id Int?     // → destinations  (marketing hierarchy)
  location_id    BigInt?  // → Location      (operational gazetteer)
  included_meals String[]
  created_by     String?
  updated_by     String?
  @@index([category_id, is_active])
  @@index([destination_id, is_active])
}
```

An activity carries **both** a free-text address block and structured
`destination_id` / `location_id` pointers. The free-text fields are what's printed on
vouchers; the pointers are what search and the itinerary builder resolve against.
`included_meals` is a Postgres `text[]`, posted from the form as a JSON string and
normalised by a zod `preprocess` (a malformed value degrades to `[]` rather than failing).

### `activity_variants`

```prisma
model activity_variants {
  id             Int      @id @default(autoincrement())
  activity_id    Int
  name           String
  booking_mode   String                 // PRIVATE | GROUP | SHARED   (string, not an enum)
  pricing_type   String                 // PER_PERSON | FLAT_RATE | PER_VEHICLE
  min_persons    Int?
  max_persons    Int?
  cost_price     Decimal? @db.Decimal(10, 2)   // what we pay the operator
  gst_percentage Decimal  @default(5) @db.Decimal(5, 2)
  valid_from     DateTime?
  valid_to       DateTime?
  is_active      Boolean  @default(true)
  sort_order     Int      @default(0)
  activity       activities @relation(..., onDelete: Cascade)
}
```

`booking_mode` and `pricing_type` are **plain strings**, not Prisma enums — the allowed
values live only in the UI (`BOOKING_MODES` / `PRICING_TYPES` in
[`[id]/tabs/VariantsTab.tsx`](<../../app/(dashboard)/dashboard/(main)/activities/[id]/tabs/VariantsTab.tsx>)).
Nothing at the DB level stops a different value being written, so consumers should treat
them defensively.

### Pricing rows

`activity_variant_pricing` and `activity_variant_season_pricing` are the same shape:

```prisma
label             String    // "Adult", "Child (5–11)", "Foreign national"
age_from          Int?
age_to            Int?
price             Decimal @db.Decimal(10, 2)   // sell price
original_price    Decimal? @db.Decimal(10, 2)  // strike-through / rack rate
margin_percentage Decimal @default(0) @db.Decimal(5, 2)
is_active         Boolean @default(true)
sort_order        Int     @default(0)
```

Age bands are advisory labels for the seller, not enforced constraints — nothing validates
that bands don't overlap or leave gaps.

### `activity_addons`

```prisma
title        String
description  String?
pricing_type String                    // same free-string convention as variants
price        Decimal  @db.Decimal(10, 2)
cost_price   Decimal? @db.Decimal(10, 2)
is_optional  Boolean  @default(true)
is_active    Boolean  @default(true)
sort_order   Int      @default(0)
```

Every child table (`images`, `addons`, `variants`, and both pricing tables) cascades on
delete from its parent.

---

## 2. List page — `/dashboard/activities`

`getActivities({ page, limit, search, category_id, status })`.

Search spans the activity's own `name`, `city`, `state` **and** its linked `Location`'s
name plus that location's city/state/country names — so searching "Himachal" finds
activities whose location merely sits under a Himachal state row.

Rows are returned with `location_id` stripped and replaced by a boolean `has_location`,
`duration_hours` cast from `Decimal` to `number`, and a `memberNames` map resolving
`created_by` to a team-member name. Stats: total / active / inactive / `withVariants`
(activities that have at least one variant — the useful "is this actually sellable" signal).

Row actions: edit, toggle active, delete, an **Images** sheet, and a **Packages** sheet.

### Packages sheet

`getActivityPackageUsage(activityId)` walks `itinerary_activities → package_itineraries`
and groups by package, returning each package's title/slug/thumbnail/destination plus the
list of `(day, itinerary title, duration label)` usages. This is the "where is this
activity used?" view — and the reason deletion is blocked.

---

## 3. Detail page — `/dashboard/activities/[id]`

Four tabs, fed by one `getActivityWithVariants(id)` call:

| Tab | Contents |
|---|---|
| **Overview** | name, slug (immutable after create), category, description, difficulty, duration, location/destination pickers, address block, contact fields, included meals, active toggle |
| **Images** | drag-upload gallery, primary selection, per-image labels |
| **Variants** | the price matrix — variants, their base pricing rows, and seasons with their own pricing rows |
| **Add-ons** | optional paid extras |

Creation is a separate page (`activities/new`) because slug availability must be resolved
before the row exists; `ActivityUpdateSchema` is `ActivitySchema.omit({ slug: true })`, so
**the slug can never be changed after creation** — public URLs and package references stay
stable.

### Images

- `addActivityImages(activity_id, images[])` — appends with `sort_order` continuing from
  the current count, and marks the very first image of an empty gallery as `is_primary`.
  Returns the created rows so the client can render them without a refetch.
- `setPrimaryActivityImage` — a two-statement `$transaction`: clear `is_primary` on all
  rows for the activity, then set it on one. Guarantees exactly one primary.
- `deleteActivityImage` — deletes the R2 objects (`url` and `thumbnail`, deduped) **before**
  the DB row, since a failed R2 delete is recoverable but an orphaned row is not.
- `updateActivityImageLabel` / `batchSaveActivityImageLabels` — inline label editing.

### Variants

Two granularities of write action exist, and both are used:

- **Granular** — `createVariant`, `updateVariant`, `deleteVariant`,
  `upsertVariantPricing`, `deleteVariantPricing`, `createVariantSeason`,
  `updateVariantSeason`, `deleteVariantSeason`.
- **Composite** — `createVariantWithSeasons(activity_id, VariantInput)` and
  `updateVariantWithSeasons(...)`, which write the variant and its full season tree in one
  `$transaction`. This is what the Variants tab's "Save variant" button calls, so a
  half-saved variant can't exist.

Season writes validate in the action (not zod): non-empty `season_name`, both dates
present, and `valid_to > valid_from` strictly. Editing a season **replaces** its pricing
rows — `deleteMany` then `createMany` inside the transaction — so `sort_order` is always
the array index and stale rows can't survive an edit. Row ids are therefore not stable
across saves; don't reference `activity_variant_season_pricing.id` from anywhere else.

`sort_order` for a newly created variant/season is set to the current sibling `count()`,
which is racy under concurrent creation but harmless (two rows share an order and fall back
to id ordering).

---

## 4. Deleting an activity

`deleteActivity(id)`:

1. Refuses if `_count.itinerary_activities > 0`, naming how many itinerary days use it —
   packages must be edited first.
2. Deletes every R2 object across all images (deduped `url` + `thumbnail`).
3. Explicitly `deleteMany`s images, add-ons and variants (variants cascade to their pricing
   and seasons), then deletes the activity.
4. Logs `DELETE` on entity `"Activity"`.

---

## 5. Activity Categories — `/dashboard/activities/categories`

```prisma
model activity_categories {
  id         Int     @id @default(autoincrement())
  name       String  @unique
  slug       String  @unique
  is_active  Boolean @default(true)
  sort_order Int     @default(0)
  activities activities[]
  @@index([is_active])
}
```

A deliberately flat table — no parent/child tree, no SEO fields — managed inline from
`categories/CategoriesClient.tsx` with a zod `CategorySchema` in `categories/actions.ts`.
This is **not** the same table as package `categories` (see
[`content-management.md`](./content-management.md) §5); the two are unrelated despite the
similar sidebar naming.

Delete is refused while activities reference the category.

---

## 6. Gotchas

- Slug is create-only. Renaming an activity does not change its slug or public URL.
- `booking_mode` / `pricing_type` are unconstrained strings; the enum lives in the UI file.
- Season pricing rows are deleted and recreated on every season save — their ids churn.
- An activity with zero variants is unsellable but still "active"; use the `withVariants`
  stat rather than `is_active` to judge readiness.
- Age bands on pricing rows are not validated for overlap or coverage.
