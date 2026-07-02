# Channel Management — Phase 3: Rates & Availability Calendar (owner)

**Status:** ✅ COMPLETE (data paths verified; UI type-checked — view after `next dev` restart)

## What was built

A per-property owner calendar at **`/hotel-connect/properties/[id]/calendar`**:

- `page.tsx` — server component: auth + ownership (`hotels.findFirst({ id, owner_id })`), loads
  active rooms, renders the current month for the first room via `getRoomARI`.
- `CalendarClient.tsx` — month grid for the selected room. Each day cell shows the resolved
  **price** + **available/total**, with stop-sell (red / `NoSymbol`) and price-override (`Tag`)
  markers. Room switcher + month nav. Past dates are disabled.
- **Range bulk-edit:** click a start date then an end date to select a range, then the side panel
  applies a patch to every night — price override (or clear → back to season price), total units,
  open/stop-sell, Min LOS, CTA, CTD.
- `calendar-actions.ts` — `fetchRoomCalendar` (read a month via `getRoomARI`) and
  `saveAvailabilityRange` (ensure rows + `updateMany` over `[from,to]` inclusive), both
  ownership-checked.
- Properties list card now links to the calendar ("Rates").

## Verified

- **Read path** (`getRoomARI`) — verified in Phase 2 (room 59, real pricing).
- **Write path** (`saveAvailabilityRange` core) — fresh-client run: `ensure` + `updateMany` over a
  4-night range patched `price_override`/`stop_sell`/`total_units`/`min_los` on all 4 nights;
  `date: { gte, lte }` on the `@db.Date` column works. Cleaned up.
- UI type-checks clean. Rendering requires restarting the dev server (stale Prisma client).

## Notes / follow-ups

- v1 is a **single-room month view** (Airbnb-style) — clean and mobile-friendly. A rooms×dates
  matrix (all rooms at once) is a possible v2.
- Selection is a contiguous range; arbitrary multi-select could come later.
- Writes go straight to the ledger; when Channex lands (Phase 7), these same edits enqueue an
  ARI push.
