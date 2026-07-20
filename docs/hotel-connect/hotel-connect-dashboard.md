# Dreams Yatri — Hotel-Connect (Hotel Owner Dashboard)

In-depth documentation of `app/(hotel-connect)/hotel-connect/` — the self-service portal where
hotel/homestay **owners** manage their own listings, rates, availability, bookings, and guest
communication. It is a third, fully independent route group alongside the public site
(`app/(website)`) and the internal staff dashboard (`app/(dashboard)`), not covered in
[`docs/PROJECT_OVERVIEW.md`](../PROJECT_OVERVIEW.md) beyond the top-level repo layout.

---

## 1. What this is

Hotel-Connect is where a property owner signs up, builds a listing through a multi-tab wizard,
sets rates/inventory, and then runs their property day to day: sees bookings, replies to reviews,
messages guests, tracks revenue, and gets notified when a booking is confirmed. Listings only go
live after staff review in the internal dashboard (`app/(dashboard)/dashboard/(main)/verify-hotels/`) —
owners submit, staff approve.

```
Signup → email-verify (soft gate) → Listing wizard (7–8 tabs) → Submit for Review
   → staff approves (verify-hotels) → LIVE on public site
                                            │
                    Rates & Inventory (calendar + rate plans) ── independent of review status
                                            │
        Guest books → staff confirms hotel leg → owner notified (bell + email) → owner sees it
        in Bookings/Revenue, replies to Reviews, messages the guest in Group Inbox
```

---

## 2. Auth — a third independent NextAuth instance

