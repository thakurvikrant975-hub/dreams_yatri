# Custom Package Builder, costing review & itinerary settings

How a sales executive turns a lead into a priced, client-facing itinerary — and the costing
review every quote must pass before it can be sent.

| Page | Route | Files |
|---|---|---|
| Package Builder | `/dashboard/package-builder`, `/dashboard/package-builder/[packageId]` | [`(builder)/package-builder/`](<../../app/(dashboard)/dashboard/(builder)/package-builder/>) |
| Verify Packages (costing) | `/dashboard/verify-packages` | [`(main)/verify-packages/`](<../../app/(dashboard)/dashboard/(main)/verify-packages/>) |
| Itinerary Settings | `/dashboard/itinerary-settings` | [`(main)/itinerary-settings/`](<../../app/(dashboard)/dashboard/(main)/itinerary-settings/>) |

> Not to be confused with the **catalog** package builder at `/dashboard/packages`, which
> maintains reusable public products (`packages`, durations, routes, itineraries) and is
> documented in
> [`../packages/admin-package-itinerary-builder.md`](../packages/admin-package-itinerary-builder.md).
> This one produces per-client quotes in `custom_packages`.

The builder lives in its own route group `(builder)` with a **separate layout and no
sidebar** — it is a full-screen editing surface.

---

## 1. Data model

```
custom_packages                  the quote
 ├─ custom_itineraries           one row per day (hotel, cabs, activities, meals, notes)
 │    └─ custom_itinerary_activities
 ├─ custom_package_stops         "Manali, 2 nights" — the route summary
 ├─ custom_package_tickets       flight/train legs (one row per leg)
 ├─ custom_package_addons        priced extras, optionally attached to a day
 └─ query → package_queries      the lead (nullable, non-unique)
```

`queryId` is **nullable and non-unique** on purpose: one lead can receive several quotes
(two budget options), and a "blank" package can be built ahead of any lead and attached
later. A package with no query cannot be sent — there's nobody to send it to.

### Status

```prisma
enum CustomPackageStatus { DRAFT READY SENT ACCEPTED DECLINED }
```

`status` is only half the story; the workflow is driven by a set of parallel stamps that
each answer one question:

| Field group | Question it answers |
|---|---|
| `readyAt` / `readyBy` / `readyByName` | when did the exec stop editing and submit for costing? |
| `verified` / `verifiedAt` / `verifiedBy` | has costing signed off on the price? |
| `rejectedAt` / `rejectionReasonId` / `rejectionNote` | did costing send it back, and why? |
| `revisionRequestedAt` / `revisionNote` | did the *exec* pull it back after approval/send? |
| `sentAt` / `viewedAt` / `viewCount` | was it delivered, and has the client opened it? |
| `execNotifiedAt` | has the exec already been toasted about the latest decision? |

`verified` is deliberately independent of `status`: costing approving the price **does not**
send anything — it only unlocks the exec's own send step.

### Pricing fields

```prisma
pricePerPerson, totalPrice        // the locked, authoritative numbers
marginPercentage @default(25), gstPercentage @default(5)
hotelSubtotalOverride, cabSubtotalOverride   // retired package-wide lump corrections
pricingSnapshot Json?             // frozen breakdown, written once at send time
paymentLink String?               // exec-pasted Razorpay payment link (manual, no webhook)
```

### Document content fields

Six standard lists (`inclusions`, `exclusions`, `termsConditions`, `paymentPolicy`,
`amendmentPolicy`, `travelBenefits`) mirror the company defaults from `itinerary_settings`
on every save. Around them:

- `extraPolicyItems` (Json) — **per-package additions** an exec may make. An exec can add,
  never remove, a standard line.
- `removedInclusions` / `removedExclusions` — **costing's vetoes**, written only by
  `updatePackageInclusionsExclusions` in verify-packages. Kept separate precisely so an
  exec's builder save can't clobber a costing edit made while the package sits in review.
