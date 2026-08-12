# Sales CRM — leads, queries, follow-ups, package library

The lead pipeline: how an enquiry enters the system, gets verified and assigned, is worked
by a sales executive, and turns into a custom package. The builder itself and the costing
review that gates it are documented separately in
[`custom-package-builder.md`](./custom-package-builder.md).

| Page | Sidebar group | Who uses it |
|---|---|---|
| `/dashboard/queries` | Marketing | marketing — triage, verify/reject, assign |
| `/dashboard/sales-query` | Sales | sales executives — their own assigned leads |
| `/dashboard/follow-ups` | Sales | sales executives — everything due |
| `/dashboard/package-library` | Sales | sales executives — catalog packages as templates |

Files: [`(main)/(marketing)/queries/`](<../../app/(dashboard)/dashboard/(main)/(marketing)/queries/>)
and [`(main)/(sales)/`](<../../app/(dashboard)/dashboard/(main)/(sales)/>). The sales
`actions.ts` re-exports several marketing actions rather than duplicating them, so both
pages share one implementation of assignment, timeline logging and rejection reasons.

---

## 1. Data model

```
LeadProfile            one row per phone number — the person, across all their enquiries
 └─ package_queries    one row per enquiry
      ├─ QueryNote      free-text internal notes
      ├─ QueryTimeline  append-only event log (every action writes one)
      ├─ QueryFollowUp  scheduled call-backs (one per member per query)
      ├─ custom_packages  quotes built for this lead (0..n)
      └─ Booking        the conversion, if it happens (0..1)
```

### `package_queries`

```prisma
model package_queries {
  id                String      @id @default(cuid())
  name, email, phone, countryCode @default("IN")
  message, packageName, destination, travelDate, groupSize
  requirements      Json?       // structured traveller/preference blob
  packageUrl        String?

  source            QuerySource @default(WEBSITE_FORM)
  gclid, utmSource, utmMedium, utmCampaign, pageUrl      // ad attribution

  status            QueryStatus @default(SUBMITTED)
  verified          Boolean     @default(false)
  verifiedAt, verifiedBy
  rejectionReasonId String?     // → RejectionReason
  rejectionNote     String?

  callAttempts      Int         @default(0)
  lastAttemptAt, nextFollowUpAt
  assignedTo, assignedToName, assignedAt
  closeReasonId, closeReasonOther, closedAt, closedBy
  leadProfileId     String?     // → LeadProfile

  deletedAt, deletedBy          // soft delete
}

enum QueryStatus {
  SUBMITTED VERIFIED REJECTED ASSIGNED IN_PROGRESS FOLLOW_UP
  PACKAGE_SENT CLIENT_ACCEPTED CLIENT_DECLINED PAYMENT_INITIATED CONVERTED CLOSED
}

enum QuerySource {
  WEBSITE_FORM LANDING_PAGE WHATSAPP PHONE_CALL REFERRAL OTHER
  CONTACT_FORM PACKAGE_FORM META
}
```

**Deletion is soft.** "Delete Query" sets `deletedAt` / `deletedBy` and every listing
filters `deletedAt: null`, so history is preserved and a booking or custom package still
linked to the query keeps resolving by id.

`LeadProfile` (unique on `phone`) aggregates repeat enquirers: `totalQueries`,
`lastSeenAt`. The queries list surfaces `totalLeadQueries` from it, so an exec can see
"this is their 4th enquiry" without a lookup.

`RejectionReason` is a shared, admin-managed lookup (`isSystem`, `isActive`, `sortOrder`)
used both for rejecting a *query* and for rejecting a *custom package's pricing*.

---

## 2. Lead lifecycle

```
        website form / landing page / WhatsApp / manual entry
                              │
                        SUBMITTED
                    ┌─────────┴─────────┐
              verifyQuery          rejectQuery  →  REJECTED (reason + note)
                    │
                 VERIFIED ──assignQuery──► ASSIGNED
                                              │
                                        markInProgress
                                              │
                                        IN_PROGRESS ──addFollowUp──► FOLLOW_UP
                                              │
                                   (custom package sent)
                                              │
                                        PACKAGE_SENT
                                              │
                        CLIENT_ACCEPTED / CLIENT_DECLINED
                                              │
                              PAYMENT_INITIATED → CONVERTED
                                              │
                                   closeSalesQuery → CLOSED
```

Every transition writes a `QueryTimeline` row through `logTimeline(queryId, event, actorId,
actorName, meta?)` — the timeline is the audit trail for the whole CRM, and other modules
write into it too (a hotel fill, a costing approval, a package send).

### Verification & rejection

`verifyQuery(queryId)` sets `verified`, `verifiedAt`, `verifiedBy` and moves the status to
`VERIFIED`. `rejectQuery(queryId, formData)` requires a `RejectionReason` and stores an
optional note — this is the junk/spam/duplicate filter before a lead consumes an exec's
time.

### Assignment and auto-assign

`assignQuery(queryId, memberId, setStatus = true)` writes `assignedTo`, `assignedToName`,
`assignedAt` and flips the status to `ASSIGNED` (or back to `VERIFIED` when unassigned).
Passing `memberId = null` clears the assignment. `setStatus = false` lets a caller re-point
a query without disturbing where it sits in the funnel.

