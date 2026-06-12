# Dreams Yatri — API & Server Actions Reference

This is the detailed companion to [`docs/PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md). It
documents every HTTP route handler under `app/api/**` and every Server Action /
service function under `app/actions/**` — i.e. the full "API surface" of the app,
whether called over HTTP (route handlers, webhooks, cron) or invoked directly from
React components as Server Actions.

**How to read this doc**
- **Part 1 — Route Handlers** (`app/api/**/route.ts`): real HTTP endpoints — auth
  pages, webhooks, cron jobs, geo/location lookups, hotels, search, uploads, and
  the authenticated `/api/user/*` profile API.
- **Part 2 — Server Actions** (`app/actions/**`): the mutation/query layer used
  directly by Server Components and forms (marked `"use server"`), plus the
  service modules they delegate to (plain modules, often `import "server-only"`).

**Cross-cutting notes**
- Two completely separate NextAuth instances/cookies exist: the public site
  (`app/lib/auth.ts`, JWT, 6-month session) and the staff dashboard
  (`app/lib/auth-dashboard.ts`, cookie `dy.dashboard.session-token` scoped to
  `/dashboard`, 8-hour session). See [`PROJECT_OVERVIEW.md` §3](./PROJECT_OVERVIEW.md#3-authentication--two-independent-systems).
- Several routes (`/api/locations/create`, `/api/locations/save-external`,
  `/api/upload`, `/api/testing/test-package`, `/api/preview/email/receipt`) have
  **no auth guard** despite being administrative/internal in nature — flagged
  below for a future security pass.
- All `/api/user/*`, `/api/payments/*` (via the service layer), and `/api/search`
  responses follow a shared `ApiResponse` envelope: success →
  `{ success: true, data, meta? }`, errors → `{ success: false, error, code }`
  with Prisma error mapping (`P2002`→409 conflict, `P2025`→404, `P2003`→400). Most
  other groups (`geo`, `hotels`, `locations`, legacy `auth`) return ad-hoc JSON shapes.
- The Postgres-backed `/api/locations/search` falls back automatically if
  Meilisearch is misconfigured/down, so location search keeps working either way.
- **Money is always integer paise** anywhere a payment gateway is involved
  (`app/lib/money.ts`) — never float arithmetic on amounts. See
  [`docs/booking/booking-system.md`](./booking/booking-system.md) for the full
  booking/payment flow that many of these actions implement.

---

# Part 1 — Route Handlers (`app/api/**`)

### Public Auth (`/api/auth/*`)

#### GET/POST `/api/auth/[...nextauth]`
- **Auth**: Public (this *is* the auth endpoint) — NextAuth.js catch-all handler for the public site session.
- **Purpose**: Handles sign-in/sign-out/session/callback routes for the public-site NextAuth instance (`app/lib/auth.ts`). Providers: Google OAuth and a `Credentials` provider supporting MSG91 OTP widget login, magic-link session token login, and phone+OTP login.
- **Request**: Standard NextAuth routes (`/signin`, `/callback/:provider`, `/session`, `/csrf`, etc.). For Credentials provider: `{ phone, code, magicSessionToken, msg91Token }` (varies by login method).
- **Response**: Standard NextAuth JSON/redirect responses; session JWT cookie set on success.
- **Side effects**: On successful Credentials authorize, upserts `User` by `phone`; blocks `BANNED`/`DELETED` users; for magic-link login consumes/deletes the `MagicSession` row (one-time use). Session strategy is JWT, 6-month maxAge.

#### GET `/api/auth/magic-link/verify`
- **Auth**: Public — token-based (query string `token` + `email`).
- **Purpose**: Verifies a magic-link sign-in token sent via email, then redirects the browser to a client-side magic-callback page that completes the NextAuth Credentials sign-in.
- **Request**: Query params `token` (string), `email` (string).
- **Response**: Always a redirect (no JSON):
  - Missing token/email, token not found, email mismatch → `302` redirect to `/?auth_error=invalid_link`
  - Expired token → `/?auth_error=link_expired`
  - Success → `/auth/magic-callback?token=<magicToken>&email=<email>`
  - Unhandled exception → `/?auth_error=server_error`
- **Side effects**: Deletes the consumed `VerificationToken`; upserts `User` (sets `emailVerified`); creates a short-lived (5 min) `MagicSession` row used by the Credentials provider.

#### POST `/api/auth/send-otp`
- **Auth**: Public.
- **Purpose**: Sends a login OTP via SMS (phone) or a magic-link email (email) — exactly one of `phone`/`email` must be provided.
- **Request** (JSON body): `{ phone?: string, email?: string }`. Phone validated against `/^\+?[1-9]\d{9,14}$/`; email validated against a simple regex. Exactly one of the two is required.
- **Response**:
  - `400` — neither/both provided, or invalid phone/email format
  - `429` — rate-limited (`OTP_COOLDOWN_MS` = 1s; "OTP already sent / Magic link already sent. Wait N seconds.")
  - `502` — SMS/email send failure (`{ error: "Failed to send OTP..." }` / `{ error: "Failed to send magic link..." }`)
  - `200` — `{ success: true, channel: "phone" | "email" }`
  - `500` — `{ error: "Internal server error.", detail }`
- **Side effects**: For phone — creates an `Otp` row (10 min expiry) and sends SMS via `sendOtpSms`; rolls back on send failure. For email — deletes existing `VerificationToken`s for that identifier, creates a new one, and sends a magic-link email via `sendEmail`.

#### GET `/api/auth/send-otp`
- **Auth**: Public (appears to be leftover debug code).
- **Purpose**: Returns a hardcoded lookup of a user with email `"your@email.com"` — likely a debug/dev artifact.
- **Request**: None.
- **Response**: `200` — `{ id, name, email } | null` (raw `db.user.findFirst` result).
- **Side effects**: None (read-only).

#### POST `/api/auth/verify-otp`
- **Auth**: Public.
- **Purpose**: Verifies a phone OTP code, marks it used, and upserts/returns the `User` record for that phone (used to complete phone-based login).
- **Request** (JSON body): `{ phone: string, code: string }` — phone must be exactly 10 digits, code exactly 6 digits/numeric.
- **Response**:
  - `400` — missing fields, wrong phone/OTP length, non-numeric code, or no active OTP found
  - `429` — too many attempts (≥3), OTP row deleted (`"Too many failed attempts. Please login again."`)
  - `401` — incorrect OTP, `{ error: "Invalid OTP", remainingAttempts }`
  - `200` — `{ success: true, user: { id, phone, isProfileComplete } }`
- **Side effects**: Increments `Otp.attempts` on wrong code; deletes `Otp` row after 3rd failed attempt or on success (`usedAt` set); upserts `User` by `phone` (creates if not exists).

---

### Dashboard Auth (`/api/dashboard-auth/*`)

#### GET/POST `/api/dashboard-auth/[...nextauth]`
- **Auth**: Public endpoint (this *is* the dashboard auth endpoint) — NextAuth.js catch-all for the internal staff dashboard session (`app/lib/auth-dashboard.ts`).
- **Purpose**: Handles sign-in/sign-out/session/callback for staff/team-member logins via email+password (`TeamMember` table), completely separate from the public site session.
- **Request**: Standard NextAuth routes; Credentials provider expects `{ email, password }` (validated via zod, password min length 6).
- **Response**: Standard NextAuth JSON/redirect responses. On invalid login: throws `CredentialsSignin` with `code` of `"user_not_found"` or `"account_inactive"`, surfaced via the `/dashboard/login` error page.
- **Side effects**: Looks up `TeamMember` by email, checks `isActive`, compares password via `bcryptjs`. Uses a dedicated cookie `dy.dashboard.session-token` scoped to path `/dashboard`, JWT session with 8-hour maxAge — isolated from the public-site session cookie.

---

### User Profile & Contact (`/api/user/*`)

All routes below require a public-site session via `getAuthenticatedUser()` (wraps `auth()` and checks `User.status === "ACTIVE"`); unauthenticated requests get `401 { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }`. All use the shared `ApiResponse`/`handleApiError` envelope: success → `{ success: true, data, meta? }`; errors → `{ success: false, error, code }` with Prisma error mapping (`P2002`→409 conflict, `P2025`→404, `P2003`→400).

#### POST `/api/user/avatar`
- **Auth**: Required (public-site session).
- **Purpose**: Uploads a new profile avatar image to R2 storage and updates the user's `image` field.
- **Request**: `multipart/form-data` with field `image` (File). Allowed types: JPEG/PNG/WebP; max size 5 MB.
- **Response**:
  - `401` Unauthorized
  - `400` — no image / invalid type / over size limit
  - `200` — `{ success: true, data: { url } }`
- **Side effects**: Uploads file to Cloudflare R2 (`avatars` folder) via `uploadToR2`; updates `User.image`.

#### POST `/api/user/contact/email`
- **Auth**: Required.
- **Purpose**: Initiates an email-address change by sending a verification link to the new email address.
- **Request** (JSON body): `{ email: string }` (zod `z.email()`).
- **Response**:
  - `401` Unauthorized; `400` invalid email
  - `400` — `"This is already your current email address."` if unchanged
  - `409` — `"This email is already associated with another account."`
  - `502` — `EMAIL_FAILED` if send fails
  - `200` — `{ success: true, data: { message: "Verification email sent. Please check your inbox." } }`
- **Side effects**: Deletes prior pending email verifications for this user; creates a `PendingContactVerification` (type `"email"`, 10-min expiry, random token) and emails a verify link via `sendEmail`.

#### GET `/api/user/contact/email/verify`
- **Auth**: Public/token-based (no session check — token in query string acts as the credential).
- **Purpose**: Confirms a pending email-change request and updates the user's email.
- **Request**: Query param `token` (string).
- **Response**: Always a redirect (no JSON), to `/profile?...`:
  - Missing token / not found / wrong type → `contact_error=invalid_link`
  - Expired → `contact_error=link_expired` (and deletes the pending row)
  - Email taken by another user (race check) → `contact_error=email_taken`
  - Success → `contact_success=email_updated`
  - Exception → `contact_error=server_error`
- **Side effects**: Updates `User.email` + sets `emailVerified`; deletes the `PendingContactVerification` row.

#### POST `/api/user/contact/whatsapp`
- **Auth**: Required.
- **Purpose**: Initiates a WhatsApp number change by sending an OTP to the new number via WhatsApp.
- **Request** (JSON body): `{ phone: string }` (regex `/^\+?[1-9]\d{9,14}$/`).
- **Response**:
  - `401` Unauthorized; `400` invalid phone or unchanged number
  - `409` — number already linked to another account
  - `502` — `WHATSAPP_FAILED` if OTP send fails
  - `200` — `{ success: true, data: { token, message: "OTP sent to WhatsApp." } }`
- **Side effects**: Deletes prior pending whatsapp verifications and stale unused OTPs for the number; creates an `Otp` row (10-min expiry) and a `PendingContactVerification` (type `"whatsapp"`); sends OTP via `sendWhatsappOtp`; rolls back rows on send failure.

#### POST `/api/user/contact/whatsapp/verify`
- **Auth**: Required.
- **Purpose**: Verifies the OTP sent to the new WhatsApp number and commits the change to the user's profile.
- **Request** (JSON body): `{ token: string, otp: string }` (otp must be 6 numeric digits).
- **Response**:
  - `401` Unauthorized; `400` invalid input
  - `400` `INVALID_TOKEN` — token not found / wrong user / wrong type
  - `410` `SESSION_EXPIRED` — pending verification expired (row deleted)
  - `410` `OTP_EXPIRED` — no active OTP
  - `429` `TOO_MANY_ATTEMPTS` — ≥3 wrong attempts (marks OTP used, deletes pending row)
  - `400` — incorrect OTP, includes remaining-attempts message
  - `409` — number now taken by another account (race check)
  - `200` — `{ success: true, data: { message: "WhatsApp number verified and saved." } }`
- **Side effects**: Increments `Otp.attempts` on wrong code; on success marks `Otp.usedAt`, updates `User.whatsapp`, deletes the `PendingContactVerification` row.

#### GET `/api/user/payment-history`
- **Auth**: Required.
- **Purpose**: Returns the current user's payment history with pagination, filterable by customer-facing status bucket, plus lifetime totals.
- **Request** (query params via zod `querySchema`): `status?: "SUCCESS" | "FAILED" | "REFUNDED"`, `page` (default 1), `limit` (default 10, max 100).
- **Response**: `200` — `{ success: true, data: Payment[], meta: { stats: { totalPaid, totalSuccessful }, pagination: { total, page, limit, totalPages } } }`. Each payment includes `id, amount, currency, status, gateway, method, gatewayOrderId, gatewayPaymentId, refundAmount, refundedAt, failureReason, paidAt, createdAt`, and nested `booking { id, bookingNumber, startDate, status, cancelReason, destination: { name }, package: { title } }`.
  - `400` — invalid query params; `401` Unauthorized
- **Side effects**: Read-only. Status mapping: `SUCCESS`→`FULLY_PAID`/`ADVANCE_PAID`, `REFUNDED`→`REFUNDED`/`PARTIALLY_REFUNDED`, default view excludes `TESTING` status payments.

#### GET `/api/user/preferences`
- **Auth**: Required.
- **Purpose**: Fetches the current user's saved travel preferences.
- **Request**: None.
- **Response**: `200` — `{ success: true, data: TravelPreference | null }`. `401` Unauthorized.
- **Side effects**: Read-only.

#### PATCH `/api/user/preferences`
- **Auth**: Required.
- **Purpose**: Updates (or creates) the user's travel preferences.
- **Request** (JSON body, all optional, zod-validated against Prisma enums): `{ tripTypes?: TripType[], groupType?: GroupType, budget?: BudgetTier, duration?: TripDuration, months?: TravelMonth[] }`.
- **Response**:
  - `401` Unauthorized; `400` validation error or empty body (`"No fields provided to update."`)
  - `200` — `{ success: true, data: TravelPreference }`
- **Side effects**: `db.travelPreference.upsert` keyed by `userId`.

#### GET `/api/user/profile`
- **Auth**: Required.
- **Purpose**: Returns the full profile of the current user plus their completed-trip count.
- **Request**: None.
- **Response**: `200` — `{ success: true, data: { ...userFields, totalTrips } }` where userFields include `id, phone, whatsapp, country_code, name, email, gender, dateOfBirth, nationality, maritalStatus, anniversary, state, city, passportNumber, passportExpiryDate, passportIssuingCountry, panNumber, isProfileComplete, createdAt, updatedAt`. `404` if user record missing; `401` Unauthorized.
- **Side effects**: Read-only (`db.booking.count` for `status: "COMPLETED"`).

#### PATCH `/api/user/profile`
- **Auth**: Required.
- **Purpose**: Updates editable profile fields (email changes are excluded — handled via the contact/email verification flow).
- **Request** (JSON body, all optional, zod `patchProfileSchema`): `name` (1-100), `gender` (enum `Gender`), `dateOfBirth` (date string), `nationality` (1-100), `state` (1-100), `city` (1-100), `maritalStatus` (enum `MaritalStatus`), `anniversary` (date string), `passportNumber` (5-20), `passportExpiryDate` (date string), `passportIssuingCountry` (1-100), `panNumber` (regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`), `country_code` (1-6).
- **Response**:
  - `401` Unauthorized; `400` validation error, empty body, or `anniversary` set while `maritalStatus !== MARRIED`
  - `409` — duplicate `passportNumber` or `panNumber` registered to another user
  - `200` — `{ success: true, data: updatedUser }` (selected field set incl. `isProfileComplete`)
- **Side effects**: `name` is title-cased, `panNumber` upper-cased; auto-recomputes `isProfileComplete` based on required fields (`name, email, gender, dateOfBirth, nationality, state, city`); two sequential `db.user.update` calls.

#### DELETE `/api/user/profile`
- **Auth**: Required.
- **Purpose**: Soft-deletes the current user's account after a typed-confirmation check.
- **Request** (JSON body, zod `deleteProfileSchema`): `{ confirmation_title: string }` — must equal the user's `name` in uppercase.
- **Response**:
  - `401` Unauthorized; `400` validation error, or user has no `name` set
  - `404` — user not found
  - `403` `FORBIDDEN` — confirmation text mismatch
  - `200` — `{ success: true, data: { message: "Account deleted successfully." } }`
- **Side effects**: Sets `User.status = "DELETED"` (soft delete, no row removal).

#### GET `/api/user/travel-history`
- **Auth**: Required.
- **Purpose**: Returns the user's bookings ("trips") with pagination, filterable by simplified status (upcoming/completed/cancelled).
- **Request** (query params, zod `querySchema`): `status?: "UPCOMING" | "COMPLETED" | "CANCELLED"`, `page` (default 1), `limit` (default 10, max 100).
- **Response**: `200` — `{ success: true, data: Booking[], meta: { pagination: { total, page, limit, totalPages } } }`. Each booking includes `id, bookingNumber, tripType, startDate, endDate, duration, travellers, status, rawStatus, totalAmount, paidAmount, currency, cancelledAt, cancelReason, createdAt`, nested `destination { id, name, thumbnail, country }`, `package { title, thumbnail }`, and latest `payments[0]`.
  - `400` invalid query params; `401` Unauthorized
- **Side effects**: Read-only; `status` is mapped from raw `BookingStatus` to `UPCOMING`/`COMPLETED`/`CANCELLED` via `travelHistoryStatus`, with the raw value preserved as `rawStatus`.

---

### Geo & Locations (`/api/geo/*`, `/api/locations/*`)

#### GET `/api/geo/countries`
- **Auth**: Public.
- **Purpose**: Autocomplete list of active countries from the `Location` table.
- **Request**: Query param `q?` (search text, optional).
- **Response**: `200` — `[{ id: number, name: string }]` (max 100, sorted by name).
- **Side effects**: Read-only.

#### GET `/api/geo/states`
- **Auth**: Public.
- **Purpose**: Autocomplete list of active states/regions belonging to a given country.
- **Request**: Query params `countryId` (required — returns `[]` if missing), `q?` (search text).
- **Response**: `200` — `[{ id: number, name: string }]` (max 200, sorted by name).
- **Side effects**: Read-only.

#### GET `/api/geo/cities`
- **Auth**: Public.
- **Purpose**: Autocomplete list of active cities belonging to a given state.
- **Request**: Query params `stateId` (required — returns `[]` if missing), `q?` (search text).
- **Response**: `200` — `[{ id: number, name: string }]` (max 200, sorted by name).
- **Side effects**: Read-only.

#### POST `/api/locations/create`
- **Auth**: Public (no session check — likely intended for internal/admin use but unguarded).
- **Purpose**: Manually creates a new `Location` record (e.g. a destination/area not found via the external geocoder).
- **Request** (JSON body, zod schema): `{ name: string (min 1), type: string (min 1), country?: string, state?: string, city?: string, latitude?: string, longitude?: string, description?: string, slug: string (lowercase + hyphens, regex), is_featured?: boolean (default false) }`.
- **Response**:
  - `400` — validation failure, `{ error: "Validation failed", details: fieldErrors }`
  - `409` — slug already taken
  - `201` — `{ id, name, slug, type, breadcrumb, latitude, longitude }`
  - `500` on error
- **Side effects**: Resolves `country`/`state` names to existing `Location` IDs (for `parent_id`/`country_id`/`state_id`); creates a new `Location` row with `is_active: true, is_searchable: true, is_popular: false, metadata: { source: "manual" }`.

#### GET `/api/locations/external`
- **Auth**: Public.
- **Purpose**: Proxies a forward-geocoding/autocomplete search to the Mapbox Places API, mapping Mapbox place types to internal `LocationType` values.
- **Request**: Query params `q` (required, min length 2 — returns `{ results: [] }` if shorter), `types?` (comma-separated internal `LocationType`s used to filter/restrict the Mapbox query).
- **Response**:
  - `503` — `{ results: [], configured: false }` if `NEXT_PUBLIC_MAPBOX_TOKEN` not set
  - `200` — `{ results: [{ source: "external", mapbox_id, name, full_name, place_type, coordinates: [lng, lat], country?, region?, place? }], configured: true }`
  - On fetch error/non-OK — `{ results: [] }`
- **Side effects**: External call to Mapbox Geocoding API (`mapbox.places`), cached via `next: { revalidate: 60 }`.

#### GET `/api/locations/reverse-geocode`
- **Auth**: Public.
- **Purpose**: Reverse-geocodes a lat/lng pair to a place name and admin hierarchy via Mapbox.
- **Request**: Query params `lat`, `lng` (both required).
- **Response**:
  - `400` — missing lat/lng
  - `503` — Mapbox token not configured
  - `502` — Mapbox request failed
  - `200` — `{ name, full_name, country, region, place, coordinates: [lng, lat] }`, or `{}` if no feature found
  - `500` on exception
- **Side effects**: External call to Mapbox Geocoding API (types restricted to `country,region,place,district,locality`).

#### POST `/api/locations/save-external`
- **Auth**: Public.
- **Purpose**: Persists a location chosen from the external Mapbox search into the local `Location` table, deduping by `mapbox_id` or proximity+name match, and generating a unique slug.
- **Request** (JSON body, zod schema): `{ mapbox_id: string, name: string (min 1), full_name: string, place_type: string, coordinates: [number, number] (lng, lat), country?: string, region?: string, place?: string }`.
- **Response**:
  - `400` — invalid payload
  - `200` — `{ id, name, slug, type, breadcrumb, latitude, longitude, existed: boolean }` (`existed: true` if matched an existing row by `mapbox_id` or proximity/name; `false` if newly created)
  - `500` on error
- **Side effects**: May create a new `Location` row (`is_active: true, is_searchable: true, is_popular: false, metadata: { source: "mapbox", full_name, mapbox_id }`), resolving `country`/`region` to existing IDs and generating a unique slug (appends `-2`, `-3`, etc. on collision); dedupes on exact `mapbox_id` match or proximity (±0.01°, ~1km) + case-insensitive name match.

#### GET `/api/locations/search`
- **Auth**: Public.
- **Purpose**: General-purpose location autocomplete used across the site (and admin forms), backed by Meilisearch with a Postgres fallback; supports destination-scoped filtering for the cab-pricing admin form.
- **Request**: Query params: `q?` (min length 2 unless `types` provided), `types?` (comma-separated `LocationType`), `limit?` (default 8, max 500), `destinationsOnly?` (`"true"`), `excludePricedCabs?` (`"true"`).
- **Response**: `200` — `[{ source: "local", id: string, name, type, slug, breadcrumb, latitude: number|null, longitude: number|null }]`. Returns `[]` if `q` too short and no `types`. `500` with `[]` body on error.
- **Side effects**: Read-only. Tries Meilisearch `locations` index first (typo-tolerant) when `q.length >= 2` and not destination-scoped, falling back to Postgres `ILIKE` search on `name`/`official_name` on Meili error or when destination-scoping params require DB-side ID filtering (joins `destinations`/`cabPricings` tables to compute include/exclude location ID sets).

---

### Hotels & Search (`/api/hotels*`, `/api/search`)

#### GET `/api/hotels`
- **Auth**: Public.
- **Purpose**: Paginated, filterable list of active hotels for the public hotel listing page, including each hotel's cheapest active room price.
- **Request**: Query params: `page` (default 1), `limit` (default 12, max 50), `destination_id?`, `region_id?`, `category?`, `stay_type?`, `min_price?`, `max_price?`, `sort?` (`"newest"` default, `"price_asc"`, `"price_desc"`), `search?` (matches hotel `name`, case-insensitive).
- **Response**: `200` — `{ data: Hotel[], meta: { total, page, limit, totalPages, hasNextPage, hasPrevPage } }`. Each hotel includes `id, name, slug, thumbnail, category, stay_type, address, check_in_time, check_out_time`, nested `destination { id, name, slug, region: { id, name } }`, `room_pricing` (cheapest active room only, with `price_per_night`/`original_price` as numbers), and `_count.room_pricing`.
  - `500` — `{ error: "Failed to fetch hotels" }`
- **Side effects**: Read-only. Price filter (`min_price`/`max_price`) requires hotel to have ≥1 active room in range; price sorting (`price_asc`/`price_desc`) is done client-side post-query since Prisma can't `orderBy` relation aggregates.

#### GET `/api/hotels/[slug]`
- **Auth**: Public.
- **Purpose**: Returns full details for a single active hotel by slug, including all active room pricing plans (with occupancy-based pricing) and categorized image galleries.
- **Request**: Path param `slug`.
- **Response**:
  - `404` — `{ error: "Hotel not found" }`
  - `200` — `{ data: Hotel }` where `Hotel` includes `id, name, slug, thumbnail, description, meta_title, meta_desc, address, category, stay_type, check_in_time, check_out_time`, nested `destination { id, name, slug, region }`, `room_pricing[]` (with `room`, `meal_type`, `diet_type`, `occupancy_prices[]`, all Decimal fields converted to `Number`), and `image_categories[]` (with nested `images[]`)
  - `500` — `{ error: "Failed to fetch hotel" }`
- **Side effects**: Read-only.

#### GET `/api/search`
- **Auth**: Public.
- **Purpose**: Global site search across packages, hotels, and blog posts (e.g. for a header search bar).
- **Request**: Query param `q` (min length 2; returns empty result sets otherwise).
- **Response**: `200` (via `ApiResponse.ok`) — `{ success: true, data: { packages: Package[], hotels: Hotel[], blogs: BlogPost[] } }`, each capped at 4 results. `packages`: `{ id, title, slug, thumbnail, destination: { name } }`. `hotels`: `{ id, name, slug, thumbnail, city, state, category }`. `blogs`: `{ id, title, slug, cover_image, excerpt, read_time }` (status `PUBLISHED` only).
  - On error → `handleApiError` (typically `500` server error envelope)
- **Side effects**: Read-only; three queries run in parallel via `Promise.all`.

---

### Payments & Webhooks (`/api/payments/*`, `/api/webhooks/*`)

#### POST `/api/payments/payu/callback`
- **Auth**: Public — PayU posts here as the browser-redirect `surl`/`furl` target (form-urlencoded, raw body read for signature verification inside `processGatewayWebhook`).
- **Purpose**: Handles PayU's browser-side success/failure redirect after checkout, finalizes the payment via the shared gateway-webhook processor, then redirects the user to the booking confirmation page.
- **Request**: Raw form-urlencoded body (PayU payment result fields); query param `b` = `bookingId` (used only for the redirect target).
- **Response**: Always `303` redirect — to `/bookings/{bookingId}` if `b` provided, else `/packages`. No JSON body. Errors in processing are caught and logged, not surfaced to the user.
- **Side effects**: Calls `processGatewayWebhook("PAYU", rawBody, headers)` — verifies signature, dedupes via `WebhookEvent(gateway, eventId)`, and on a "captured" event runs `finalizeCapturedPayment` (idempotent; same logic as the dedicated PayU webhook below, so duplicate processing from both endpoints is safe).

#### POST `/api/webhooks/payu`
- **Auth**: Webhook signature — verified inside `processGatewayWebhook` via PayU's provider-specific HMAC check (no app-level secret header).
- **Purpose**: Server-to-server PayU payment notification — the authoritative source of truth for payment status.
- **Request**: Raw form-urlencoded body (`req.text()`, must not be pre-parsed) — PayU notification payload.
- **Response**: `{ result: "invalid_signature" | "duplicate" | "ignored" | "processed" | "error" }` with `httpStatus` set accordingly: `400` invalid signature, `200` handled/ignored/duplicate, `500` processing error (triggers gateway retry).
- **Side effects**: Verifies signature → dedupes via `WebhookEvent(gateway="PAYU", eventId)` (idempotent — `PROCESSED` events are no-ops) → on "captured" calls `finalizeCapturedPayment`; on "failed" marks `Payment` as `FAILED`; on "refunded" marks `REFUNDED`/`PARTIALLY_REFUNDED` (+ mirrors to `Booking`); triggers `notifyBookingConfirmed`/`notifyRefund` notifications as appropriate.

#### POST `/api/webhooks/razorpay`
- **Auth**: Webhook signature — verified via Razorpay HMAC inside `processGatewayWebhook` (raw body required, not JSON-parsed beforehand).
- **Purpose**: Server-to-server Razorpay payment notification — authoritative source of payment status for Razorpay-initiated payments.
- **Request**: Raw JSON body (`req.text()`) — Razorpay webhook event payload.
- **Response**: Identical shape/semantics to the PayU webhook: `{ result: "invalid_signature" | "duplicate" | "ignored" | "processed" | "error" }`, `httpStatus` 400/200/500.
- **Side effects**: Same shared pipeline as `/api/webhooks/payu` — signature verification, `WebhookEvent` dedup/idempotency, `finalizeCapturedPayment` / payment status updates / refund mirroring / booking notifications.

---

### Cron Jobs (`/api/cron/*`)

#### GET `/api/cron/balance-reminders`
- **Auth**: Cron secret — `isAuthorizedCron(req)` requires `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`; returns `401 { error: "unauthorized" }` if missing/mismatched (and denies by default if `CRON_SECRET` env var is unset).
- **Purpose**: Scheduled job that sends reminder notifications for upcoming balance payments on bookings.
- **Request**: None (GET, no params).
- **Response**: `200` — `{ ok: true, ...summary }` where `summary` is the return value of `runBalanceReminders()` (counts/details of reminders sent).
- **Side effects**: `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Sends reminder emails/notifications and records reminder-sent state to avoid duplicates (logic inside `app/actions/payment/reminders.service.ts`).

#### GET `/api/cron/reconcile-payments`
- **Auth**: Cron secret — same `isAuthorizedCron` check as above; `401 { error: "unauthorized" }` on failure.
- **Purpose**: Scheduled reconciliation job that re-checks pending payments and refunds against the payment gateway to catch missed webhook updates.
- **Request**: None.
- **Response**: `200` — `{ ok: true, payments, refunds }` — results of `reconcilePendingPayments()` and `reconcileRefunds()` respectively.
- **Side effects**: `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Queries the gateway for pending payment/refund statuses and updates `Payment`/`Booking` records accordingly (idempotent reconciliation, per `app/actions/payment/reconcile.service.ts`).

---

### Uploads (`/api/upload`)

#### POST `/api/upload`
- **Auth**: Public (no session check — appears intended for internal/admin use but currently unguarded).
- **Purpose**: General-purpose file upload to Cloudflare R2 for various content folders (admin/CMS image uploads).
- **Request**: `multipart/form-data` with fields `file` (File) and `folder` (string, one of `regions, destinations, hotels, packages, activities, vehicles, attractions, cab-drivers, blogs`). Allowed types: `image/jpeg, image/jpg, image/png, image/webp, image/avif`; max size 20 MB.
- **Response**:
  - `400` — missing file/folder, invalid folder, disallowed type, or over size limit
  - `200` — `{ key, url }` (result of `uploadToR2`)
  - `500` — `{ error: "Upload failed" }`
- **Side effects**: Uploads file buffer to R2 under the specified folder.

---

### Dev / Preview / Testing (`/api/dev/*`, `/api/preview/*`, `/api/testing/*`)

#### GET `/api/dev/email-preview`
- **Auth**: Public, but blocked entirely in production (`NODE_ENV === "production"` → `403`).
- **Purpose**: Developer tool to preview transactional email HTML templates (OTP email, magic-link email) in the browser, plus an index page listing available templates.
- **Request**: Query param `template?` (`"otp"` | `"magic-link"` | omitted for index page).
- **Response**:
  - `403` in production — `{ error: "Not available in production." }`
  - `200` — raw HTML (`Content-Type: text/html`): rendered `otpEmailTemplate(847291)`, `magicLinkEmailTemplate(<sample url>)`, or an index page with links to each template
- **Side effects**: None (renders templates with hardcoded sample data, no DB/email calls).

#### GET `/api/preview/email/receipt`
- **Auth**: Public — no environment guard (unlike `/api/dev/email-preview`).
- **Purpose**: Renders a sample package-payment receipt email (HTML) using hardcoded mock booking/payment data, for design/QA review.
- **Request**: None.
- **Response**: `200` — raw HTML (`Content-Type: text/html; charset=utf-8`) from `packagePaymentReceiptTemplate(...)` with a hardcoded sample booking (`DY-260605-A1B2C3`, "Manali Adventure Classic", deposit payment plan, etc.).
- **Side effects**: None — pure template render, no DB access.

#### GET `/api/testing/test-package`
- **Auth**: Public — no auth check.
- **Purpose**: Developer/testing endpoint that creates a hardcoded test `Package` record via `createPackages()`.
- **Request**: None.
- **Response**: `200` — `NextResponse.json(res)` where `res` is whatever `createPackages()` returns (likely the created package record or service result object). No explicit error handling.
- **Side effects**: **Writes to the database** — creates a `Package` with `title: "Test Package"`, `slug: "test-package"`, `destination_id: 1`, sample inclusions/exclusions/category (`"Adventure"`). Note: calling this repeatedly will likely fail/conflict on the unique `slug` after the first run.

---

# Part 2 — Server Actions (`app/actions/**`)

This part documents the Server Action and service layer under `app/actions/`, used as
the mutation/query API by both the public site and the staff dashboard. All files
share one Postgres DB via Prisma (`db`). Files marked `"use server"` are Server
Actions callable directly from client components; plain modules (no directive,
often `import "server-only"`) are service helpers called by those actions or by
route handlers (webhooks, crons).

### Quote & Checkout (`app/actions/quote/*`)

#### `app/actions/quote/actions.ts` — `"use server"` boundary

##### `createPackageQuote`
- **Signature**: `createPackageQuote(input: QuoteInput): Promise<CreateQuoteResult>`
- **Purpose**: Public entry point to create a signed, short-lived price lock ("quote") from a user's package/date/pax selectors.
- **Auth/role**: None required — attaches `userId` if a session exists (`getAuthenticatedUser()`), otherwise `user_id: null`.
- **Side effects**: Delegates to `createQuote` (see below) — DB write (`package_quote.create`), no external calls.

##### `getPackageQuote`
- **Signature**: `getPackageQuote(id: string): Promise<GetQuoteResult>`
- **Purpose**: Fetch a quote for the review page, with integrity verification and lazy expiry.
- **Auth/role**: None — any caller with the quote `id` can read it (quote IDs are opaque, signed).
- **Side effects**: May write `status: "EXPIRED"` on the row if past `expires_at` (lazy expiry); no external calls.

##### `checkQuoteFreshness`
- **Signature**: `checkQuoteFreshness(id: string): Promise<QuoteFreshness | null>`
- **Purpose**: Recompute today's price for a quote's locked inputs and report drift vs. the sealed total — used to refuse stale locks before payment.
- **Auth/role**: None.
- **Side effects**: Read-only; no DB writes.

#### `app/actions/quote/create-quote.service.ts`

##### `createQuote`
- **Signature**: `createQuote(rawInput: QuoteInput, opts?: { userId?: string | null }): Promise<CreateQuoteResult>`
- **Purpose**: Server-authoritative entry point that turns user selectors (package/duration/route/stay/pax/date/cabs) into a signed, persisted price lock. Validates input, computes price via `computePackagePrice`, rejects un-priceable configs, and returns only a "safe" view (no margin/cost breakdown).
- **Auth/role**: None — caller (`createPackageQuote`) attaches `userId` if available.
- **Side effects**: DB write `package_quote.create` (full breakdown snapshot + 2dp money + HMAC signature + `inputs_hash` + `expires_at` with TTL from `QUOTE_TTL_MINUTES`, default 15 min). No external calls.

##### `payuReturnUrl` *(defined here but logically belongs to booking flow — see Booking & Payment)*

#### `app/actions/quote/get-quote.service.ts`

##### `getQuote`
- **Signature**: `getQuote(id: string): Promise<GetQuoteResult>`
- **Purpose**: Fetch a persisted quote row, verify integrity (recomputed `inputs_hash` + HMAC signature), and apply lazy expiry (`ACTIVE` → `EXPIRED` once past `expires_at`).
- **Auth/role**: None.
- **Side effects**: Conditional DB write `package_quote.update` (status flip to `EXPIRED`) when expired; no external calls.

##### `isQuoteFresh`
- **Signature**: `isQuoteFresh(id: string): Promise<QuoteFreshness | null>`
- **Purpose**: Recompute today's price for a quote's locked inputs (via `computePackagePrice`) and compare to the sealed total, returning `{ fresh, lockedTotal, currentTotal, drift }`. Used at payment time to catch rate drift.
- **Auth/role**: None.
- **Side effects**: Read-only — does NOT mutate the quote.

#### `app/actions/quote/signing.ts`

##### `computeInputsHash`
- **Signature**: `computeInputsHash(input: QuoteParsed): string`
- **Purpose**: SHA-256 over a canonical, explicitly-ordered string of validated selectors/pax/date (with `child_ages`/`cab_type_ids` sorted) — used to detect whether two selections are logically identical and to verify a stored quote hasn't been tampered with.
- **Auth/role**: None — pure function.
- **Side effects**: None.

##### `signQuote`
- **Signature**: `signQuote(p: QuoteSignaturePayload): string`
- **Purpose**: HMAC-SHA256 (using `QUOTE_SECRET`, must be ≥16 chars) over the canonical money/expiry payload — the seal stored alongside a quote.
- **Auth/role**: None — pure function.
- **Side effects**: Throws if `QUOTE_SECRET` is missing/short.

##### `verifyQuote`
- **Signature**: `verifyQuote(p: QuoteSignaturePayload, signature: string): boolean`
- **Purpose**: Timing-safe verification of a previously-issued signature against a recomputed one.
- **Auth/role**: None — pure function.
- **Side effects**: None.

##### `money2dp`
- **Signature**: `money2dp(value: number | string): string`
- **Purpose**: Formats a numeric/Decimal-ish value to a fixed 2-decimal string — the canonical representation used for signing and DB storage so float formatting can never change signed bytes.
- **Auth/role**: None — pure function.
- **Side effects**: None.

#### `app/actions/quote/schema.ts` — Types/Schemas
Plain Zod module (not `"use server"`), shared by client (PricingCard) and server. `QUOTE_LIMITS` caps adults (20), children (20), infants (10), cabs (20), child ages (0–17). `quoteInputSchema` validates: positive integer IDs for `package_id`/`duration_id`/`route_id`/`stay_category_id`; slugs (1–160 chars) for display/URL; pax counts with `child_ages` array whose length must equal `children`; `cab_type_ids` array (empty = engine defaults); `travel_date` as `YYYY-MM-DD`, must be a real calendar date and not in the past. Exports `QuoteInput` (z.input), `QuoteParsed` (z.output), `QuoteErrors` (field-error map). Hard rule: client never sends money — server re-derives every rupee.

#### `app/actions/quote/checkout-schema.ts` — Types/Schemas
Plain Zod module shared by client checkout form and server persistence. `travellerSchema` validates each traveller (`type`: ADULT/CHILD/INFANT, name, `dob`, `gender`) with `superRefine` age-consistency checks against `type` (adult ≥12, child <12, infant <2, based on DOB). `checkoutSchema` wraps `travellers` (1–40), `contact` (email + phone regex), and optional `gstStateCode`. Exports `TravellerInput`, `CheckoutInput`, `CheckoutErrors`. Traveller-count vs. quote-pax is re-checked server-side in `createBooking`.

---

### Booking & Payment (`app/actions/payment/*`)

#### `app/actions/payment/booking.actions.ts` — `"use server"` boundary

##### `createBookingDraft`
- **Signature**: `createBookingDraft(quoteId: string, opts?: { paymentChoice?: "FULL" | "DEPOSIT"; details?: CheckoutInput }): Promise<CreateBookingResult>`
- **Purpose**: Step 1 of MMT-style checkout ("Proceed to Payment") — turns an ACTIVE+fresh quote into a `Booking` with traveller/contact details and payment plan, but no gateway charge yet.
- **Auth/role**: Requires authenticated user (`getAuthenticatedUser()`); returns `{ success: false, reason: "unauthenticated" }` if absent. `Booking.userId` is non-null.
- **Side effects**: Delegates to `createBooking` — DB transaction creating `Booking` + `PaymentInstallment` rows + a `PENDING` `Payment`, and flips `package_quote.status` to `CONSUMED`.

##### `startBookingPayment`
- **Signature**: `startBookingPayment(bookingId: string, gateway?: GatewayId): Promise<CreateBookingOrderResult>`
- **Purpose**: Step 2 of checkout (payment page) — creates/reuses the gateway charge for the booking's pending first ("INITIAL") leg using the customer-chosen gateway.
- **Auth/role**: Requires authenticated user; owner-scoped (booking must belong to caller).
- **Side effects**: Delegates to `createOrderForBooking` — possible `Payment.create`/`update` and an external gateway `createCharge` call (Razorpay/PayU).

##### `startBalancePayment`
- **Signature**: `startBalancePayment(bookingId: string, gateway?: GatewayId): Promise<CreateBookingOrderResult>`
- **Purpose**: Pay an outstanding balance on an active booking (e.g. cost delta from a hotel/room swap by ops).
- **Auth/role**: Requires authenticated user; owner-scoped.
- **Side effects**: Delegates to `createBalanceOrderForBooking` — `Payment.create`/`update` with `purpose: "BALANCE"` + external gateway charge.

##### `createPackageBooking`
- **Signature**: `createPackageBooking(quoteId: string, opts?: { paymentChoice?; details?; gateway? }): Promise<CreateBookingOrderResult>`
- **Purpose**: Single-shot legacy/back-compat path — creates the booking AND its gateway order in one call.
- **Auth/role**: Requires authenticated user.
- **Side effects**: Composes `createBooking` + `createOrderForBooking` — same DB transaction + external gateway call as above.

##### `verifyCheckoutPayment`
- **Signature**: `verifyCheckoutPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<VerifyCheckoutResult>`
- **Purpose**: Verifies the browser checkout callback signature (`verifyCheckoutSignature`) as defense-in-depth/UX; does NOT finalize money (webhook is the source of truth). Returns `bookingId` so the client can redirect to confirmation.
- **Auth/role**: Requires authenticated user; the `Payment.userId` must match the caller.
- **Side effects**: DB write `payment.update` (stores `gatewaySignature`).

##### `getCancellationPreview`
- **Signature**: `getCancellationPreview(bookingId: string): Promise<CancellationPreview | null>`
- **Purpose**: Read-only refund preview for the cancel-booking confirm dialog.
- **Auth/role**: Requires authenticated user; owner-scoped via `previewCancellation`.
- **Side effects**: None (read-only).

##### `requestCancellation`
- **Signature**: `requestCancellation(bookingId: string, reason?: string): Promise<CancelBookingResult>`
- **Purpose**: Customer-initiated cancellation of their own booking with policy-driven refund.
- **Auth/role**: Requires authenticated user; `byUserId` passed through, owner-scoped.
- **Side effects**: Delegates to `cancelBooking` — gateway refund calls + DB transaction + cancellation email.

##### `getDateChangePreview`
- **Signature**: `getDateChangePreview(bookingId: string, newDate: string): Promise<DateChangePreview | null>`
- **Purpose**: Read-only preview of re-pricing + settlement direction for a proposed travel-date change.
- **Auth/role**: Requires authenticated user; owner-scoped via `previewDateChange`.
- **Side effects**: None (read-only; calls pricing engine but doesn't persist).

##### `requestDateChange`
- **Signature**: `requestDateChange(bookingId: string, newDate: string): Promise<DateChangeResult>`
- **Purpose**: Applies a travel-date change to the user's own booking, settling the price difference (refund/topup/balance/none).
- **Auth/role**: Requires authenticated user; owner-scoped via `byUserId`.
- **Side effects**: Delegates to `changeTravelDate` — DB updates to `Booking`/`PaymentInstallment`, possible refund or new TOPUP `Payment` + gateway charge.

#### `app/actions/payment/create-booking.service.ts`

##### `payuReturnUrl`
- **Signature**: `payuReturnUrl(bookingId: string, kind: "success" | "failure"): string`
- **Purpose**: Builds the absolute callback URL for redirect-based gateways (PayU surl/furl) from `NEXT_PUBLIC_BASE_URL`.
- **Auth/role**: None — pure helper.
- **Side effects**: None.

##### `createBooking`
- **Signature**: `createBooking(params: { quoteId: string; userId: string; paymentChoice?: "FULL" | "DEPOSIT"; details?: CheckoutInput }): Promise<CreateBookingResult>`
- **Purpose**: Step 1 — turns a verified ACTIVE+fresh quote into a `Booking`. Idempotent: if `Booking.quoteId` (unique) already exists, returns the existing booking instead of duplicating. Validates checkout details against quote pax, computes payment schedule via `computePaymentSchedule`, honors `paymentChoice` (near-travel forces FULL).
- **Auth/role**: None internally — caller (`booking.actions.ts`) supplies `userId` from an authenticated session; verifies quote ownership isn't checked here beyond existing-booking `userId` match.
- **Side effects**: DB transaction — `booking.create` (+ nested `travellersList`, `installments`), `package_quote.update({status: "CONSUMED"})`, `payment.create` (PENDING, no gateway call). Gateway charge deliberately deferred (no network call inside tx).

##### `createOrderForBooking`
- **Signature**: `createOrderForBooking(params: { bookingId: string; userId: string; gateway?: GatewayId }): Promise<CreateBookingOrderResult>`
- **Purpose**: Step 2 — creates or reuses the gateway charge for the booking's pending "INITIAL" payment leg. Reuses an open PENDING leg of the requested gateway; switches/creates a fresh charge if the gateway differs.
- **Auth/role**: None internally — verifies `booking.userId === params.userId` (ownership check happens here).
- **Side effects**: `Payment.create`/`update`; external gateway calls `provider.checkoutForExistingOrder` or `provider.createCharge` (Razorpay/PayU via `getProvider`).

##### `createBookingAndOrder`
- **Signature**: `createBookingAndOrder(params: { quoteId: string; userId: string; paymentChoice?; details?; gateway? }): Promise<CreateBookingOrderResult>`
- **Purpose**: Composes `createBooking` + `createOrderForBooking` in one call (tests/back-compat single-shot).
- **Auth/role**: Same as the two composed functions.
- **Side effects**: Union of both — DB transaction + external gateway charge.

#### `app/actions/payment/finalize.service.ts`

##### `finalizeCapturedPayment`
- **Signature**: `finalizeCapturedPayment(tx: Prisma.TransactionClient, args: { paymentId: string; gatewayPaymentId: string; method?: string | null; rawPayload?: object | null; webhookEventId?: string | null }): Promise<FinalizeResult>`
- **Purpose**: The single place that applies a captured payment to a booking — flips `Payment` → `FULLY_PAID`, the `DEPOSIT` installment → `PAID`, and updates `Booking.paymentStatus`/paid amounts. Shared by the webhook (source of truth) and reconciliation (safety net) so they never diverge. Branches on `payment.purpose` (`INITIAL` vs `TOPUP`/`BALANCE`) for different update logic.
- **Auth/role**: None — internal, must run inside a caller-supplied transaction (`tx`).
- **Side effects**: DB writes within the passed transaction: `payment.update`, `paymentInstallment.updateMany` (for INITIAL), `booking.update`. Idempotent — a `FULLY_PAID` payment is a no-op (`result: "already"`).

#### `app/actions/payment/webhook.service.ts`

##### `processGatewayWebhook`
- **Signature**: `processGatewayWebhook(gateway: GatewayId, rawBody: string, headers: Headers): Promise<WebhookOutcome>`
- **Purpose**: Gateway-agnostic webhook processor — the source of payment truth. Verifies signature → dedupes via `WebhookEvent(gateway, eventId)` → parses normalized event → acts: `captured` → `finalizeCapturedPayment` (+ confirmation email if INITIAL); `failed` → marks `Payment.FAILED`; `refunded` → `REFUNDED`/`PARTIALLY_REFUNDED` + booking mirror (+ refund email); other → ignored.
- **Auth/role**: None — authenticated via gateway signature verification (`provider.verifyWebhook`). Called from an API route handler, not directly by users.
- **Side effects**: DB writes — `webhookEvent.create`/`update`, `payment.update`, `booking.update` (within transactions where relevant). External: `notifyBookingConfirmed`, `notifyRefund` emails. Returns `httpStatus` (400 bad signature, 200 handled/duplicate/ignored, 500 retry-worthy error).

#### `app/actions/payment/balance-payment.service.ts`

##### `createBalanceOrderForBooking`
- **Signature**: `createBalanceOrderForBooking(params: { bookingId: string; userId: string; gateway?: GatewayId }): Promise<CreateBookingOrderResult>`
- **Purpose**: Creates/reuses a gateway charge for an outstanding balance on an active booking (e.g. cost delta from ops swapping a costlier hotel/room). Charged with `purpose: "BALANCE"`; settled by the webhook's TOPUP/BALANCE branch in `finalizeCapturedPayment`.
- **Auth/role**: None internally — verifies `booking.userId === params.userId`; rejects if booking is `CANCELLED`, initial payment still `PENDING`, or `balanceAmount_paise <= 0`.
- **Side effects**: `Payment.create`/`update`; external gateway `createCharge`/`checkoutForExistingOrder`.

#### `app/actions/payment/cancel-booking.service.ts`

##### `cancelBooking`
- **Signature**: `cancelBooking(params: { bookingId: string; reason?: string; byUserId?: string }): Promise<CancelBookingResult>`
- **Purpose**: Cancels a booking and initiates a policy-driven refund (`computeCancellationRefund`). Order: compute policy → initiate per-payment gateway refunds (idempotent via `refundId`) → mark booking `CANCELLED` + cancel unpaid installments. Re-cancelling is a no-op (reports existing refund lines).
- **Auth/role**: If `byUserId` is set, booking must belong to that user (self-service); omit for admin/dashboard use. Returns `"forbidden"` on mismatch, `"not_cancellable"` if status is `CANCELLED`/`COMPLETED` already excluded path differs (already-cancelled is idempotent-success).
- **Side effects**: External gateway `refund()` calls per captured payment; DB transaction (`booking.update` status=CANCELLED, `paymentInstallment.updateMany` → CANCELLED); cancellation email via `notifyCancellation`. Money is only *initiated* — refund webhook/reconciliation flips final status.

##### `previewCancellation`
- **Signature**: `previewCancellation(bookingId: string, byUserId?: string): Promise<CancellationPreview | null>`
- **Purpose**: Read-only preview of refund amount/fee/percentage for the cancel confirm dialog.
- **Auth/role**: If `byUserId` set, returns `null` on ownership mismatch.
- **Side effects**: None (read-only).

#### `app/actions/payment/change-date.service.ts`

##### `planSettlement`
- **Signature**: `planSettlement(newTotalPaise: number, feePaise: number, paidPaise: number, hasPendingBalance: boolean): { newOutstanding: number; direction: DateChangeDirection; settleAmountPaise: number }`
- **Purpose**: Pure calculation — given new total + date-change fee vs. amount already paid, determines settlement direction (`refund` / `topup` / `balance` / `none`) and amount.
- **Auth/role**: None — pure function.
- **Side effects**: None.

##### `previewDateChange`
- **Signature**: `previewDateChange(bookingId: string, newDate: string, byUserId?: string): Promise<DateChangePreview | null>`
- **Purpose**: Read-only preview — re-prices the booking for `newDate` (via `computePackagePrice`/`reprice`), applies `planSettlement`, and returns the projected outstanding/refund/topup amount for the confirm dialog.
- **Auth/role**: If `byUserId` set, returns `null` on ownership mismatch or if booking is `CANCELLED`/`COMPLETED`/has no `quoteId`.
- **Side effects**: None (read-only; calls pricing engine).

##### `changeTravelDate`
- **Signature**: `changeTravelDate(params: { bookingId: string; newDate: string; byUserId?: string }): Promise<DateChangeResult>`
- **Purpose**: Applies a travel-date change — re-prices, adds the date-change fee (`resolveConfig().dateChangeFeePaise`), and settles the difference: `refund` (gateway refund on captured payments), `topup` (new `Payment` + gateway charge), `balance` (adjusts the pending `BALANCE` installment), or `none`. Updates `Booking.startDate/endDate/totalAmount*`.
- **Auth/role**: Same ownership/status checks as `previewDateChange`; `newDate` must be a real future date.
- **Side effects**: External gateway `refund()`/`createCharge()` depending on direction; DB writes to `Payment`, `PaymentInstallment`, `Booking` (some within `db.$transaction` for the `balance` branch).

#### `app/actions/payment/reconcile.service.ts`

##### `reconcilePendingPayments`
- **Signature**: `reconcilePendingPayments(opts?: { olderThanMinutes?: number; statusOf?: StatusFetcher; limit?: number }): Promise<ReconSummary>`
- **Purpose**: Safety net for missed/late webhooks — for `Payment` rows stuck `PENDING` past a staleness window (`RECON_STALE_MINUTES`, default 15), queries the gateway provider for real order status and finalizes (`finalizeCapturedPayment`) or marks `FAILED`.
- **Auth/role**: None — intended for cron/internal invocation, not end-user.
- **Side effects**: External gateway `fetchChargeStatus` calls (or injected `statusOf`); DB writes via `finalizeCapturedPayment` (transaction) or `payment.update` (FAILED). Only touches `PENDING` payments — can never override a webhook result.

##### `reconcileRefunds`
- **Signature**: `reconcileRefunds(opts?: { statusOf?: RefundStatusFetcher; limit?: number }): Promise<RefundReconSummary>`
- **Purpose**: Confirms refunds that were initiated (`Payment.refundId` set) but never confirmed via webhook (notably PayU has no refund webhook) — polls gateway and finalizes `REFUNDED`/`PARTIALLY_REFUNDED`.
- **Auth/role**: None — cron/internal.
- **Side effects**: External gateway `fetchRefundStatus` (or injected `statusOf`); DB transaction (`payment.update`, `booking.update`); refund email via `notifyRefund`.

#### `app/actions/payment/reminders.service.ts`

##### `runBalanceReminders`
- **Signature**: `runBalanceReminders(opts?: { now?: Date; mailer?: Mailer }): Promise<ReminderSummary>`
- **Purpose**: Sends balance-due reminder emails for deposit bookings at 3 touchpoints (7 days before, 1 day before, overdue), de-duped via `reminderCount` (monotonic stage marker 1/2/3) so each fires at most once. Also flips installment status to `OVERDUE` once past due.
- **Auth/role**: None — cron/internal job. `mailer` is injectable for tests (default `sendEmail`).
- **Side effects**: Email sends (`sendEmail` / injected mailer); DB write `paymentInstallment.update` (reminderCount, reminderSentAt, status).

#### `app/actions/payment/schedule.ts` — `"use server"`

##### `getPaymentScheduleForQuote`
- **Signature**: `getPaymentScheduleForQuote(quoteId: string): Promise<PaymentScheduleResult>`
- **Purpose**: Read-only — resolves a quote via `getQuote`, then runs the payment-policy engine (`computePaymentSchedule`) on its total + travel date, returning a safe DTO (paise amounts, dates, currency, plan) for display. Still computes a schedule for `EXPIRED` quotes (the review page decides what to show).
- **Auth/role**: None.
- **Side effects**: None — no DB write, no gateway call.

#### `app/actions/payment/types.ts` — Types/Schemas
Plain module (no `"use server"`), shared DTOs for the payment-schedule/booking-order action layer. Key exports: `PaymentScheduleDTO`/`PaymentScheduleResult` (plan, paise amounts, due date, currency); `BookingOrderDTO`/`CreateBookingOrderResult` (gateway-agnostic checkout init data, no secrets) and `CreateBookingOrderReason` union (`unauthenticated`/`not_found`/`invalid`/`not_active`/`stale`/`error`); `CreateBookingResult`, `VerifyCheckoutResult`; `CancelRefundLine`/`CancelBookingResult` (refund lines with state `processed`/`pending`/`failed`); `CancellationPreview`; `DateChangeDirection` (`topup`/`refund`/`balance`/`none`), `DateChangePreview`, `DateChangeResult`.

---

### Packages — CRUD, Pricing, Itinerary, Cabs, Gallery (`app/actions/packages/*`)

#### `app/actions/packages/package.actions.ts` — `"use server"` (dashboard)

##### `createPackage`
- **Signature**: `createPackage(data: createPackagesTypes): Promise<{ success: boolean; ... }>`
- **Purpose**: Validates input against `createPackageSchema` and creates a new package via `createPackages` service. Handles unique-slug conflicts (Prisma `P2002`) distinctly.
- **Auth/role**: None checked in this file — caller (dashboard page/route) is responsible for staff auth.
- **Side effects**: DB write via `createPackages` service (package + related records). No `revalidatePath` here.

##### `updatePackageBasicInfo`
- **Signature**: `updatePackageBasicInfo(id: number, data: createPackagesTypes): Promise<{ success: boolean; ... }>`
- **Purpose**: Updates a package's core fields (title, slug, thumbnail, description, destination, inclusions/exclusions) and syncs its tags/categories (upserting new tag/category names by slugified name).
- **Auth/role**: None checked here — dashboard-only by convention; caller responsible.
- **Side effects**: Slug-uniqueness check (excluding self); DB transaction — `package_tags`/`package_categories` delete+recreate, `packages.update`; `revalidatePath("/dashboard/packages")` and `revalidatePath("/dashboard/packages/${id}")`.

#### `app/actions/packages/fetch-page-data.ts` (no `"use server"` — plain server module)

##### `fetchPackagePageData`
- **Signature**: `fetchPackagePageData(packageSlug: string, durationSlug: string, routeSlug: string, staySlug: string): Promise<PackagePageData | null>`
- **Purpose**: The main public package-detail page data loader — fetches package basics, the selected duration/route/stay combination, full itinerary (hotels, activities, transfers, attractions, notes), pricing config, and active cab types, shaping it all into one `PackagePageData` object. Falls back to default duration/route/stay when the requested slug doesn't match. Propagates multi-night hotel stays to days without their own stay entry.
- **Auth/role**: None — public read.
- **Side effects**: Read-only, multiple parallel `db` queries; no writes.

##### `getActivePackageParams`
- **Signature**: `getActivePackageParams(): Promise<{ slug: string; duration: string; route: string; stay: string }[]>`
- **Purpose**: Builds the list of `(slug, duration, route, stay)` combinations for Next.js `generateStaticParams` — one default combination per active package.
- **Auth/role**: None — build-time helper.
- **Side effects**: Read-only.

##### `fetchRelatedPackages`
- **Signature**: `fetchRelatedPackages(currentPackageId: number, destinationId: number, limit?: number): Promise<RelatedPackageItem[]>`
- **Purpose**: Returns up to `limit` related packages via a 3-tier fallback: same destination → same region → any active package. Computes discounted/original price per package from its default duration/route/stay's hotel room pricing.
- **Auth/role**: None — public read.
- **Side effects**: Read-only; resolves image URLs via `R2` public URL env var.

##### `fetchRecentPackages`
- **Signature**: `fetchRecentPackages(limit?: number): Promise<RelatedPackageItem[]>`
- **Purpose**: Returns the `limit` most-recently-created active packages (for the home page) with the same pricing shape as `fetchRelatedPackages`.
- **Auth/role**: None — public read.
- **Side effects**: Read-only.

##### `getDurationStartingPrices`
- **Signature**: `getDurationStartingPrices(packageId: number, durationIds: number[], stayCategoryId: number, occupancy: { adults; children; childAges; travelDate }): Promise<Map<number, DurationPriceInfo>>`
- **Purpose**: For each duration, resolves its default/first active route and computes a per-adult starting price (via `computePackagePrice`) at the given occupancy — so the client can recompute price as travellers/duration change.
- **Auth/role**: None — public read.
- **Side effects**: Read-only; multiple `computePackagePrice` calls (price = 0 if un-priceable).

#### `app/actions/packages/cab-pricing.actions.ts` — `"use server"` (dashboard)

##### `createCabType`
- **Signature**: `createCabType(data: CreateCabTypeInput): Promise<{ success: true; id: number } | { success: false; error: string }>`
- **Purpose**: Creates a `package_cab_types` row (vehicle + label/note/default flag) and its initial `package_cab_segments` (day-range pricing references) in one transaction. Does not clear other groups' defaults (each day-range group manages its own default independently).
- **Auth/role**: None checked — dashboard-only by convention.
- **Side effects**: DB transaction (`package_cab_types.create` + `package_cab_segments.createMany`); `revalidatePath("/dashboard/packages/${package_id}")`.

##### `updateCabType`
- **Signature**: `updateCabType(id: number, packageId: number, data: UpdateCabTypeInput): Promise<{ success: true } | { success: false; error: string }>`
- **Purpose**: Updates a cab type's label/note/`is_active`/`is_default` fields directly (no group-aware default clearing — use `setDefaultCabType` for that).
- **Auth/role**: None checked.
- **Side effects**: DB transaction `package_cab_types.update`; `revalidatePath`.

##### `setDefaultCabType`
- **Signature**: `setDefaultCabType(id: number, packageId: number): Promise<{ success: true } | { success: false; error: string }>`
- **Purpose**: Moves the "default" cab type within a day-range group — finds other cab types sharing the same `(day_from, day_to)` segment range under the same package+duration, clears their `is_default`, then sets the target as default.
- **Auth/role**: None checked.
- **Side effects**: DB transaction (`updateMany` + `update`); `revalidatePath`. Throws `"Cab type not found"` if target missing.

##### `deleteCabType`
- **Signature**: `deleteCabType(id: number, packageId: number): Promise<{ success: true } | { success: false; error: string }>`
- **Purpose**: Deletes a cab type (cascades to its segments via DB constraint).
- **Auth/role**: None checked.
- **Side effects**: `package_cab_types.delete`; `revalidatePath`.

##### `upsertCabSegment`
- **Signature**: `upsertCabSegment(data: { id?: number; cab_type_id: number; package_id: number; day_from: number; day_to: number; cab_pricing_id: number; sort_order?: number }): Promise<{ success: true; id: number } | { success: false; error: string }>`
- **Purpose**: Creates or updates a single `package_cab_segments` row (day-range + cab pricing reference).
- **Auth/role**: None checked.
- **Side effects**: `package_cab_segments.create`/`update`; `revalidatePath`.

##### `deleteCabSegment`
- **Signature**: `deleteCabSegment(id: number, packageId: number): Promise<{ success: true } | { success: false; error: string }>`
- **Purpose**: Deletes a single cab segment.
- **Auth/role**: None checked.
- **Side effects**: `package_cab_segments.delete`; `revalidatePath`.

##### `getCabPricingOptionsForVehicle`
- **Signature**: `getCabPricingOptionsForVehicle(vehicleId: number): Promise<{ success: true; data: CabPricingOption[] } | { success: false; error: string }>`
- **Purpose**: Loads active `cab_pricing` records (with destination + season count) for a given vehicle — used to populate the segment selector.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `getAllCabPricingOptions`
- **Signature**: `getAllCabPricingOptions(opts?: { stopCoords?: {lat;lng}[]; excludeVehicleIds?: number[]; query?: string }): Promise<{ success: true; data: FullCabPricingOption[] } | { success: false; error: string }>`
- **Purpose**: Loads all active `cab_pricing` records with vehicle info, sorted by proximity to provided stop coordinates (haversine distance, <200km treated as "nearby") then alphabetically; supports text search and vehicle exclusion.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

#### `app/actions/packages/gallery.actions.ts` — `"use server"` (dashboard)

##### `handleGetPackageGallery`
- **Signature**: `handleGetPackageGallery(packageId: number, routeId: number): Promise<{ success: true; data } | { success: false; message }>`
- **Purpose**: Loads the 5-slot gallery configuration for a package+route via `getPackageGallery` service.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `handleGetSourceImages`
- **Signature**: `handleGetSourceImages(packageId: number): Promise<{ success: true; data } | { success: false; message }>`
- **Purpose**: Loads candidate source images (from hotels/activities/etc.) for populating gallery slots, via `getPackageSourceImages`.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `handleUpsertGallerySlot`
- **Signature**: `handleUpsertGallerySlot(packageId: number, routeId: number, position: number, imageUrl: string, sourceType: GallerySlot["source_type"], sourceId: number | null): Promise<{ success: true } | { success: false; message }>`
- **Purpose**: Sets one of the 5 gallery slots (position 1–5) to a given image, sourced from a hotel/activity/etc.
- **Auth/role**: None checked. Validates `position` is 1–5.
- **Side effects**: `upsertGallerySlot` DB write; `revalidatePath("/dashboard/packages/${packageId}")`.

##### `handleClearGallerySlot`
- **Signature**: `handleClearGallerySlot(packageId: number, routeId: number, position: number): Promise<{ success: true } | { success: false; message }>`
- **Purpose**: Clears a gallery slot.
- **Auth/role**: None checked. Validates `position` is 1–5.
- **Side effects**: `clearGallerySlot` DB write; `revalidatePath`.

##### `handleUpdateGallerySlotLabel`
- **Signature**: `handleUpdateGallerySlotLabel(packageId: number, routeId: number, position: number, label: string): Promise<{ success: true } | { success: false; message }>`
- **Purpose**: Updates the display label of a gallery slot.
- **Auth/role**: None checked. Validates `position` is 1–5.
- **Side effects**: `updateGallerySlotLabel` DB write; `revalidatePath`.

#### `app/actions/packages/itinerary-builder.actions.ts` — `"use server"` (dashboard)

All functions below are thin wrappers that delegate to `app/services/itinerary-builder.service.ts`, catch errors into `{ success: false, message }`, and (for mutations) call `revalidatePath(/dashboard/packages/${packageId})`. None check auth in this file — dashboard-only by convention.

##### `handleGetItineraryData`
- **Signature**: `handleGetItineraryData(packageId: number, durationId: number, routeId: number): Promise<{success:true; data} | {success:false; message}>`
- **Purpose**: Loads the full itinerary-builder data for a package/duration/route (days, stays, activities, transfers, notes, attractions).
- **Side effects**: Read-only.

##### `handleUpsertDayMeta`
- **Signature**: `handleUpsertDayMeta(packageId, durationId, routeId, day: number, data: { title; description?; meals?; excluded_meals? }): Promise<{success:true; data:{id}} | {success:false; message}>`
- **Purpose**: Creates/updates an itinerary day's title/description/meal flags. Validates `day` is a positive integer and `title` is non-empty.
- **Side effects**: `upsertDayMeta` write; `revalidatePath`.

##### `handleGetActivityVariants`
- **Signature**: `handleGetActivityVariants(activityId: number): Promise<{success:true; data} | {success:false; data:[]; message}>`
- **Purpose**: Loads pricing variants for an activity.
- **Side effects**: Read-only.

##### `handleAddActivity` / `handleUpdateActivity` / `handleDeleteActivity`
- **Signature**: `handleAddActivity(itineraryId, activityId, isOptional: boolean, packageId, variantId?)`; `handleUpdateActivity(id, data: {is_optional?; sort_order?; variant_id?}, packageId)`; `handleDeleteActivity(id, packageId)` — all return `{success:true} | {success:false; message}`.
- **Purpose**: CRUD for an itinerary day's activity links (`itinerary_activities`).
- **Side effects**: DB write via service + `revalidatePath`.

##### `handleAddTransfer` / `handleUpdateTransfer` / `handleDeleteTransfer`
- **Signature**: `(itineraryId|id, data: TransferInput, packageId) → {success:true}|{success:false;message}`
- **Purpose**: CRUD for itinerary transfer legs.
- **Side effects**: DB write via service + `revalidatePath`.

##### `handleAddNote` / `handleUpdateNote` / `handleDeleteNote`
- **Signature**: `(itineraryId|id, data: NoteInput, packageId) → {success:true}|{success:false;message}`
- **Purpose**: CRUD for itinerary notes (display callouts).
- **Side effects**: DB write via service + `revalidatePath`.

##### `handleUpsertStay`
- **Signature**: `handleUpsertStay(itineraryId, stayCategoryId, roomPricingId, sortOrder, packageId, numNights = 1): Promise<{success:true; id} | {success:false; message}>`
- **Purpose**: Links a room-pricing/hotel stay to an itinerary day for a given stay category, with a night count.
- **Side effects**: `upsertItineraryStay` write; `revalidatePath`.

##### `handleDeleteStay`
- **Signature**: `handleDeleteStay(id, packageId) → {success:true}|{success:false;message}`
- **Purpose**: Removes a hotel stay from an itinerary day.
- **Side effects**: `deleteItineraryStay` write; `revalidatePath`.

##### `handleUpdateStayActiveMeals`
- **Signature**: `handleUpdateStayActiveMeals(id, activeMeals: string[], packageId) → {success:true}|{success:false;message}`
- **Purpose**: Toggles which meal types are active for a stay.
- **Side effects**: `updateStayActiveMeals` write. **Note**: deliberately does NOT call `revalidatePath` — would remount the sidebar and break optimistic UI updates.

##### `handleReorderItems`
- **Signature**: `handleReorderItems(updates: ReorderItem[], packageId) → {success:true}|{success:false;message}`
- **Purpose**: Bulk-updates `sort_order` for itinerary day items.
- **Side effects**: `reorderDayItems` write; `revalidatePath`.

##### `handleGetVehicles`
- **Signature**: `handleGetVehicles(): Promise<{success:true; data} | {success:false; data:[]; message}>`
- **Purpose**: Loads the vehicle catalog for cab/transfer selection.
- **Side effects**: Read-only.

##### `handleSearchActivities`
- **Signature**: `handleSearchActivities(destinationId, query: string): Promise<{success:true; data:{items; has_more}} | {success:false; data:{items:[];has_more:false}; message}>`
- **Purpose**: Searches activities by destination + text query for the itinerary builder's add-activity picker.
- **Side effects**: Read-only.

##### `handleSearchRoomPricings`
- **Signature**: `handleSearchRoomPricings(destinationId, query, itineraryId?, stayBlockOrder?, stopIndex?): Promise<{success:true;data:{items;has_more}}|{success:false;data:{items:[];has_more:false};message}>`
- **Purpose**: Searches hotel room-pricing records for the stay picker, contextualized by itinerary position.
- **Side effects**: Read-only.

##### `handleGetRoomPricingById`
- **Signature**: `handleGetRoomPricingById(id: number): Promise<{success:true;data}|{success:false;data:null;message}>`
- **Purpose**: Loads a single room-pricing record by id.
- **Side effects**: Read-only.

##### `handleGetStayCategories` / `handleCreateStayCategory` / `handleUpdateStayCategory` / `handleDeleteStayCategory` / `handleReorderStayCategories`
- **Signature**: `handleGetStayCategories(packageId)`; `handleCreateStayCategory(packageId, data: StayCategoryInput)`; `handleUpdateStayCategory(id, data: StayCategoryInput, packageId)`; `handleDeleteStayCategory(id, packageId)`; `handleReorderStayCategories(updates: {id;sort_order}[], packageId)` — all return `{success:true; ...} | {success:false; message}`.
- **Purpose**: Full CRUD + reordering for a package's stay-category tiers (e.g. "Standard"/"Deluxe"/"Luxury").
- **Side effects**: DB writes via service + `revalidatePath`. `handleDeleteStayCategory` returns a specific "in use by an itinerary" message on failure.

##### `handleGetDaySourceImages`
- **Signature**: `handleGetDaySourceImages(itineraryId, packageId): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Loads candidate images (from the day's hotel/activities) for the attraction picker.
- **Side effects**: Read-only.

##### `handleAddAttraction` / `handleBulkAddAttractions` / `handleUpdateAttraction` / `handleDeleteAttraction` / `handleReorderAttractions`
- **Signature**: `handleAddAttraction(itineraryId, imageKey, caption, packageId)`; `handleBulkAddAttractions(itineraryId, imageKeys: string[], packageId)`; `handleUpdateAttraction(id, caption, packageId)`; `handleDeleteAttraction(id, packageId)`; `handleReorderAttractions(updates:{id;sort_order}[], packageId)` — all return `{success:true;...}|{success:false;message}`.
- **Purpose**: CRUD + reordering for itinerary "attraction" image+caption items.
- **Side effects**: DB writes via service + `revalidatePath`.

##### `handleCheckItineraryDaysContent`
- **Signature**: `handleCheckItineraryDaysContent(packageId, routeId, durationId, fromDay, toDay): Promise<{success:true; hasContent:boolean}|{success:false;message}>`
- **Purpose**: Checks whether a day range already has itinerary content — used before destructive route/day edits (e.g. shrinking trip length).
- **Side effects**: Read-only.

##### `handleGetHotelMealPricings`
- **Signature**: `handleGetHotelMealPricings(hotelId: number): Promise<{success:true;data:HotelMealOption[]}|{success:false;data:[];message}>`
- **Purpose**: Loads meal-plan pricing options for a hotel.
- **Side effects**: Read-only.

#### `app/actions/packages/package-image.actions.ts` — `"use server"` (dashboard)

##### `handleGetPackageImages`
- **Signature**: `handleGetPackageImages(packageId: number): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Loads all gallery images for a package via `getPackageImages`.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `handleAddImages`
- **Signature**: `handleAddImages(packageId: number, imageUrls: string[]): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Adds one or more uploaded image URLs (presumably R2-hosted) to a package's gallery via `addPackageImages`.
- **Auth/role**: None checked.
- **Side effects**: DB write; `revalidatePath("/dashboard/packages/${packageId}")`.

##### `handleSetPrimaryImage`
- **Signature**: `handleSetPrimaryImage(imageId: number, packageId: number): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Marks an image as the package's primary image via `setPrimaryImage`.
- **Auth/role**: None checked.
- **Side effects**: DB write; `revalidatePath`.

##### `handleReorderImages`
- **Signature**: `handleReorderImages(packageId: number, updates: {id;sort_order}[]): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Bulk-updates image `sort_order` via `reorderImages`.
- **Auth/role**: None checked.
- **Side effects**: DB write; `revalidatePath`.

##### `handleDeleteImage`
- **Signature**: `handleDeleteImage(imageId: number, packageId: number): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Deletes a package image via `deleteImage` (likely also removes from R2 inside the service).
- **Auth/role**: None checked.
- **Side effects**: DB write (+ possible R2 delete inside service); `revalidatePath`.

#### `app/actions/packages/policies.actions.ts` — `"use server"` (dashboard)

##### `searchPoliciesByType`
- **Signature**: `searchPoliciesByType(type: string, query: string): Promise<{success:true;data:{id;title;points}[]}|{success:false;data:[];message}>`
- **Purpose**: Searches active policy records of a given `type` (e.g. cancellation/booking policy) by title for the policy-picker.
- **Auth/role**: None checked.
- **Side effects**: Read-only. Returns top 20, ordered by `sort_order` then `title`.

##### `setPackagePolicy`
- **Signature**: `setPackagePolicy(packageId: number, type: string, policyId: number): Promise<{success:true}|{success:false;message}>`
- **Purpose**: Assigns a policy of a given type to a package, replacing any existing policy of that type for the package (one policy per type per package).
- **Auth/role**: None checked.
- **Side effects**: DB transaction (`package_policy_map` delete-existing-of-type + create); `revalidatePath("/dashboard/packages/${packageId}")`.

##### `removePackagePolicy`
- **Signature**: `removePackagePolicy(packageId: number, type: string): Promise<{success:true}|{success:false;message}>`
- **Purpose**: Removes the package's policy mapping(s) of a given type.
- **Auth/role**: None checked.
- **Side effects**: DB transaction (`package_policy_map.delete` for each match); `revalidatePath`.

#### `app/actions/packages/pricing.actions.ts` — `"use server"` (dashboard + shared)

##### `handleGetPackagePricings`
- **Signature**: `handleGetPackagePricings(packageId: number): Promise<{success:true;data:{id;duration_id;stay_category_id;margin_percentage;gst_percentage}[]}|{success:false;error}>`
- **Purpose**: Loads all `package_pricing` rows (margin % and GST % per duration×stay-category) for a package.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `handleUpsertPackagePricing`
- **Signature**: `handleUpsertPackagePricing(input: { package_id; duration_id; stay_category_id; margin_percentage; gst_percentage }): Promise<{success:true}|{success:false;error}>`
- **Purpose**: Upserts the margin/GST configuration for a (package, duration, stay category) combination — the core inputs to `computePackagePrice`.
- **Auth/role**: None checked.
- **Side effects**: `package_pricing.upsert`; `revalidatePath("/dashboard/packages/${input.package_id}")`.

##### `handleComputePackagePrice`
- **Signature**: `handleComputePackagePrice(input: PricingInput): Promise<{success:true;data}|{success:false;error}>`
- **Purpose**: Thin wrapper around `computePackagePrice` (the shared pricing engine) — clamps `adults`/`children`/`infants` to valid non-negative integers (adults ≥1) before computing. Used by both dashboard previews and possibly public price checks.
- **Auth/role**: None checked.
- **Side effects**: Read-only (pricing computation only — no persistence).

#### `app/actions/packages/route-builder.actions.ts` — `"use server"` (dashboard)

##### `handleGetRouteData`
- **Signature**: `handleGetRouteData(packageId: number): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Loads route/duration/stop data for the route-builder UI via `getPackageRouteData`.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `handleSaveRouteVariant`
- **Signature**: `handleSaveRouteVariant(packageId, stops: StopInput[], meta?: RouteMeta, durationMeta?: DurationMeta, routeId?: number): Promise<{success:true;data}|{success:false;message}>`
- **Purpose**: Creates or updates a route variant (ordered list of stops with stay-day counts), plus optional route/duration metadata, via `upsertRouteVariant`. Validates: at least one stop, every stop has a name, every stop has `stay_days >= 1`.
- **Auth/role**: None checked.
- **Side effects**: DB write via service; `revalidatePath("/dashboard/packages/${packageId}")`.

##### `handleDeleteRouteVariant`
- **Signature**: `handleDeleteRouteVariant(routeId: number, packageId: number): Promise<{success:true}|{success:false;message}>`
- **Purpose**: Deletes a route variant via `deleteRouteVariant`.
- **Auth/role**: None checked.
- **Side effects**: DB write; `revalidatePath`.

##### `handleUpdateRouteMeta`
- **Signature**: `handleUpdateRouteMeta(routeId, data: {name?;slug?;meta_title?;meta_desc?}, packageId): Promise<{success:true}|{success:false;message}>`
- **Purpose**: Updates a route's display name/slug/SEO metadata via `updateRouteMeta`.
- **Auth/role**: None checked.
- **Side effects**: DB write; `revalidatePath`.

##### `handleUpdateDurationMeta`
- **Signature**: `handleUpdateDurationMeta(durationId, data: {is_default?;thumbnail_url?;sort_order?;is_active?;label?}, packageId): Promise<{success:true}|{success:false;message}>`
- **Purpose**: Updates a duration's display/activation metadata via `updateDurationMeta`.
- **Auth/role**: None checked.
- **Side effects**: DB write; `revalidatePath`.

#### `app/actions/packages/search.actions.ts` — `"use server"` (dashboard form helpers)

##### `createTag`
- **Signature**: `createTag(name: string): Promise<{ id: number; label: string }>`
- **Purpose**: Creates a new `tags` row with a slugified, de-duplicated slug (`uniqueSlug`).
- **Auth/role**: None checked.
- **Side effects**: `tags.create` (and possibly several `findUnique` checks to find a unique slug).

##### `createCategory`
- **Signature**: `createCategory(name: string): Promise<{ id: number; label: string }>`
- **Purpose**: Creates a new `categories` row (active by default) with a unique slug.
- **Auth/role**: None checked.
- **Side effects**: `categories.create`.

##### `searchDestinations`
- **Signature**: `searchDestinations(query: string): Promise<{ id: number; label: string }[]>`
- **Purpose**: Searches active destinations by name (case-insensitive contains), top 15, for a package's destination picker.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `searchTags`
- **Signature**: `searchTags(query: string): Promise<{ id: number; label: string }[]>`
- **Purpose**: Searches all tags by name, top 20, for a tag picker.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

##### `searchCategories`
- **Signature**: `searchCategories(query: string): Promise<{ id: number; label: string }[]>`
- **Purpose**: Searches active categories by name, top 20, for a category picker.
- **Auth/role**: None checked.
- **Side effects**: Read-only.

---

### Blogs (`app/actions/blogs/*`)

#### `app/actions/blogs/actions.ts` — `"use server"` (authenticated content authors)

##### `saveBlogDraft`
- **Signature**: `saveBlogDraft(input: SaveDraftInput): Promise<BlogActionResult>` where `BlogActionResult = {success:true;id:string}|{success:false;error:string}`
- **Purpose**: Creates a new `DRAFT` blog post or updates an existing `DRAFT`/`REJECTED` post owned by the caller. Auto-generates a unique slug on create; auto-extracts an excerpt from the first paragraph (`extractExcerpt`) if none supplied; upserts tags by slug; replaces category links.
- **Auth/role**: Requires authenticated session (`requireUser()` via `auth()`); on update, post must be owned by `author_id === user.id` and in `DRAFT`/`REJECTED` status.
- **Side effects**: DB writes — `blog_tags.upsert` per tag, `blog_posts.create` or `.update` (with nested `categories`/`tags` create/deleteMany). Strips React RSC proxy markers from Tiptap JSON content before persisting. No `revalidatePath`.

##### `submitBlogForReview`
- **Signature**: `submitBlogForReview(id: string): Promise<BlogActionResult>`
- **Purpose**: Transitions a post from `DRAFT`/`REJECTED` to `PENDING_REVIEW`, clearing any prior `rejection_note`. Rejects empty posts (no title or empty Tiptap content).
- **Auth/role**: Requires authenticated session; post must be owned by caller and in `DRAFT`/`REJECTED` status.
- **Side effects**: `blog_posts.update` (status, rejection_note); `revalidatePath("/blogs/my-blogs")`.

##### `deleteBlog`
- **Signature**: `deleteBlog(id: string): Promise<BlogActionResult>`
- **Purpose**: Deletes a post owned by the caller, only if it's `DRAFT` or `REJECTED`.
- **Auth/role**: Requires authenticated session; ownership + status check.
- **Side effects**: `blog_posts.delete`; `revalidatePath("/blogs/my-blogs")`.

##### `getMyBlogs`
- **Signature**: `getMyBlogs(): Promise<MyBlogItem[]>`
- **Purpose**: Lists all posts authored by the caller (any status), most-recently-updated first, with a primary category.
- **Auth/role**: Requires authenticated session; returns `[]` if not logged in.
- **Side effects**: Read-only.

##### `getBlogForEdit`
- **Signature**: `getBlogForEdit(id: string): Promise<BlogForEdit | null>`
- **Purpose**: Loads a single post (owned by caller, `DRAFT`/`REJECTED` only) for the editor — returns `null` otherwise.
- **Auth/role**: Requires authenticated session + ownership + status check.
- **Side effects**: Read-only.

##### `getBlogCategories`
- **Signature**: `getBlogCategories(): Promise<BlogCategory[]>`
- **Purpose**: Lists active blog categories, ordered by `sort_order`, for the editor's category picker.
- **Auth/role**: None — but only useful to authenticated authors via the editor UI.
- **Side effects**: Read-only.

#### `app/actions/blogs/public.ts` (no `"use server"` — `import "server-only"`, called by public pages)

##### `getPublishedBlogs`
- **Signature**: `getPublishedBlogs(opts?: { categoryId?: number | null; limit?: number; offset?: number }): Promise<{ posts: PublishedBlogItem[]; total: number }>`
- **Purpose**: Paginated listing of `PUBLISHED` blog posts, optionally filtered by category, ordered by `published_at desc`.
- **Auth/role**: None — public.
- **Side effects**: Read-only.

##### `getPublishedBlogBySlug`
- **Signature**: `getPublishedBlogBySlug(slug: string): Promise<PublishedBlogDetail | null>`
- **Purpose**: Loads a single published post by slug and renders its Tiptap JSON content to HTML (`tiptapToHtml`) for the blog detail page.
- **Auth/role**: None — public.
- **Side effects**: Read-only (HTML rendering is pure/CPU-only).

##### `getRelatedBlogs`
- **Signature**: `getRelatedBlogs(currentId: string, categoryName: string | null, limit?: number): Promise<PublishedBlogItem[]>`
- **Purpose**: Returns up to `limit` published posts in the same category (excluding the current post), padding with the latest published posts if not enough same-category matches exist.
- **Auth/role**: None — public.
- **Side effects**: Read-only.

##### `getPublicBlogCategories`
- **Signature**: `getPublicBlogCategories(): Promise<PublicBlogCategory[]>`
- **Purpose**: Lists active blog categories (id, name, slug) for public category navigation/filters.
- **Auth/role**: None — public.
- **Side effects**: Read-only.

---

### Destinations & Regions (`app/actions/destinations/*`, `app/actions/regions/*`)

#### `app/actions/destinations/fetch-destination-page.ts` — `"use server"` (public)

##### `fetchActiveDestinations`
- **Signature**: `fetchActiveDestinations(excludeCountry = "India", limit = 12): Promise<ActiveDestinationItem[]>`
- **Purpose**: Lists active, non-deleted destinations outside `excludeCountry` (default excludes India) with active package counts — for the home page's "Beyond Borders" section. Filters out entries with no resolvable image.
- **Auth/role**: None — public.
- **Side effects**: Read-only; resolves thumbnail via `imgUrl` (R2 public URL helper).

##### `fetchDestinationBySlug`
- **Signature**: `fetchDestinationBySlug(slug: string): Promise<DestinationMeta | null>`
- **Purpose**: Loads a destination's display metadata (name, description, cover/thumbnail images, SEO meta, region) by slug, for the destination landing page. Cover falls back to thumbnail if unset; region is `null` if inactive/deleted.
- **Auth/role**: None — public; only `is_active && !is_deleted` destinations returned.
- **Side effects**: Read-only.

##### `fetchDestinationPackages`
- **Signature**: `fetchDestinationPackages(destinationId: number, page = 1, pageSize = 9): Promise<DestinationPackagesPage>`
- **Purpose**: Offset-paginated listing of active packages for a destination (1-based page, max page size 48), shaped via `shapePackageCards` for the infinite-scroll package list.
- **Auth/role**: None — public.
- **Side effects**: Read-only.

#### `app/actions/regions/fetch-region-page.ts` — `"use server"` (public)

##### `fetchRegionBySlug`
- **Signature**: `fetchRegionBySlug(slug: string): Promise<RegionMeta | null>`
- **Purpose**: Loads a custom region's display metadata (name, description, cover/thumbnail, SEO meta) by slug, for the region landing page.
- **Auth/role**: None — public; only `is_active && !is_deleted` regions returned.
- **Side effects**: Read-only.

##### `fetchActiveRegions`
- **Signature**: `fetchActiveRegions(country = "India", limit = 12): Promise<ActiveRegionItem[]>`
- **Purpose**: Lists active, non-deleted regions for a country, with the sum of active package counts across all destinations in each region — for home page region cards.
- **Auth/role**: None — public.
- **Side effects**: Read-only (two queries: regions, then destinations grouped by `region_id`).

##### `fetchRegionPackages`
- **Signature**: `fetchRegionPackages(regionId: number, page = 1, pageSize = 9): Promise<RegionPackagesPage>`
- **Purpose**: Offset-paginated listing of active packages whose destination belongs to the given region (1-based page, max page size 48), shaped via `shapePackageCards`.
- **Auth/role**: None — public.
- **Side effects**: Read-only.

---

### Search (`app/actions/search/*`)

#### `app/actions/search/search-packages.ts` — `"use server"` (public)

##### `matchDestinationIds` *(internal helper, not exported — listed for context)*
Resolves a selected `Location` id to matching `destinations` by intersecting `{id, state_id}` key sets, so a city-level location selection matches a state-level destination.

##### `searchPackages`
- **Signature**: `searchPackages(params: SearchParams): Promise<SearchResult>` where `SearchParams = { toLocationId?: string; adults: number; childAges: number[]; travelDate?: string | null; limit?: number }`
- **Purpose**: Main package search/listing — without `toLocationId` returns all active packages (the `/packages` listing); with it, matches destinations via location hierarchy (`matchDestinationIds`) and filters packages to those destinations. For each result, computes per-adult/total pricing (via `computePackagePrice`) at the given occupancy, plus a deterministic "fake MRP" strikethrough price (`fakeOriginalPrice`, mirrors `PricingCard`). Packages without a duration/route/stay or images, or that return no destination matches, are excluded.
- **Auth/role**: None — public.
- **Side effects**: Read-only; per-package `computePackagePrice` calls (failures set `missingPricing: true` rather than throwing).

---

### Enquiry (`app/actions/enquiry/*`)

#### `app/actions/enquiry/schema.ts` — Types/Schemas
Plain Zod module. `enquirySchema` validates a contact-enquiry form: `name` (2–100 chars), optional `email` (valid email or empty string), `phone` (7–15 chars, regex-validated international format), and optional `packageName`/`packageUrl`/`pageUrl` (URL) context fields for attributing the enquiry to a specific page/package. Exports `EnquiryInput` (z.input) and `EnquiryErrors` (field-error map).

#### `app/actions/enquiry/submit.ts` — `"use server"` (public)

##### `submitPackageEnquiry`
- **Signature**: `submitPackageEnquiry(raw: EnquiryInput): Promise<{ok:true} | {ok:false; fieldErrors: EnquiryErrors} | {ok:false; formError: string}>`
- **Purpose**: Validates and persists a public "enquire about this package" form submission as a `package_queries` lead row (`source: "WEBSITE_FORM"`, `status: "SUBMITTED"`) for the sales/dashboard team to follow up.
- **Auth/role**: None — public, anonymous.
- **Side effects**: `package_queries.create`. Returns a generic `formError` on any DB failure rather than throwing.

---

### Fulfillment (`app/actions/fulfillment.actions.ts`)

##### `chooseReplacement`
- **Signature**: `chooseReplacement(offerId: string, optionId: string): Promise<{success:true} | {success:false; error:string}>`
- **Purpose**: Lets a customer pick one of the ops-proposed alternatives for an unavailable itinerary item (hotel/activity/transfer) during post-booking status tracking. Applies the chosen swap directly to the corresponding fulfilment row (`bookingHotel`/`bookingActivity`/`bookingCab`), setting it to `IN_PROCESS` for ops to reconfirm, and marks the `replacementOffer` as `CHOSEN`. No price change in v1 — the decision is locked once made.
- **Auth/role**: Requires authenticated user (`getAuthenticatedUser()`); the offer's booking must belong to the caller (`offer.booking.userId === user.id`); offer must currently be `PROPOSED` (one-shot — already-chosen offers are rejected); the selected `optionId` must exist among the offer's stored `options`.
- **Side effects**: DB write to the relevant fulfilment table (`bookingHotel.update` / `bookingActivity.update` / `bookingCab.update`) resetting confirmation/voucher fields; `replacementOffer.update` (status=CHOSEN, chosenOptionId, chosenAt); `bookingTimeline.create` (audit note, attributed to a system actor via `getSystemActorId()`); `revalidatePath("/bookings/${bookingId}/status")` and `revalidatePath("/dashboard/package-bookings/${bookingId}")`.
