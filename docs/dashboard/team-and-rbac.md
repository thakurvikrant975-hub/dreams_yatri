# Team & RBAC — members, roles, permissions, activity logs, profile

The **Our Team** sidebar group plus the staff profile page. This is where dashboard access
itself is administered, so it is also where the RBAC model is defined in practice.

| Page | Route | State |
|---|---|---|
| Team Members | `/dashboard/team-members` | built |
| Team Roles | `/dashboard/roles-and-permissions` | built |
| Activity Logs | `/dashboard/activity-logs` | built |
| Departments | `/dashboard/departments` | **nav entry only** — no route exists; departments are seeded (`prisma/seed/`) and selected from dropdowns |
| Profile | `/dashboard/profile` | built (not in the sidebar; reached from the avatar menu) |

---

## 1. Data model

```prisma
model Department {
  id   String @id @default(cuid())
  name String @unique @db.VarChar(100)
  description String? @db.VarChar(500)
  members         TeamMember[]
  currentBookings Booking[]         @relation("BookingCurrentDept")
  timelineEntries BookingTimeline[] @relation("TimelineDepartment")
  @@map("departments")
}

model TeamRole {
  id   String @id @default(cuid())
  name String @unique @db.VarChar(100)
  description String?
  permissions Json @default("[]")   // PermissionSet
  pageAccess  Json @default("[]")   // string[] of sidebar hrefs
  members     TeamMember[]
  @@map("team_roles")
}

model TeamMember {
  id, name, email @unique, password (bcrypt), employeeId @unique
  departmentId, teamRoleId
  isActive Boolean @default(true)
  joiningDate, lastLoginAt, createdById
  designation, personalEmail, personalMobile, alternativeMobile
  fatherName/Mobile, motherName/Mobile
  aadhaarNumber, aadhaarFileKey, aadhaarFileUrl
  panNumber,     panFileKey,     panFileUrl
  profilePicKey, profilePicUrl
  // work assignment back-refs:
  currentBookings / hotelBookings / cabBookings / opsBookings  Booking[]
  confirmedHotelBookings BookingHotel[]  confirmedCabBookings BookingCab[]
  timelineEntries BookingTimeline[]      manualDocuments ManualDocument[]
  @@map("team_members")
}
```

A `TeamMember` is the **dashboard identity** — completely separate from the public site's
`User` (see [`../PROJECT_OVERVIEW.md`](../PROJECT_OVERVIEW.md) §3). The four `Booking`
relations exist because a booking is worked by several people at once: a current assignee,
plus per-department owners for hotels, cabs and ops.

---

## 2. Team Members — `/dashboard/team-members`

Files: [`(main)/team-members/`](<../../app/(dashboard)/dashboard/(main)/team-members/>) —
`TeamMembersTable.tsx`, `Createteammemberdialog.tsx`, `EditTeamMemberDialog.tsx`,
`Memberdetaildrawer.tsx`, `actions.ts`.

### Creating

`createTeamMember(input)` zod-validates, rejects a duplicate email up front, hashes the
password with **bcrypt cost 12**, and generates an `employeeId` via `generateEmployeeId()`.
Department and role are `connect`ed only when provided — a member can exist with neither,
though the dashboard layout will then block them with "Access Not Configured" until a role
is assigned.

Prisma error mapping is deliberate: `P2002` is decoded to a human message, falling back to
parsing the raw constraint text because *the pg driver adapter doesn't always populate
`meta.target`*; `P2003` reports an invalid `departmentId` / `roleId`.

Both success and failure write an `ActivityLog` entry — failures at `severity: "HIGH"`.

### Updating

`updateTeamMember(input)` snapshots the previous name/email/isActive/joiningDate for the
audit diff, and treats `departmentId` / `roleId` tri-state: absent = leave alone, a value =
`connect`, `null` = `disconnect`. A password in the payload is re-hashed.

### Passwords