Auto-assignment of incoming leads is a global toggle stored in `SystemSetting` (the generic
key-value table) under `SETTINGS_KEYS.autoAssignQueries`, read/written by
`getAutoAssignSetting()` / `setAutoAssignSetting(enabled)` and defaulting to **on**.

### Call attempts

`logCallAttempt(...)` increments `callAttempts`, stamps `lastAttemptAt` and records the
outcome on the timeline, so "we tried three times and they never picked up" is evidenced
rather than asserted.

### Manual entry & duplicate detection

`createManualQuery(...)` lets staff enter a phone/walk-in enquiry.
`checkExistingQueryByPhone(phone)` runs first and returns a match so the exec can decide
whether this is a genuinely new enquiry or a repeat from an existing lead.

### Closing and reopening

`closeSalesQuery(queryId, formData)` takes a close reason (structured id, plus a free-text
`closeReasonOther`) and stamps `closedAt` / `closedBy`; `reopenSalesQuery(queryId)` reverses
it. Closure is distinct from rejection: rejection means the lead was never valid, closure
means it was worked and ended.

---

## 3. Marketing Queries — `/dashboard/queries`

The triage desk. `getQueries()` returns every non-deleted query with its rejection reason,
note/follow-up counts, the lead's total query count, and the `sentAt` of any custom package
built for it — so one table shows both "how hot is this lead" and "have we quoted yet".

Also here: full CRUD for `RejectionReason` (`createRejectionReason`, `updateRejectionReason`,
`toggleRejectionReason`, `deleteRejectionReason`), the auto-assign toggle, manual query
creation, `updateQuery` and soft `deleteQuery`.

---

## 4. Sales Queries — `/dashboard/sales-query`

The executive's own workspace. `getSalesQueries()` returns their assigned queries enriched
with `customPackages: SentPackageInfo[]` — every quote built for the lead and its status —
so the exec can see at a glance which leads still need a package and which are awaiting a
client decision.

The detail sheet (`Salesquerydetailsheet.tsx`) carries notes, timeline, follow-ups, the
requirements editor (`savePackageRequirements`) and the "Create Package" dialog that jumps
into the builder.

Two background providers are mounted in the dashboard layout **for sales executives only**:

- `FollowUpReminderProvider` — surfaces due follow-ups as toasts.
- `PackageStatusNotifier` — polls `getMyUnseenPackageEvents()` and toasts when one of the
  exec's packages is approved, rejected, or has had a hotel filled in. Each event is
  one-shot: `custom_packages.execNotifiedAt` (and per-day
  `custom_itineraries.hotelFillNotifiedAt`) is stamped once shown, and cleared again when a
  genuinely new event occurs.

---

## 5. Follow-ups — `/dashboard/follow-ups`

```prisma
model QueryFollowUp {
  packageQueryId String
  note           String
  followUpAt     DateTime?
  createdById, createdByName
}
```

`addFollowUp(packageQueryId, formData)` is an **upsert keyed on (query, member)** — each
team member keeps exactly one follow-up per query; saving again updates the existing row
rather than stacking duplicates. When a date is given it also mirrors to
`package_queries.nextFollowUpAt`, which is what the reminder poller and the follow-ups list
sort on.

Saving a follow-up moves the query to `FOLLOW_UP`, but **never downgrades** one already
further along:

```ts
const terminalOrLaterStatuses = [
  "PACKAGE_SENT", "CLIENT_ACCEPTED", "CLIENT_DECLINED",
  "PAYMENT_INITIATED", "CONVERTED", "CLOSED",
];
```

`getMyFollowUps()` / `getMyFollowUpForQuery()` scope to the current member;
`deleteFollowUp` removes one.

---

## 6. Package Library — `/dashboard/package-library`

A read-only browse of the **catalog** packages (`packages`, documented in
[`../packages/admin-package-itinerary-builder.md`](../packages/admin-package-itinerary-builder.md))
from the sales side — used as a starting template rather than as a sellable product.

- `getSalesPackageLibrary({ search, destinationId })` returns active packages with their
  destination/region and the slug of the default duration and its first route — enough to
  deep-link into the right variant.
- `searchPackageLibraryForTemplate(...)` powers the "Create Package" dialog: a searchable,
  load-more list matching on title, destination **and** region, with route, stay categories
  and duration summarised inline so an exec can pick without leaving the dialog.
- `getPackageVariantOptions(...)` and `getTemplatePackagePriceForCategory(...)` resolve the
  duration × route × stay-tier combination and its indicative price.

Choosing one calls `copyPackageIntoDraft(...)` in the builder, which materialises the
catalog itinerary into a fresh `custom_packages` draft the exec can then edit freely — the
copy is a snapshot, so later catalog edits don't alter quotes already built.

---

## 7. Gotchas

- Queries are **soft-deleted**; always filter `deletedAt: null` in new queries.
- `QueryTimeline` is the cross-module audit trail — hotel fills, costing decisions and
  package sends all write to it via `logTimeline`, imported from the *marketing* actions
  file even by non-marketing code.
- A follow-up is unique per `(query, member)` — don't expect a history of follow-ups per
  member on one query; the timeline holds that.
- `assignQuery(..., setStatus: false)` exists specifically so reassignment doesn't reset
  funnel position. Use it when moving work between execs.
- Role name `"sales executive"` (lower-cased comparison) controls the sales-only layout
  providers and the sales target badge.
