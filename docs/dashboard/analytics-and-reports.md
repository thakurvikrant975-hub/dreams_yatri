# Dashboards, Analytics & Reports

The **Overview** sidebar group — the role-specific home page, the analytics page, and the
department work tracker — plus a note on the Settings group.

| Page | Route | Shape |
|---|---|---|
| Dashboard | `/dashboard` | one of nine role-specific dashboards, chosen at request time |
| Analytics | `/dashboard/analytics` | per-role analytics view, date-ranged |
| Reports | `/dashboard/reports` | department work tracker with period presets |
| Locations | `/dashboard/locations` | see [`content-management.md`](./content-management.md) §4 |
| Itinerary Settings | `/dashboard/itinerary-settings` | see [`custom-package-builder.md`](./custom-package-builder.md) §5 |
| General Settings | `/dashboard/settings` | **nav entry only** — no route exists |

Per-role server actions live in
[`(main)/actions/`](<../../app/(dashboard)/dashboard/(main)/actions/>), one file per role.

---

## 1. Role dashboards — `/dashboard`

[`(main)/page.tsx`](<../../app/(dashboard)/dashboard/(main)/page.tsx>) picks a component
from a map, keyed by **role name, falling back to department name**, both lower-cased:

```ts
const ROLE_DASHBOARD_MAP: Record<string, DashboardComponent> = {
  "sales executive":       SalesDashboard,
  "marketing":             MarketingDashboard,
  "data entry executive":  DataEntryDashboard,
  "data entry operator":   DataEntryDashboard,
  "travel expert":         TravelExpertDashboard,
  "inventory manager":     InventoryManagerDashboard,
  "platform manager":      PlatformManagerDashboard,
  "hotel department":      HotelDepartmentDashboard,
  "cab department":        CabDepartmentDashboard,
};
// anything else → DefaultDashboard
```

The identifier comes from `getEffectiveMember()`, so a Full Stack Developer using **View
As** sees the impersonated member's dashboard — the whole point of the feature.

Because the map is keyed by *string*, renaming a role in Team Roles silently drops its
dashboard back to `DefaultDashboard`. The same string-keyed pattern repeats in the analytics
page, the layout's sales-only providers, and the FSD impersonation check — see
[`team-and-rbac.md`](./team-and-rbac.md) §3.

Each dashboard is backed by its own action file:

| Dashboard | Actions |
|---|---|
| Sales | `sales-dashboard-actions.ts.ts` *(note the doubled extension)*, `sales-target-actions.ts` |
| Data Entry | `data-entry-dashboard-actions.ts` |
| Travel Expert | `travel-expert-dashboard-actions.ts` |
| Inventory Manager | `inventory-manager-dashboard-actions.ts` |
| Platform Manager | `platform-manager-dashboard-actions.ts` |
| Hotel Department | `hotel-department-dashboard-actions.ts` |
| Cab Department | `cab-department-dashboard-actions.ts` |

### Sales target badge

`getSalesTargetData(memberId)` (rendered in the dashboard header for sales executives)
counts bookings where the member is `currentAssigneeId`, status `CONFIRMED`, created in the
current calendar month, and sums `totalAmount`.

**`monthlyTarget` is hard-coded to 20** with a comment to replace it once a `SalesTarget`
model exists — there is no per-member target in the schema today.

---

## 2. Analytics — `/dashboard/analytics`

Same role-keyed dispatch, a separate map:

```ts
const ANALYTICS_MAP = {
  "platform manager": PlatformManagerAnalyticsSection,
  "hotel department": HotelDepartmentAnalyticsSection,
};
// everything else → GeneralAnalyticsSection (site-wide performance)
```

The date range comes from `?from=&to=` search params, both defaulting to **today**. Sections
are async server components, so each role's query runs only for the role that renders it.

### General analytics

`getGeneralAnalytics(from, to)` — bookings created in the window, returning:

- `totalBookings`, `totalRevenuePaise`, `avgBookingValuePaise`, `cancelledBookings`
- `dailyTrend` — bookings and revenue per day
- `statusBreakdown` — `groupBy(status)` with a fixed colour per status
- `topDestinations` — `groupBy(destination)` against an 8-colour palette