| Action | Behaviour | Log |
|---|---|---|
| `updateMemberPassword(id, plain)` | min 8 chars, bcrypt cost 12 | `PASSWORD_CHANGE`, `metadata.type: "manual_set"`, severity HIGH |
| `resetMemberPassword(id)` | generates a 14-char password from an unambiguous alphabet (no `I`/`l`/`O`/`0`) and **returns the plaintext once** so an admin can hand it over | `PASSWORD_CHANGE`, `metadata.type: "system_reset"`, severity HIGH |

`getMemberPassword(memberId)` returns the stored **bcrypt hash** — it can't reveal a
password, and nothing in the UI should present it as one.

### Deleting

`deleteTeamMember(id)` refuses to delete the acting user ("Cannot delete yourself"), removes
the row, then cleans up the member's R2 objects (profile picture, Aadhaar, PAN) with
`Promise.allSettled` so one failed delete doesn't abort the rest. Logged at severity HIGH
with the previous record attached.

`toggleActive(id)` flips `isActive` — an inactive member fails the `requireMember()` gate
used across bookings, hotel-requests and fulfilment actions, so deactivation is the
soft-off switch and deletion is rarely the right tool.

### Document uploads

`uploadProfilePic`, `uploadAadhaarFile`, `uploadPanFile` all validate MIME type and size
(profile pictures: JPEG/PNG/WebP under 2 MB), delete the previous R2 object first, then
upload to the `team-members/` folder and store both key and URL.
`checkEmailAvailability(email, excludeId?)` powers live validation in the dialogs and
treats "same member" as available.

---

## 3. Team Roles — `/dashboard/roles-and-permissions`

Three tabs over one `TeamRole` row.

### Roles tab

`Rolestable.tsx` / `Roledialog.tsx` — `getRoles`, `getRoleById`, `createRole`, `updateRole`,
`deleteRole`. Deletion is refused while members are assigned, naming the count.

### Data Permissions tab

`PermissionPage.tsx` / `Permissionbuilder.tsx` edit `TeamRole.permissions`, a
`PermissionSet`:

```ts
[{ resource: "hotels", actions: [...], fields: { visible: string[], editable: string[] } }, …]
```

Resources and their fields come from `lib/rbac/field-registry.ts` (`FIELD_REGISTRY`), which
currently registers `destinations`, `hotels` and `team_members` and marks certain fields
`sensitive` (commission %, internal code, salary). Helpers in `lib/rbac/permissions.ts`:

```ts
can(permissions, resource, action)      // does this role have the action?
visibleFields(permissions, resource)    // [] means unrestricted
editableFields(permissions, resource)
filterDataFields(rows, resource, permissions)   // strip fields before returning data
```

`filterDataFields` treats an **empty** visible-field list as "no restriction", so a
resource that hasn't been configured is fully readable rather than silently blank.

### Sidebar / Page Access tab

`page-access/PageAccessEditor.tsx` (and the older `SidebarAccessEditor`) edit
`TeamRole.pageAccess` — a plain array of sidebar hrefs, grouped in the UI exactly like
`NAV_GROUPS`. **Empty means unrestricted.**

Three write actions exist because the tabs must not clobber each other:
`updateRolePermissions` (permissions only), `updateRolePageAccess` (page access only), and
`updateRoleAccess` (both, used by the combined editor).

Enforcement happens twice — in `AppSidebar` (what you can see) and again in the
`(main)/layout.tsx` guard (what you can reach by typing a URL). Both resolve the current
path through `resolveNavHref()`, so **an href not present in `ALL_HREFS` resolves to
nothing and is therefore never blocked**. Adding a page means adding it to `nav-items.ts`
*and* `nav-hrefs.ts`.

### Two reserved role names

Role names are compared as lower-cased strings in several places:

- **`"full stack developer"`** — bypasses `pageAccess` entirely and is the only role that
  can use View As.
- **`"sales executive"`** — gets the sales target badge and the follow-up / package-status
  notification providers, and is blocked from editing `itinerary_settings`.

Renaming either role in the UI silently changes behaviour.

---