- `customPolicySections` (Json) — mirrors the admin-defined extra policy blocks.
- `template` (nullable) and `themeOverrides` — per-package document styling.
  Null template means "use the house default", deliberately not defaulted to `"classic"`,
  so changing the house template restyles every package that never made a choice.

### `custom_itineraries` — the day row

The day row is heavily **denormalised on purpose**: the client-facing page and the PDF
render from this row alone and never join back to the catalog, so anything the document
shows must live here. That includes `accommodationStarRating`, `accommodationRoomSpecs`,
`accommodationRoomCapacity`, `accommodationMaxAdults` / `MaxChildren` /
`ExtraBedCapacity` — all snapshotted at pick time so a later edit to the hotel's catalog
listing can't silently change a quote already given.

Key fields:

| Field | Meaning |
|---|---|
| `roomPricingId` + `roomsCount` | the primary catalog room; `roomsCount` overrides the auto occupancy-derived count |
| `extraRooms` (Json) | additional *different* room types for the same night, always at the **same hotel** as `roomPricingId` (3 Deluxe + 2 Standard) — `{roomPricingId, label, quantity, hotelId}[]`, priced flat, no occupancy logic. Picked from the stay's own hotel in the Rooms-this-night editor; carried across every night of a stay by `StaySpec`, and dropped when the day's hotel changes |
| `cabPricingId` + `cabQuantity`, `extraCabs` (Json) | same pattern for cabs |
| `manualHotelPricePerNight`, `manualExtraBeds`, `manualExtraBedRate` | used when there is no catalog room (hand-typed or team-filled day) |
| `hotelPriceOverride`, `cabPriceOverride` | costing's per-day price corrections |
| `hotelPending`, `hotelPendingNote`, `hotelRequestType`, `hotelRequestedAt` | the "Add Hotels by Team" request — see [`hotels.md`](./hotels.md) §10 |
| `hotelFilledAt/ById/ByName`, `hotelFillNote` | who fulfilled it; the note is ops→sales only and never printed |

A day is either catalog-picked, manually typed, or pending — never two of those at once.
`hotelPending` blocks `markPackageReady`.

---

## 2. Workflow

```
   exec builds (DRAFT)
        │  markPackageReady            ← blocked while any day is hotelPending
        ▼
     READY  ──► costing queue (/dashboard/verify-packages)
        │
        ├── updatePackagePricing   (corrections, only while READY)
        │
        ├── approveCustomPackage   → verified = true, price re-locked, stays READY
        │        │
        │        └── shareCustomPackageWithClient (exec)  → sendPackageToClient → SENT
        │
        └── rejectCustomPackage    → back to DRAFT + reason (editing unlocked)

   after approval or send:
        requestPackageRevision (exec) → back to DRAFT + free-text note
```

### `markPackageReady(packageId)`

Requires a linked query; refuses if already `SENT`. Sets `READY` with `readyAt/By`, clears
`verified` and any prior rejection, and clears `execNotifiedAt` so the next decision toasts
exactly once. Per-day price corrections from a previous cycle are **left in place** —
`saveCustomPackage` already invalidates a day's correction when that day's hotel/cab
actually changes, so what survives is still valid and costing doesn't redo it.

### `approveCustomPackage(packageId)`

Only from `READY`. Runs `computeFinalPackagePricing(packageId)` and writes the result to
`pricePerPerson` / `totalPrice` — locking in the exact number being signed off, rather than
letting the builder and PDF recompute (and drift as catalog rates change). Clears rejection
and revision stamps, resets `execNotifiedAt`, logs to the query timeline, and broadcasts
verification counts for the sidebar badge.

### `rejectCustomPackage(packageId, formData)`

Requires a `rejectionReasonId` (shared `RejectionReason` table) plus an optional ≤ 500-char
note. Sets `status: DRAFT` — that is what re-unlocks editing in the builder, which is locked
whenever status is `READY` — and clears `verified`.

### `updatePackagePricing(packageId, input)`

Costing's correction tool, allowed **only while `READY`**. Zod-validated
(`margin`/`gst` 0–100, per-day hotel/cab overrides, ticket fares, add-on price+qty), then
every id in the payload is checked against the package's actual rows — a mismatch returns
*"Stale form data — please refresh"* rather than writing to the wrong record.