Revenue counts only `PAID_STATUSES = ["CONFIRMED", "COMPLETED", "ONGOING", "UPCOMING"]`.
Chart colours are CSS custom properties (`var(--color-dashboard-*)`), so analytics follows
the dashboard theme rather than hard-coding hex values. Range is capped at
`MAX_DAYS = 366`.

### Platform-manager analytics

This one reads the **`ActivityLog`**, not the domain tables — it answers "who did what,
and when" across the content-entry departments.

Every log entry is classified into `hotel | cab | travel | other`:

```ts
if (userRole === "Hotel Department") return "hotel";
if (userRole === "Cab Department")   return "cab";
if (userRole === "Travel Expert")    return "travel";
if (userRole === "Inventory Manager") return classifyEntity(entity);  // legacy role
return "other";
```

Explicit roles win; the legacy **Inventory Manager** role predates the split, so its entries
are classified by the entity they touched:

```ts
HOTEL_ENTITIES  = { "hotel" }
CAB_ENTITIES    = { "vehicle", "cabdriver", "cabpricing" }
TRAVEL_ENTITIES = { "package", "activity", "destination", "region" }
```

Entity names are lower-cased before matching because **activity-log entity casing is not
consistent across action files** (`"Hotel"` vs `"destination"`). Adding a new entity string
in a feature module without adding it to these sets makes that work invisible here.

Output includes per-department summaries (total actions, active vs total employees, top
employee), a per-employee `workReport` with create/update/delete counts and the individual
entries, a daily trend series per department, and entity/action/department breakdowns plus a
leaderboard.

---

## 3. Reports — `/dashboard/reports`

A **department work tracker**: how much content each team member produced in a period.
Four tabs — Sales, Hotel, Cab, Travel — selected by `?dept=`.

Period presets (`?period=`, validated against a whitelist):
`today`, `yesterday`, `this_week` (Monday-based), `current_month`, `last_month`, `custom`
(with `?from=&to=`). `toDateRange()` builds inclusive local-time boundaries — start of day
`00:00:00.000` to end of day `23:59:59.999` — so a report never silently excludes work done
late in the evening.

`getReportsData(period, from, to)` runs the four department reports plus the headline counts
in parallel. Unlike platform-manager analytics, this counts **real domain rows**, not log
entries — hotels/rooms/images created in the window, cab pricing rows and drivers added,
packages and activities added, sales queries and conversions — grouped by `created_by` and
joined to the member roster.

Two quality signals worth knowing: `hotelsWithoutRooms` (hotels created in the period with
`hotelRooms: { none: {} }`) and `driversWithVehicle` — both catch half-finished data entry
that a raw "records added" count would reward.

---

## 4. Settings

The sidebar's **Settings → General** entry (`/dashboard/settings`) has no route. The only
built settings page is **Itinerary Settings**
([`custom-package-builder.md`](./custom-package-builder.md) §5).

Small global toggles are stored in the generic key-value table rather than a settings page:

```prisma
model SystemSetting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?
  @@map("system_settings")
}
```

Currently used for the queries auto-assign toggle
(`SETTINGS_KEYS.autoAssignQueries`, see [`sales-crm.md`](./sales-crm.md) §2), read and
written through `getBoolSetting` / `setBoolSetting`.

---

## 5. Gotchas

- Role dashboards and analytics sections are keyed by **lower-cased role name**; renaming a
  role silently falls back to the default view. Department name is used only when the role
  name doesn't match.
- `monthlyTarget: 20` in the sales badge is a placeholder constant, not data.
- Platform-manager analytics depends on `ActivityLog.userRole` and `entity` strings.
  Entries written without a role, or with a new entity name, land in `"other"` and vanish
  from the report.
- Analytics is capped at 366 days per query.
- Reports counts domain rows by `created_by`; content created before that column was
  populated is attributed to nobody.
- `sales-dashboard-actions.ts.ts` really does have a doubled extension — it imports fine,
  but don't be surprised by it when grepping.
