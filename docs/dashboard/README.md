# Dreams Yatri — Admin / CRM Dashboard (Feature Reference)

Documentation for the internal staff dashboard at `/dashboard` — every module in the
sidebar, its Prisma schema, and how the feature actually works end-to-end.

This folder is the **feature-by-feature** reference. For the surrounding system see:

| Topic | Doc |
|---|---|
| Whole-repo overview, auth instances, tech stack | [`../PROJECT_OVERVIEW.md`](../PROJECT_OVERVIEW.md) |
| Every API route + server action signature | [`../API_REFERENCE.md`](../API_REFERENCE.md) |
| Customer booking & payment flow | [`../booking/booking-system.md`](../booking/booking-system.md) |
| Travel-package data model, route + itinerary builder, pricing engine | [`../packages/admin-package-itinerary-builder.md`](../packages/admin-package-itinerary-builder.md) |
| Hotel-owner self-service portal (`/hotel-connect`) | [`../hotel-connect/hotel-connect-dashboard.md`](../hotel-connect/hotel-connect-dashboard.md) |
| Channel manager / real-time ARI sync | [`../channel-management/channel-management-plan.md`](../channel-management/channel-management-plan.md) |

## Module docs

| Doc | Sidebar groups covered |
|---|---|
| [`content-management.md`](./content-management.md) | Regions, Destinations, Locations, Package Categories, Policies |
| [`activities.md`](./activities.md) | Activities, Activity Categories |
| [`hotels.md`](./hotels.md) | Hotels, Hotel Directory, Hotel Inventory, Expiring Rates, Hotel Approvals, Property Submissions, Hotel Owners, Meal/Diet Types, Verify Hotels, Hotel Requests, Hotel Bookings |
| [`cab-management.md`](./cab-management.md) | Vehicle Types, Cab Pricing, Cab Inventory, Permits, Cab Drivers, Verify Cabs, Assign Drivers, Cab Directory |
| [`sales-crm.md`](./sales-crm.md) | Marketing Queries, Sales Queries, Follow-ups, Package Library |
| [`custom-package-builder.md`](./custom-package-builder.md) | Package Builder, Verify Packages, Itinerary Settings |
| [`marketing.md`](./marketing.md) | Landing Pages, Blog Reviews, Coupons |
| [`bookings-ops.md`](./bookings-ops.md) | Package Bookings, Upcoming Guests, Manual Documents, Transactions |
| [`team-and-rbac.md`](./team-and-rbac.md) | Team Members, Team Roles, Departments, Activity Logs, Profile |
| [`analytics-and-reports.md`](./analytics-and-reports.md) | Dashboard home (role dashboards), Analytics, Reports, Settings |

---

## 1. Shape of the dashboard

```
app/(dashboard)/dashboard/
├── (auth)/login/             # staff sign-in (email + password → TeamMember)
├── (builder)/                # full-screen package builder (own layout, no sidebar)
│   └── package-builder/[packageId]
└── (main)/                   # everything else — sidebar + auth + RBAC gate
    ├── layout.tsx            # session → member → page-access guard → sidebar/header
    ├── page.tsx              # role-specific home dashboard
    ├── (cabs)/  (marketing)/  (sales)/     # route groups; URLs stay flat
    ├── actions/              # per-role dashboard/analytics server actions
    ├── components/           # shared dashboard UI (tables, sheets, filters, charts)
    └── lib/                  # get-current-member, logger, rbac/
```

Route groups (`(cabs)`, `(marketing)`, `(sales)`) only organise files — they do **not**
appear in the URL. `/dashboard/cab-pricing` lives at `(main)/(cabs)/cab-pricing`.

---

## 2. Access control

Three layers, all keyed off `TeamMember` → `TeamRole`:

1. **Middleware** (`middleware.ts`) — reads the `dy.dashboard.session-token` JWT, redirects
   unauthenticated requests to `/dashboard/login`, and forwards the requested path as an
   `x-pathname` header.