Writes: ticket fares and add-on price/qty straight through; per-day corrections to
`custom_itineraries.hotelPriceOverride` / `cabPriceOverride` (null clears back to the
catalog price); margin/GST on the package; and **nulls the legacy
`hotelSubtotalOverride` / `cabSubtotalOverride`** — a stale package-wide lump override would
otherwise outrank the per-day corrections, because `computeFinalPackagePricing` reads
`pkg.hotelSubtotalOverride ?? computed`.

It then re-locks `pricePerPerson` / `totalPrice`, and writes a before/after audit entry under
its own entity name `"CustomPackagePricing"` — kept distinct from `"custom_package"` so this
history renders only on the costing review page and is never shown to the exec.

### `updatePackageInclusionsExclusions(...)`

The client submits the **full desired list** per section; the action diffs it against the
live standard list from `itinerary_settings` to derive what is newly vetoed
(`removedInclusions` / `removedExclusions`) versus newly added, rather than trusting
separate add/remove arrays from the browser.

### `sendPackageToClient(packageId)` / `shareCustomPackageWithClient(packageId)`

`shareCustomPackageWithClient` is the exec's button: it refuses unless `verified`, then calls
`sendPackageToClient`, then emails the client (best-effort — an email failure doesn't undo
the send, since the WhatsApp link and the client page are already live).

`sendPackageToClient` independently re-asserts `status === "READY"` and a linked query —
the guard belongs on the function that actually locks pricing and flips to `SENT`, not only
on its current caller. It then **recomputes the price server-side** from the real priced
rows (never trusting client state), writes `totalPrice` / `pricePerPerson` and the frozen
`pricingSnapshot`, sets `SENT` + `sentAt`, and returns a share URL
(`${NEXT_PUBLIC_BASE_URL}/custom-package/[id]`, falling back to the production domain rather
than localhost) plus a prefilled WhatsApp URL.

### `requestPackageRevision(packageId, note)`

The exec's reverse of a rejection — pulls an approved-but-unsent or already-sent package
back to `DRAFT` with a free-text note (e.g. the client asked for a change). `sentAt` is
never cleared; it records "was this ever sent", not "is it currently sent".

---

## 3. Price computation

`computeFinalPackagePricing(packageId)` in
[`app/services/package-pricing.service.ts`](../../app/services/package-pricing.service.ts)
is the single authority. It mirrors the builder's own live preview arithmetic:

```
hotelSubtotal  = hotelSubtotalOverride ?? computeBuilderHotelPricing(...)   // per-day rows
cabSubtotal    = cabSubtotalOverride   ?? computeBuilderCabPricing(...)
ticketsSubtotal = Σ ticket.fare
addonsSubtotal  = Σ addon.price × addon.quantity

baseCost   = hotelSubtotal + cabSubtotal + addonsSubtotal + ticketsSubtotal
margin     = round((hotel + cab + addons) × marginPercentage / 100)
           + round(tickets × TICKET_MARGIN_PCT / 100)      // tickets always a flat 5%
taxable    = baseCost + margin
gst        = round(taxable × gstPercentage / 100)
finalPrice = taxable + gst
pricePerPerson = round(finalPrice / payingPax)              // infant band excluded
```

`computeBuilderHotelPricing` resolves each day from the catalog rate (season → weekend →
occupancy tier), or from `manualHotelPricePerNight` when the day has no `roomPricingId`, and
applies `hotelPriceOverride` when costing set one. Room counts come from `roomsCount` when
given, otherwise from occupancy maths in `app/lib/room-capacity.ts`; `extraRooms` are priced
flat by quantity.

### Traveller age bands

Who is an infant, a child or an adult is **per package**
(`custom_packages.infantMaxAge` / `childMaxAge`, default 2 and 12, both inclusive), because
hotels don't agree: plenty treat under-5s as infants and start the child rate above that.
The exec sets them in Trip Setup. Everything downstream reads the band a traveller's **age**
falls in, never the box they were typed into:

| Question | Answered by |
|---|---|
| how many adult beds does this party need? | `pricingPartyOf` → room/mattress maths |
| how many heads is the total divided by? | `payingPaxOf` — the infant band pays no share |
| what does the document's "2 Rooms \| 3 Adults" line say? | `pricingPartyOf`, so it matches the price |

[`traveller-ages.ts`](<../../app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages.ts>)
is the single authority; `computeBuilderHotelPricing` classifies internally rather than
trusting its five callers to, so the builder preview, both costing screens and the send path
cannot price the same party into different rooms. A traveller whose age lands outside their
box's band (a 14-year-old under Children on a 12-cap package) is **priced by the band and
reported**, never silently moved — the itinerary still reads "2 Children", so the difference
is named in Trip Setup and on both costing screens.

### Mattresses

A day's mattress count is `manualExtraBeds` when the exec gave one, otherwise derived from
the room split (`planRoomOccupancy`). Three things make a count meaningless, all of them
hotel-team data the exec can neither see nor edit, and all previously indistinguishable from
success:

| Gap | Cause |
|---|---|
| `mattresses-not-enabled` | the room's `extra_bed_capacity` is 0 — nothing to book |
| `mattresses-over-capacity` | more mattresses than `extra_bed_capacity × rooms` |
| `no-mattress-rate` | the rate row has no `extra_bed_rate`, so they're added at ₹0 |

[`stay-diagnostics.ts`](<../../app/(dashboard)/dashboard/(builder)/package-builder/stay-diagnostics.ts>)
names each one at the mattress field (and badges affected rooms in the search results, before
the choice is made); `computeBuilderHotelPricing` emits the same codes as line gaps so
costing's breakdown says the same thing. `accommodationExtraBedRate` is snapshotted onto the
day purely so the builder can see the third case — pricing still resolves the live rate, or
the exec's `manualExtraBedRate` override, which the catalog tab can now set.

**One stay, one setup.** A hotel applied across nights carries its `roomsCount`,
`manualExtraBeds` and `manualExtraBedRate` to every night of the run (`StaySpec` in
`day-mutations.ts`). Without that each night derived its own count off its own `roomsCount`,
so one party in one hotel came out as 2 mattresses on Monday and 1 on Tuesday — a booking no
hotel can honour, and the most common reason costing rejected a package.
`inconsistentStayNights` detects a run that has already drifted and the drawer offers to
align it in one click.

### Pricing gaps

[`pricing-gaps.ts`](<../../app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/pricing-gaps.ts>)
holds pure functions that flag what is on the package but contributes nothing to the total —
a train leg with no fare, an add-on with no price, a cab with no rate row. The pricing code
is deliberately forgiving (`fare ?? 0`), which is correct for summing but makes an unpriced
item indistinguishable from a free one; these badges make the difference visible. They
describe what's missing and never guess a price.

---

## 4. The builder UI

`[packageId]/page.tsx` (~2,600 lines) is the shell; the surrounding files split it up:

| File | Role |
|---|---|
| `BuilderSidebar.tsx` | the right-hand icon rail + contextual panel |
| `DayListPanel.tsx`, `DayLayersRail.tsx`, `DayActionsMenu.tsx`, `ApplyToDays.tsx` | the day list and bulk day operations |
| `HotelDrawer.tsx`, `HotelRoomPicker.tsx`, `DayDrawers.tsx`, `ExtrasDrawers.tsx` | contextual editors for a clicked thing |
| `SuggestionsPanel.tsx` | hotel / activity / cab suggestions near the day's stop |
| `TripSetupPanel.tsx`, `RouteStopsEditor.tsx`, `RouteMiniMap.tsx`, `ItineraryMap.tsx` | trip setup and route visualisation |
| `ItineraryDocument.tsx`, `doc-theme.tsx`, `doc-theme-data.ts`, `doc-tokens.ts` | the live client-facing document preview and its theming |
| `ItineraryPdfExport.tsx`, `pdfExport.ts` | capture-to-PDF export with required-field validation |
| `day-mutations.ts`, `builder-dnd.tsx`, `use-undoable-state.ts`, `use-local-draft.ts` | state machinery |