`app/lib/auth-hotel-connect.ts` exports `hotelConnectAuth` / `hotelConnectSignIn` /
`hotelConnectSignOut` / `hotelConnectHandlers` — separate from the public-site auth
(`app/lib/auth.ts`) and the staff-dashboard auth (`app/lib/auth-dashboard.ts`), following the same
pattern described in [`PROJECT_OVERVIEW.md §3`](../PROJECT_OVERVIEW.md#3-authentication--two-independent-systems).

- **Cookie**: `dy.hotel-connect.session-token`, `httpOnly`, `sameSite: strict`, `path: /hotel-connect`
  — namespaced so it can never collide with the other two session cookies.
- **Session**: JWT, 24-hour lifetime.
- **Provider**: single `Credentials` provider. `authorize()` looks up `db.hotelOwner.findUnique({ email })`,
  bcrypt-compares the password, and throws a `CredentialsSignin` with a `.code`
  (`user_not_found` / `invalid_password` / `account_inactive` / `pending_approval`) — the login
  action maps these to messages, but not-found vs wrong-password both surface the same generic
  "Invalid email or password" to prevent account enumeration. Blocks `SUSPENDED`/`REJECTED`/
  `PENDING_VERIFICATION` owners outright. On success, fire-and-forget `lastLoginAt` update.
- Sign-out is a server action, `signOutHotelOwner()` (`app/lib/auth-hotel-connect-actions.ts`).

### 2.1 Flows (`(auth)/`)
All actions are rate-limited via a shared `checkRateLimit` helper.

| Flow | File | Notes |
|---|---|---|
| Signup | `signup/actions.ts` → `signupAction` | 5/60min per email. Zod-validated (India-only 10-digit phone, password min 8 with a letter+digit). Creates `HotelOwner` with `status: ACTIVE` immediately ("account live now; **listing** goes for review after wizard tab 7/8") and `email_verified: false`. Auto-signs in, redirects to `properties/new`. |
| Login | `login/actions.ts` → `loginAction` | 8/15min per email. Maps `authorize()` error codes to messages. |
| Forgot password | `forgot-password/actions.ts` → `requestPasswordReset` | 5/hour. Always returns `{ sent: true }` (anti-enumeration). Sets a 32-byte hex `password_reset_token`, 30-min expiry. |
| Reset password | `reset-password/actions.ts` → `resetPassword` | Looks up by token, checks expiry, bcrypt cost 12, clears token. |
| Verify email | `verify-email/actions.ts` → `verifyOwnerEmail` / `resendVerificationEmail` | Resend: 3/hour, session-gated. In dev, returns the verify URL directly instead of sending (Resend sandbox limitation). |

**Email verification is a feature gate, not a login gate.** An owner can sign in and fill out the
entire listing wizard while unverified. It only blocks *submission*:
`components/EmailVerifyBanner.tsx` shows an amber banner on the dashboard home while
`email_verified === false`, and the wizard's `SubmitReviewStrip.tsx` disables "Submit for Review"
(`review-actions.ts` returns `ownerEmailVerified` as a separate condition from field completeness).

### 2.2 Route protection
Root `middleware.ts` handles `/hotel-connect/*`:
- `getToken({ cookieName: "dy.hotel-connect.session-token" })`.
- `/login`, `/signup` → redirect to `/hotel-connect` if already authenticated.
- `/forgot-password`, `/reset-password`, `/verify-email` bypass the session check (they're
  token-gated by emailed one-time links, not login state).
- Everything else with no token → redirect to `/hotel-connect/login`.

Defense in depth: `(main)/layout.tsx` re-checks `hotelConnectAuth()` server-side and redirects —
so a middleware bypass still can't render the dashboard shell.

---

## 3. Layout & navigation

`(main)/layout.tsx` (server) re-verifies auth, then renders `BetaFeedbackBar` →
`MobileNavProvider` wrapping `ConnectSidebar` + `DashboardMain` (scroll container) +
`MobileBottomNav`, plus a `sonner` toaster.

**`components/ConnectSidebar.tsx`** is the single source of truth for nav (`navItems`):

| Path | Label |
|---|---|
| `/hotel-connect` (exact) | Dashboard |
| `/hotel-connect/properties` | My Properties |
| `/hotel-connect/calendar` (also matches `/properties/:id/(rates\|calendar)`) | Rates & Inventory |
| `/hotel-connect/bookings` | Bookings |
| `/hotel-connect/revenue` | Revenue |
| `/hotel-connect/reviews` | Reviews |
| `/hotel-connect/inbox` | Group Inbox |

`resolveActiveHref(pathname, items)` is the shared "one active winner" resolver (exact match →
pattern match → longest-prefix match), reused by `MobileBottomNav`, which only surfaces the first
4 items on a bottom tab bar plus a "More" button (Revenue/Reviews/Inbox/sign-out live behind it).
The bottom nav hides itself entirely inside the property wizard
(`HIDES_MOBILE_BOTTOM_NAV = /^\/hotel-connect\/properties\/\d+\/edit(\/|$)/`), which has its own.

**`components/ConnectHeader.tsx`** (server, per-page `title`/`badge` props) renders
`MobileMenuButton`, `NotificationBell` (§8), and `UserMenu` (Account settings link, §9).

**Beta feedback** (`components/BetaFeedbackBar.tsx` + `feedback-actions.ts`): a dismissible bar
("You're using the new Hotel Owner Dashboard…", dismissal persisted in `localStorage`) opens a
modal that writes free-text feedback to `HotelOwnerFeedback` (`owner_id`, `message`, `page_path`).

**Dashboard home** (`(main)/page.tsx`): server-fetches the owner's hotels and computes stat cards
(live/pending counts, this-month bookings/revenue, upcoming check-ins in the next 7 days via
`bookingHotel.count`), an alerts list (draft/rejected properties, upcoming check-ins), the
email-verify banner, an onboarding empty state when the owner has no properties yet, a recent
bookings list, and quick-action cards.

---

## 4. Properties & the listing wizard

### 4.1 List view — `properties/page.tsx`
Owner's hotels (`db.hotels.findMany({ owner_id })`), filterable by `all | live | pending
(SUBMITTED/UNDER_REVIEW) | draft (DRAFT/REJECTED)`, each card badged with `HotelListingStatus` and
linking to **Edit Listing** and **Rates**; a **Live** link to the public `/hotels/[slug]` page
appears once `listing_status === "LIVE"`.

### 4.2 New property — `properties/new/`
`PropertyTypeSelector.tsx` groups subtypes under two `PropertyCategory` buckets:

- **HOTEL**: Hotel, Resort, Lodge, Guest House, Palace, Houseboat, Motel.
- **HOMESTAY_VILLA**: Villa, Homestay, Cottage, Apartment, Apart-Hotel, Hostel, Bed & Breakfast,
  Farmhouse, Camp, Beach Hut, Treehouse, Dharamshala, Ashram, Holiday Home, RV, Luxury Camps.

`actions.ts` → `createDraftProperty(subType)` creates a `hotels` row (`name: "My Property"`,
`slug: draft-<ownerIdTail>-<timestamp>`, `listing_status: DRAFT`, `wizard_step: 1`) and redirects
into the edit wizard.

### 4.3 Edit wizard — `properties/[id]/edit/`
Tab count and order depend on property category (`wizard-tab-config.ts`):

| # | Hotel | Homestay/Villa |
|---|---|---|
| 1 | Basic Info | Basic Info |
| 2 | Location | Location |
| 3 | Amenities | Amenities |
| 4 | Rooms | Rooms & Spaces |
| 5 | Photos | Photos |
| 6 | Policies | **Pricing** |
| 7 | Finance & Legal | Policies |
| 8 | — | Finance & Legal |

`page.tsx` loads the hotel scoped to `owner_id` and computes `effectiveWizardStep()` — actual
completion derived from saved data (no rooms → cap at step 3; no images → cap at step 4;
otherwise `max(wizard_step, 5)`), then redirects if the requested tab is more than one step ahead
of what's actually reachable (no skipping ahead). `WizardShell.tsx` (client) provides the chrome:
back-to-Properties header with status badge, a horizontally-scrollable locked/completed/current
tab bar, a status-specific `ReviewBanner` (submitted timeline / live public URL / rejection
reason), the tab content, `SubmitReviewStrip` (only once `allComplete && isDraft`), and a
Previous/Step-X-of-Y/Save-&-Continue footer.

Per-tab components live in `tabs/` (shared: `LocationTab`, `AmenitiesTab`, `PhotosTab`; hotel-only:
`BasicInfoTab`, `RoomsTab`, `PoliciesTab`, `FinanceTab`; homestay-only: `HomestayBasicInfoTab` +
`HostDetailsSection`, `HomestayRoomsTab`, `MealsPricingTab`, `HomestayPoliciesTab`,
`HomestayFinanceTab`), each backed by its own `*-actions.ts` server action, all scoped by
`owner_id: session.user.id`. Deeper per-unit editors sit outside the tab bar's own URL:
`bedroom/[n]/`, `bathroom/[n]/`, `kitchen/`, `space/[i]/` (homestay room/space detail, hotel room
photo tagging).

**Contact verification** (`tabs/verification-actions.ts`) uses self-contained HMAC-signed OTP
tokens (no DB row) — `target|otp|expiry` signed with `createHmac("sha256", OTP_SECRET)`,
base64url-encoded, 10-minute TTL. In dev, the OTP is always `123456` and no real message is sent.

**Submission** (`review-actions.ts` → `submitForReview`):
- `AUTO_APPROVE = process.env.HOTEL_AUTO_APPROVE === "true"` — **fails closed**: an unset env var
  can never bypass review (a prior fail-open bug was fixed here).
- Validates: real property name, verified contact email/mobile, full address+geopin, star rating
  (waived for Guest House/homestay), at least one priced room / `prop_base_rate` (homestay), ≥6
  photos with ≥2 tagged "Bedroom", check-in/out times, cancellation policy, bank account + IFSC,
  PAN. Missing items are returned as a bullet list; `ownerEmailVerified` is reported separately
  (own amber notice + resend link, not folded into the missing-fields list).
- On success: mints a clean public slug if still on the auto-generated `draft-` one, stamps
  `submitted_at`, sets `listing_status` to `LIVE` (if auto-approved) or `SUBMITTED`, and — for
  homestays — calls `ensureHomestayRoom(hotelId)` to provision the canonical "Entire Property"
  `hotel_rooms` row + pricing (homestays otherwise never get a room row from the wizard itself).
- `HotelListingStatus`: `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED → LIVE`. Everything
  after `SUBMITTED` is staff-side, in `app/(dashboard)/dashboard/(main)/verify-hotels/`.

---

## 5. Rates & Inventory

### 5.1 Calendar — `properties/[id]/calendar/`
`calendar-actions.ts`:
- `fetchRoomCalendar(hotelId, roomId, fromISO, toExclusiveISO, pricingId?)` — per-night
  availability/rate/inventory (ARI) via `getRoomARI()` (`app/lib/hotel-inventory/rates.ts`).
- `saveAvailabilityRange(hotelId, roomId, fromISO, toISO, patch)` — bulk-patches
  `hotel_room_availability` for a date range (`totalUnits`, `priceOverride`, `stopSell`,
  `minLos`/`maxLos`, `minAdvanceDays`/`maxAdvanceDays`, `closedToArrival`/`closedToDeparture`).
  Blocks past dates and refuses to drop `totalUnits` below the max `booked_units` already recorded
  in that range. Ownership is checked via `ownsRoom(hotelId, roomId, ownerId)`
  (`app/lib/hotel-inventory/owns-room.ts`). On success, best-effort triggers
  `enqueueAriPushIfConnected()` for connected channel-manager sync (see
  [`docs/channel-management/`](../channel-management/channel-management-plan.md)).

### 5.2 Rates — `properties/[id]/rates/`
- `page.tsx` lists rooms + their rate plans (`RoomListClient.tsx`); lazily calls
  `ensureHomestayRoom(hotelId)` so homestays can price mid-wizard.
- `default/` (`DefaultRatesClient.tsx`) edits the non-seasonal base rate — `price_per_night`,
  `occupancy_prices`, `extra_bed_rate`, `extra_child_rate` — what a guest is quoted on any date
  with no matching season.
- `[roomId]/plans/` + `plan-actions.ts` — rate-plan CRUD (`listRatePlans`, `createRatePlan`,
  `updateRatePlanDetails`, `setRatePlanActive` — blocks deactivating a room's last active plan)
  plus `setDefaultInventory` (writes `hotel_rooms.num_rooms`).
- `[roomId]/rate-actions.ts` — season-scoped rates: `getRoomRateDetail`/`saveRoomRates` upsert one
  `hotel_room_pricing_season` matched by exact `(pricing_id, valid_from, valid_to)` plus its
  occupancy children. **Not** the same as the staff dashboard's season editor, which deletes and
  recreates every season — this only touches the one range given.

### 5.3 Pricing model chain
```
hotel_rooms
 └─ hotel_room_pricing            (one row per rate plan: price_per_night, extra_bed_rate,
     │                             extra_child_rate, margin_percentage, gst_percentage (18%),
     │                             cancellation_policy, meal/diet type, plan_name, valid range)
     ├─ hotel_room_occupancy_prices
     └─ hotel_room_pricing_season (seasonal override: valid_from/to, price_per_night,
         │                         weekend_price_per_night, extra bed/child rates)
         └─ hotel_room_pricing_season_occupancy   (@@unique([season_id, occupancy]))

hotel_room_availability            (per-date ARI ledger, @@unique([room_id, date]))
  total_units, booked_units, stop_sell, price_override,
  min_los/max_los, min_advance_days/max_advance_days, closed_to_arrival/closed_to_departure
  → available = stop_sell ? 0 : max(0, total_units - booked_units)
```
Base nightly price always resolves from `hotel_room_pricing`/its seasons; `price_override` on
`hotel_room_availability` pins a single date on top of that.

---

## 6. Bookings & how they reach an owner

`bookings/page.tsx` is **read-only** — there is no owner-side confirm/reject action. It resolves
the owner's hotel IDs → distinct `bookingId`s via `bookingHotel`, tabs
`all | upcoming | ongoing | completed | cancelled`, paginated 20/page, with DB-aggregated stats
(`booking.aggregate`, excluding `CANCELLED/REJECTED/PENDING_REVIEW`).

**Routing is implicit, not an assignment step**: a `BookingHotel` row's `hotelId` points at a
`hotels` row, which has an `owner_id` — that join *is* the routing. Confirmation happens entirely
on the staff side:

- `app/(dashboard)/dashboard/(main)/verify-hotels/actions.ts` → `confirmHotelStay(...)` upserts
  `BookingHotel` (`isConfirmed: true`, `status: CONFIRMED`). It computes whether the hotel actually
  changed on this confirm and, only `if (!existingRow?.isConfirmed || hotelActuallyChanged)`, calls
  `notifyOwnerBookingConfirmed(...)` — so owners aren't re-pinged on every later edit to an
  already-confirmed row (price tweak, notes, etc).
- `app/(dashboard)/dashboard/(main)/package-bookings/fulfillment.actions.ts` →
  `setItemFulfillment(...)` does the analogous thing for multi-city package-booking day items:
  reads `wasConfirmed` before the upsert, and on a genuine `confirmed && !wasConfirmed` transition
  for a `kind === "HOTEL"` item, calls the same notifier.

Both funnel into `notifyOwnerBookingConfirmed` (§8).

---

## 7. Revenue, Reviews, Inbox

### 7.1 Revenue — `revenue/page.tsx`
Pure read-only analytics derived from `Booking.totalAmount` — **no separate payout/settlement
table exists**. Stat cards: Total Earned, This Month, Last Month, Confirmed-but-not-yet-earned (₹)
(sum of `UPCOMING`/`CONFIRMED` bookings), a month-over-month % badge, a 6-month bar chart +
breakdown table. A static "Payout Schedule" card ("processed within 7 business days after
check-out") is informational copy only, pointing owners at the Finance & Legal wizard tab.

### 7.2 Reviews — `reviews/page.tsx` + `ReviewCard.tsx` + `reviews-actions.ts`
Real, DB-backed. Owners can **reply publicly** — there's no flag/moderate/delete action.
`getOwnerReviews(page)` returns a rating breakdown (`hotel_review.groupBy`) + a paginated list;
`respondToReview(reviewId, response)` is scoped via `hotel_review.findFirst({ hotel: { owner_id } })`,
max 2000 chars, writes `host_response`/`host_response_at`. One response per review — no edit or
delete once sent.

### 7.3 Group Inbox — `inbox/page.tsx` + `GroupInbox.tsx` + `inbox-actions.ts`
Despite the name, this is **1:1 host↔guest messaging per booking**, not multi-party chat — "Group"
means it aggregates every conversation across all of an owner's properties into one inbox.
`conversation` is keyed `@@unique([booking_id, hotel_id])` (this scoping is what stops one owner's
messages leaking to a co-owner on a multi-hotel package booking); `conversation_message.sender` is
`HOST | GUEST | SYSTEM`. `getOwnerConversations()` builds candidates from the owner's
`bookingHotel` links (capped at 200 most-recent), left-joins existing threads for last-message
preview + unread count, and sorts most-recent-first. `sendHostMessage` upserts the conversation and
appends a `HOST` message (max 4000 chars); opening a thread marks unread guest messages
`read_by_host: true`.

---

## 8. Notifications

`components/NotificationBell.tsx` (header bell with unread badge) + `notifications-actions.ts` +
`app/services/notifications/owner-notify.ts`, backed by `HotelOwnerNotification`
(`@@map("hotel_owner_notifications")`, indexed on `[owner_id, created_at]`).

```prisma
model HotelOwnerNotification {
  id         Int        @id @default(autoincrement())
  owner_id   String
  owner      HotelOwner @relation(fields: [owner_id], references: [id])
  hotel_id   Int?
  hotel      hotels?    @relation(fields: [hotel_id], references: [id])
  type       String     // free text, currently only "BOOKING_CONFIRMED"
  title      String
  body       String
  link       String?
  read_at    DateTime?
  created_at DateTime   @default(now())
}
```

- `notifications-actions.ts`: `listOwnerNotifications()` (last 20), `getUnreadNotificationCount()`,
  `markNotificationRead(id)`, `markAllNotificationsRead()` — all session-gated and scoped to
  `owner_id`.
- `ConnectHeader` fetches `unreadCount` server-side and passes it to `NotificationBell` as
  `initialUnreadCount`; the bell lazily fetches the full list on first click, marks-read on
  item click (then navigates to `n.link`), and supports "mark all read".
- **Producer** — `owner-notify.ts` → `notifyOwnerBookingConfirmed({ hotelId, bookingNumber,
  checkInDate, checkOutDate, roomType, roomsCount })`: looks up the hotel's `owner_id`/email,
  writes the notification row (`type: "BOOKING_CONFIRMED"`, `link: "/hotel-connect/bookings"`)
  inside a try/catch (best-effort, logged not thrown), then separately sends
  `ownerBookingConfirmedEmail` via `sendBookingEmail` (gated by `NOTIFICATIONS_ENABLED`
  internally). **Must never run inside a DB transaction** — callers treat it as a post-commit
  side effect. See §6 for the two staff-dashboard call sites.

---

## 9. Account settings — `account/`

`ProfileSettingsForm.tsx` + `actions.ts`. Name and email are **read-only** in this UI (email shows
a locked "Verified" badge — changing a verified email would need its own re-verification flow,
which doesn't exist yet). Phone is editable, reusing the wizard's account-scoped OTP flow
(`sendMobileOtp`/`verifyMobileOtp` from `properties/[id]/edit/tabs/verification-actions.ts`).

`updateOwnerPhone(cc, phone)` is a deliberately narrow action — it does **not** reuse the wizard's
`saveHostDetails`, because that action writes every host-detail field from its own form and would
silently null out `businessName`/`whatsapp`/etc. on a phone-only submit.

**Bank details are per-property, not per-owner** (`hotels.bank_account_number`,
`hotels.bank_ifsc_code`, `hotels.bank_name`, …). The Account page doesn't duplicate the Finance
form — it lists each property with a masked account number and links to that property's
Finance & Legal wizard tab (`?tab=7` for hotels, `?tab=8` for homestays).

Finance-tab validation (`tabs/finance-actions.ts`, mirrored client-side in `FinanceTab.tsx` /
`HomestayFinanceTab.tsx`): bank account `/^\d{6,20}$/`, IFSC `/^[A-Z]{4}0[A-Z0-9]{6}$/`, GSTIN
`/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/`, PAN `/^[A-Z]{5}[0-9]{4}[A-Z]$/`. A required
"Passbook / Cancelled Cheque" upload (`docKey: "bank_proof"`) uses the generic
`uploadFinanceDocument(hotelId, docType, formData)` action, which sniffs file magic bytes
(PDF/JPEG/PNG only — never trusts `file.type`), stores to R2 under `hotel-docs/`, and merges the
URL into `hotels.property_documents` (JSON, keyed by `docType`).

---

## 10. Data model — hotel-connect-specific

| Model | Table | Role |
|---|---|---|
| `HotelOwner` | `hotel_owners` | Owner account: credentials, `status` (`HotelOwnerStatus`), verification, host-profile fields (`business_description`, `founded_year`, `languages`, `logo_url`…). `hotels[]` back-relation. |
| `HotelOwnerNotification` | `hotel_owner_notifications` | In-app + email notification log (§8). |
| `HotelOwnerFeedback` | `hotel_owner_feedback` | Beta feedback bar submissions (§3). |
| `hotels` | `hotels` | The listing itself — `owner_id`, `wizard_step`, `listing_status`, `rejection_reason`, `submitted_at`, `property_category`/`property_sub_type`, plus the full basic-info/location/policy/finance field set. Shared with the public site and staff dashboard. |
| `hotel_rooms`, `hotel_room_pricing`(+seasons/occupancy), `hotel_room_availability` | — | Rooms + pricing + per-date ARI (§5.3). |
| `hotel_review` | — | Guest reviews + `host_response` (§7.2). |
| `conversation`, `conversation_message` | — | Host↔guest messaging (§7.3). |
| `BookingHotel` | `booking_hotels` | Per-leg hotel booking + `FulfillmentStatus`; the join point that routes a booking to an owner (§6). |
| `PackageBookingHotel` | `package_booking_hotel` | Simpler per-leg record for multi-city package bookings. |

```prisma
enum HotelOwnerStatus   { PENDING_VERIFICATION ACTIVE SUSPENDED REJECTED }
enum HotelListingStatus { DRAFT SUBMITTED UNDER_REVIEW APPROVED REJECTED LIVE }
enum PropertyCategory   { HOTEL HOMESTAY_VILLA }
enum PropertySubType    { HOTEL RESORT GUEST_HOUSE HOUSEBOAT VILLA HOMESTAY APARTMENT LODGE
                           PALACE MOTEL COTTAGE APART_HOTEL HOSTEL BED_AND_BREAKFAST FARMHOUSE
                           CAMP BEACH_HUT TREEHOUSE DHARAMSHALA ASHRAM HOLIDAY_HOME RV LUXURY_CAMPS }
enum FulfillmentStatus  { PENDING IN_PROCESS CONFIRMED UNAVAILABLE REPLACED CANCELLED }
enum ConversationSender { HOST GUEST SYSTEM }
```

`Booking`/`BookingStatus` itself belongs to the public-site/booking domain (see
[`docs/booking/booking-system.md`](../booking/booking-system.md)) but is read extensively here for
the owner's Bookings/Revenue stats.

---

## 11. Relationship to the staff dashboard

Hotel-Connect and the internal staff dashboard (`app/(dashboard)`) share the `hotels` and booking
tables but have **no shared auth** — three independent NextAuth instances, three session cookies.
The staff side is where an owner's submitted listing gets approved/rejected
(`verify-hotels/actions.ts`) and where a booking's hotel leg gets confirmed
(`confirmHotelStay`, `fulfillment.actions.ts` → `setItemFulfillment`) — both of which are the
trigger points for owner-facing notifications (§8). Channel-manager sync
(`enqueueAriPushIfConnected`, §5.1) is documented separately in
[`docs/channel-management/`](../channel-management/channel-management-plan.md).

---

## 12. Notes for future contributors

- **Email verification gates submission, not login or wizard editing.** Don't add a login-time
  block on `email_verified` — an owner needs to be able to sign in and build a draft listing
  before verifying.
- **`AUTO_APPROVE` must fail closed.** `HOTEL_AUTO_APPROVE` has to be the literal string `"true"`
  to skip review; an unset/misconfigured env var must never silently auto-publish a listing.
- **Owner-booking notifications must only fire on a genuine not-confirmed→confirmed transition**
  (or a hotel swap), not on every edit to an already-confirmed `BookingHotel`/package-item row —
  both call sites check the prior state before calling `notifyOwnerBookingConfirmed`.
- **`notifyOwnerBookingConfirmed` is a post-commit side effect** — never call it inside the same
  DB transaction as the confirmation write; it's already wrapped in its own try/catch and must
  stay best-effort (a notification failure should never fail a booking confirmation).
- **Bank details live on `hotels`, per property — not on `HotelOwner`.** An owner with multiple
  properties has multiple bank records; don't add an owner-level bank field.
- **The season-rate editors on the owner side and staff side are intentionally different**: the
  owner's `saveRoomRates` upserts only the one date range given; the staff dashboard's equivalent
  deletes and recreates all seasons. Don't unify them without checking both call sites.
- **Icon-bearing nav data vs. RSC-safe data**: `ConnectSidebar.tsx`/`MobileBottomNav.tsx` import
  icon libraries; if a server component ever needs the plain href list, mirror the
  `nav-items.ts`/`nav-hrefs.ts` split documented in
  [`PROJECT_OVERVIEW.md §4.2`](../PROJECT_OVERVIEW.md#42-librbacnav-hrefsts) rather than importing
  the icon-bearing file into an RSC.