## 4. View As (impersonation)

`actions/view-as-actions.ts`. `assertFSD()` re-checks the Full Stack Developer role on
**every** call — the cookie alone is never trusted.

- `getViewableMembers()` — active members only; returns `[]` for anyone who isn't FSD.
- `startViewingAs(memberId)` — verifies the member exists, then sets the `dy_view_as`
  cookie: `httpOnly`, `sameSite: "lax"`, `path: "/dashboard"`, 8-hour max-age (matching the
  dashboard session lifetime).
- `stopViewingAs()` — clears it **with the same path**, otherwise the browser ignores the
  delete, and revalidates the layout.

`getEffectiveMember()` (in `lib/get-current-member.ts`) resolves the cookie into
`{ realMember, member, isImpersonating }`. The sidebar and page-access reflect the
impersonated member; the header always shows the real user, with a "viewing as" banner.
FSD still bypasses enforcement, so impersonation is a **preview** of another role's
navigation, not a downgrade of the FSD's own access.

---

## 5. Activity Logs — `/dashboard/activity-logs`

The read side of `createLog()` (described in [`README.md`](./README.md) §3).

```prisma
model ActivityLog {
  userId, userEmail, userName, userRole, userDesignation
  action LogAction       // CREATE UPDATE DELETE LOGIN LOGOUT LOGIN_FAILED
                         // PASSWORD_CHANGE PERMISSION_CHANGE EXPORT BULK_ACTION VIEW_SENSITIVE
  entity String          // free text, e.g. "Hotel", "Region", "destination"
  entityId, entitySlug, description
  previousData, newData, metadata  Json?
  status LogStatus @default(SUCCESS)   // SUCCESS | FAILED | …
  errorMessage, statusCode
  severity LogSeverity @default(LOW)   // LOW | MEDIUM | HIGH | CRITICAL
  isSuspicious Boolean @default(false)
  flagReason
  ipAddress, userAgent, referer, requestMethod, requestPath, sessionId, requestId
  country, region, city                // resolved from IP
  actionAt DateTime @default(now())
  @@map("activity_logs")
}
```

`getLogsPaginated(page)` — fixed page size of **15**, newest first, count and rows in one
`$transaction`. `getLogStats()` returns total / today / failed / critical / suspicious.

The table renders the `previousData` → `newData` diff; the `ChangeSummary` UI auto-filters
to keys that actually changed, which is why writers can pass a full before/after map without
noise (see `updatePackagePricing` in
[`custom-package-builder.md`](./custom-package-builder.md)).

Notes:

- Logging never throws — a failure is swallowed and console-logged, so it can't fail a
  user's action. That also means **absence of a log is not proof an action didn't happen**.
- `entity` is a free-text convention, not an enum, and is spelled inconsistently across
  modules. Match the exact string a module writes when querying history.
- IP geolocation calls `ip-api.com` over plain HTTP with a 1-hour revalidate; private/loopback
  addresses are skipped.
- There is no retention policy or archival job — the table grows without bound.

---

## 6. Profile — `/dashboard/profile`

The signed-in member's own record: `getMyProfile`, `updateAvatar`, `updatePersonalDetails`,
`updateFamilyDetails`, `updateIdentityDocuments`, and `changeMyPassword` (which verifies the
current password before setting a new one). Same fields as the admin's Team Members editor,
scoped to self.

---

## 7. Gotchas

- A member with no `teamRole` is blocked from the whole dashboard by the layout — assign a
  role immediately after creating an account.
- Empty `pageAccess` = **unrestricted**, not "no access". The same inversion applies to
  `visibleFields`.
- `resolveNavHref` only knows hrefs listed in `nav-hrefs.ts`; a page missing from it is
  unguardable by page access.
- `resetMemberPassword` returns the plaintext exactly once, in the action result. It is
  never stored or emailed.
- Deleting a member is destructive across their booking assignments; prefer `toggleActive`.
- `/dashboard/departments` is in the sidebar but has no page — departments come from seeds.