Two design decisions worth knowing:

**One surface.** The rail answers "where do I go" (Client, Trip, Destinations, Itinerary,
Travel, Add-ons — then, below a divider, the catalog: Hotels, Things, Cabs), and a drawer
answers "change this thing I just clicked". Both render in the same right-hand column, and
an open drawer takes precedence over the rail selection.

**Two-layer autosave.** Server autosave runs every few seconds; `use-local-draft.ts` also
writes the form to `localStorage` on every change. The two are tied by one rule — *a
successful server save deletes the local draft* — so a draft existing on load means exactly
"there were unsaved changes when this tab last stopped", with no timestamp comparison. A
restore is announced, not silent, and is undoable. `DRAFT_VERSION` invalidates drafts whose
shape no longer matches.

Undo/redo is provided by `use-undoable-state.ts`; drag-and-drop day reordering by
`builder-dnd.tsx`.

### Entry points

- `/dashboard/package-builder` lists the exec's packages and queries awaiting a quote
  (`getPackageBuilderQueries`).
- `copyPackageIntoDraft(...)` materialises a catalog package (chosen from the Package
  Library) into a new draft.
- `duplicateCustomPackageIntoDraft(sourcePackageId)` clones an existing quote — the "two
  budget options for the same lead" path.

---

## 5. Itinerary Settings — `/dashboard/itinerary-settings`

A **single-row table** (`id = "singleton"`) holding everything that must stay consistent
across every itinerary the company sends:

```prisma
model itinerary_settings {
  id                      String @id @default("singleton")
  companyPhone, companyEmail, companyAddress, companyDescription, documentDisclaimer
  inclusions, exclusions, termsConditions, paymentPolicy, amendmentPolicy, travelBenefits  String[]
  customPolicySections    Json  @default("[]")   // [{ id, title, items }]
  defaultMarginPercentage Float @default(25)
  defaultGstPercentage    Float @default(5)
  defaultTemplate         String @default("classic")
  themeOverrides          Json  @default("{}")   // { accent?, paper?, ink?, fontHeading?, fontBody? }
  updatedAt, updatedBy, updatedByName
}
```

- The six standard lists are **admin-only**. A Sales Executive can add per-package items
  (`extraPolicyItems`) but can never edit or remove a standard line — enforced by
  `assertNotSalesExecutive()` in `itinerary-settings/actions.ts` and surfaced as a lock
  notice on the builder's Inclusions tab.
- `defaultMargin/GstPercentage` only seed a **new** draft; each package remains editable
  afterwards.
- `defaultTemplate` is a plain `String`, not an enum — templates are a front-end design
  catalogue that will gain entries faster than the schema should churn, and an unresolvable
  id falls back to the house template at render time instead of breaking the row.
- `themeOverrides` values are re-validated at render (`resolveDocTheme`) before reaching a
  style attribute, so a malformed entry is ignored rather than painted.

Theme resolution order: package `themeOverrides` → package `template` → company
`themeOverrides` → company `defaultTemplate` → built-in house template.

---

## 6. Gotchas

- **Approval ≠ send.** `verified` unlocks the exec's send button; only
  `sendPackageToClient` sets `SENT` and locks `pricingSnapshot`.
- Editing is locked while `status === "READY"`. Both a costing rejection and an exec
  revision request unlock it by returning the package to `DRAFT`.
- Never set `hotelSubtotalOverride` / `cabSubtotalOverride` again — they are retired and
  outrank per-day corrections in `computeFinalPackagePricing`.
- `custom_itineraries` snapshots hotel/room details; changing the catalog does not update
  existing quotes, which is intended.
- A package with `hotelPending` days cannot be marked ready — it must go through
  `/dashboard/hotel-requests` first.
- `paymentLink` is a manually pasted URL with no gateway integration; nothing reconciles it.
- The costing pricing history is logged under entity `"CustomPackagePricing"`, not
  `"custom_package"`.