2. **Layout guard** ([`(main)/layout.tsx`](<../../app/(dashboard)/dashboard/(main)/layout.tsx>)) —
   loads the member, blocks the whole dashboard when `teamRole` is null ("Access Not
   Configured"), then resolves `x-pathname` through `resolveNavHref()` and `redirect()`s
   when the resolved href is not in `teamRole.pageAccess`. An empty `pageAccess` array
   means unrestricted.
3. **Per-action guard** — every server action re-checks the session itself
   (`dashboardAuth()`), because a Server Action is a POST endpoint that layout guards
   never see.

```prisma
model TeamRole {
  permissions Json @default("[]")   // PermissionSet — resource × actions × field visibility
  pageAccess  Json @default("[]")   // string[] of sidebar hrefs; [] = unrestricted
}
```

- `lib/rbac/nav-items.ts` — `NAV_GROUPS`, the single source of truth for the sidebar.
- `lib/rbac/nav-hrefs.ts` — icon-free mirror (`ALL_HREFS`, `resolveNavHref`) so the RSC
  layout can import it without pulling icon libraries into the server bundle.
- `lib/rbac/permissions.ts` — `can()`, `visibleFields()`, `editableFields()`,
  `filterDataFields()` helpers over `TeamRole.permissions`.
- `lib/rbac/field-registry.ts` — `FIELD_REGISTRY`, per-resource field lists (with a
  `sensitive` flag) that drive the Data-Permissions builder UI.

### "View As" impersonation

`lib/get-current-member.ts` exposes `getEffectiveMember()`, which returns
`{ realMember, member, isImpersonating }`. Only a member whose role name is
**Full Stack Developer** can impersonate: setting the `dy_view_as` cookie (via
`actions/view-as-actions.ts`) makes the sidebar and page-access reflect the target
member, while the header keeps showing the real user. FSD themselves bypass
`pageAccess` enforcement entirely.

Role names are matched case-insensitively as strings in several places
(`"full stack developer"`, `"sales executive"`) — renaming a role in the UI silently
changes behaviour, so treat those two names as reserved.

---

## 3. Conventions every module follows

These recur across nearly all feature folders, so each module doc only notes where it
*deviates*.

### Folder layout

```
<feature>/
  page.tsx            # Server Component: parses + whitelists searchParams, renders Client
  <Feature>Client.tsx # react-query data fetching, filter state → URL, dialogs
  <Feature>Table.tsx  # @tanstack/react-table list
  <Feature>Dialog.tsx # create/edit form (react-hook-form + zod) or a Sheet
  actions.ts          # "use server" — reads + mutations
  [id]/page.tsx       # detail/edit view where the entity is big enough to need one
```

`page.tsx` never trusts the query string: each param is parsed and clamped against a
whitelist (`VALID_LIMITS = [10, 20, 50]`, `VALID_STATUSES`, …) before being handed down.
Filters live in the URL, so a filtered list is shareable and survives a refresh.

### Server-action contract

```ts
export type XFormState = { success: boolean; message: string; errors?: Record<string, string[]> };
```

Mutations are `useActionState`-compatible `(prevState, formData) => FormState`, or plain
`(id, input) => FormState` calls for row actions. The order inside a mutation is always:

1. `requireSession()` / `requireActor()` — `dashboardAuth()`, bail with `Unauthorized`.
2. Zod parse (`app/lib/validators/*`) → return `errors` from `flatten().fieldErrors`.
3. Uniqueness / referential-integrity pre-checks (slug conflicts, linked children).
4. DB write.
5. R2 cleanup of any replaced image — **after** the DB write succeeds, never before.
6. `createLog({...})` audit entry.
7. `revalidatePath()` for every affected route.

Errors are normalised through `app/lib/result.ts` (`Result.unauthorized/notFound/conflict/dbError`)
and `app/lib/action-error.ts` (`classifyActionError`), so raw Prisma errors never reach the UI.

### Audit logging

`lib/logger.ts` → `createLog(payload)` writes one `ActivityLog` row per mutation and
enriches it automatically: actor from the session, IP from `x-forwarded-for`, geo lookup
via ip-api.com, user agent, referer, a hashed `sessionId`, and a generated human-readable
`description` when none is passed. It never throws — a logging failure is swallowed and
logged to the console so it can't fail the user's action.

Most list/detail views expose a **History** panel that reads back
`activityLog.findMany({ where: { entity: "<Entity>", entityId } })`. The `entity` string
is a free-text convention, not an enum — it is spelled inconsistently across modules
(`"Region"` vs `"destination"`), so match the exact casing a module writes when querying.

### Images

All uploads go to Cloudflare R2 through `app/api/upload` and `app/lib/r2/*`; the DB stores
the object key/URL. On update, the previous key is deleted only after the new row is
committed (`deleteFromR2(...).catch(console.error)`).

### Active / inactive and deletion

- `is_active` is the publish switch for public-site visibility. For SEO-bearing content
  (regions, destinations) activation is **blocked** unless `meta_title` and `meta_desc`
  are set — enforced both in the zod schema (`superRefine`) and again in the toggle action.
- Deletion is refused while children exist, with the blocking rows named in the error
  message. Some tables additionally carry soft-delete columns
  (`is_deleted`, `deleted_at`, `deleted_by`).

### Live counters

The sidebar's pending badges (verify hotels / verify cabs / package bookings / packages /
hotel requests) are seeded server-side by `app/services/verification-counts.service.ts`
and then kept live over Ably, instead of refetching on every navigation. The seed call is
wrapped in `.catch()` — badge counts are cosmetic and must never take the dashboard down.
