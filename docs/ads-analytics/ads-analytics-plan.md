# Dreams Yatri — Google Ads Integration & Lead Analytics (Phased Plan)

The roadmap for connecting the **Google Ads API** directly to our own database, so that ad
spend, leads, and real bookings sit in one place and can be reported on together. Meta comes
later on the same skeleton.

The goal is not a prettier version of the Google Ads UI. Google already shows cost, clicks
and its own "conversions". What Google **cannot** show is what happens after the form is
submitted — whether the lead was junk, whether a sales exec closed it, and how much margin it
produced. We have that half in `package_queries` and `Booking`. Nobody else does. This
project is about joining the two halves.

Built in independent steps — each ships value on its own and is a prerequisite for the next.
The write-back to Google (Step 9) is deliberately **last**: it changes how live campaigns
bid, and it should only run on data we have already proven correct.

---

## What this system must answer

1. Which **account → campaign → ad group** produced how many leads, at what cost per lead?
2. What budget is assigned, how much was actually spent, on what day and hour?
3. How many of those leads survive verification, and how many turn into real bookings?
4. What is the **margin** ROAS per campaign — not gross booking value, margin?
5. Which ad groups buy **junk** — leads that get rejected or never answer?

Question 5 is the one with the fastest payback, and the one no Google-side dashboard can ever
answer.

---

## Guiding principles (apply to every step)

1. **Google owns cost. We own outcomes.** Cost, impressions and clicks come from the API.
   Leads, bookings and revenue come from our database. Google's own `conversions` column is
   never mixed into CPL or ROAS math — different attribution model, modelled conversions, and
   click-date reporting mean the two will never reconcile, and a dashboard nobody trusts is
   worse than no dashboard.
2. **Attribution is captured at write time, never inferred later.** The campaign and ad group
   IDs land on the lead row the moment the lead is created. Resolving them afterwards through
   the API is possible for 90 days only and not for every campaign type.
3. **Nothing we build may put a live landing page at risk.** The `.com` landing pages are
   ranked and are the destination of paid campaigns. Instrumentation is additive and
   out-of-band; it never edits page markup, forms, or URLs.
4. **Ad data is never final.** Google restates cost and conversions retroactively. Every sync
   re-reads a rolling window and upserts. A day's row is updated, never inserted once.
5. **The account's timezone is the truth.** Google reports in the ad account's timezone, and
   report dates are stored as dates, not timestamps. This is where the off-by-one-day bug
   lives.
6. **Everything observable.** Every sync run is logged with rows touched and errors. A
   silently failing sync looks exactly like "we spent nothing".

---

## Current state (baseline)

- ✅ `Booking.sourceQueryId` is unique — lead → client → revenue is a clean one-hop join, with
  `totalAmount`, `marginAmount`, `paidAmount` already on the booking.
- ✅ `package_queries` carries `gclid`, `utmSource/Medium/Campaign`, `pageUrl`.
- ✅ [`dy_capture.php`](<../../integrations/dreamsyatri-com/dy_capture.php>) captures
  `gclid` / `gbraid` / `wbraid` on the `.com` PHP site, with a 30-day first-touch cookie.
- ✅ `LandingPage` stores `googleAdsSendToForm` / `Call` / `Whatsapp`, so client-side gtag
  conversions already fire on `.in` landing pages.
- ✅ MCC (manager) account exists. Developer token likely already issued — access level needs
  confirming in API Center.
- 🟡 The `gclid` column collapses three different click-id types into one. Fine for reporting,
  wrong for the Step 9 write-back, which needs to know which of the three it was.
- ❌ **No campaign or ad group is recorded on any lead.** We know a lead came from Google; we
  cannot say from which campaign, let alone which ad group.
- ❌ **The `.in` site captures no attribution at all.** [`enquiry/schema.ts`](<../../app/actions/enquiry/schema.ts>)
  has no `gclid` or `utm` fields, and [`LeadForm.tsx`](<../../app/(website)/offers/[slug]/LeadForm.tsx>)
  sends none — so every lead from our own `/offers/[slug]` landing pages arrives with
  `gclid = null`. On [`lead-report/actions.ts`](<../../app/(dashboard)/dashboard/(main)/lead-report/actions.ts>)
  the rule is `if (q.gclid?.trim()) return "GOOGLE"`, so those leads are **not even counted as
  Google today**. This is a live attribution hole, independent of this project.
- ❌ No mirror of accounts, campaigns, ad groups, budgets or spend in our database.

---

## What the Google Ads API actually gives us

Current version is **v25** (July 2026; v25.1 in August). Google ships roughly four major
versions a year and sunsets old ones, so a version bump every 9–12 months is the standing
maintenance cost of this integration.

**Structure and spend** — everything the plan needs:

| Resource | Gives us |
|---|---|
| `customer_client` | every account under the MCC, in one query |
| `campaign` | name, status, channel type, bidding strategy, dates |
| `ad_group` | name, status, type |
| `ad_group_ad` | individual ads / creatives |
| `campaign_budget` | `amount_micros`, `delivery_method`, `explicitly_shared`, `period` |
| `asset_group` | the Performance Max equivalent of ad groups |
| `change_event` | budget/bid edits — **last 30 days only**, so it must be captured nightly |

**Money arrives in micros** — divide `cost_micros` by 1,000,000 for rupees. Stored as integer
micros, converted only at the display edge. Never a float.

**Budget vs spend.** Assigned is `campaign_budget.amount_micros`; used is `metrics.cost_micros`
segmented by `segments.date`. Note that a daily budget is **not** a hard cap — Google may
spend up to 2× on any given day, capped at about 30.4× the daily budget across the month. The
dashboard must compare against the monthly envelope or it will report false overspend every
week.

`metrics.search_budget_lost_impression_share` is the metric that turns "we spent the budget"
into "raise this budget" — the share of impressions lost purely to the budget running out.

**Hourly** — `segments.hour` alongside `segments.date` works at campaign level. Ad-group
hourly is inconsistently supported; each field's `selectable_with` list is authoritative. We
store **hourly at campaign level, daily at ad group and ad level** — hourly ad-group data is
24× the rows for insight nobody acts on.

**Known limits, all confirmed:**

- `click_view` (gclid → ad group) reaches back **90 days only**, each query must filter to a
  **single day**, and it does not reliably return click ids for App or Performance Max.
  Usable as a backfill, never as the primary mechanism.
- Performance Max has **no ad groups** — asset groups instead, and `asset_group` does not
  support metrics directly (go through `asset_group_product_group_view`). `{keyword}` and
  `{adgroupid}` come back blank for PMax and DSA.
- Offline conversion upload requires the click to be **≤ 90 days old**, a conversion action of
  type `UPLOAD_CLICKS` with status `ENABLED`, and both value and currency. Custom variables
  do not work with `gbraid` / `wbraid`.

**Access levels belong to the Google Cloud project** — since **2026-09-09**. Before that
they belonged to the developer token (API Center on the manager account); Google carried
them over only to Cloud projects that had made API calls in the previous 90 days, re-linking
a token to another project is no longer possible, and the `developer-token` header is now
*optional and ignored*. A project starts at **Test** — which cannot read production accounts
(`CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION`) — and applies for more on its **Google Ads API
page in the Cloud console**, reviewed automatically. **Explorer** (2,880 production
operations/day) is enough for us — a handful of accounts uses perhaps 20–50 a day. Basic
(15,000/day) and Standard (unlimited) are for heavier tools.

**Auth is a service account**, added as a read-only user on the MCC (Admin → Access and
security). Google Ads accepts this directly now, with no Workspace delegation, and it suits an
unattended sync far better than a person's OAuth refresh token — which dies with a password
change, a departure, or after seven days for an OAuth app left in "testing". With an MCC,
every call also passes `login-customer-id` = the MCC id.

---

## The join

```
Google Ads API                          Our database
──────────────                          ────────────
account                                 package_queries
  └── campaign      ─── adsCampaignId ────┤   (the lead: status, verified,
        └── ad group ── adsAdGroupId  ────┤    rejection reason, exec)
              └── ad ── adsCreativeId ────┘        │
                                                   │ Booking.sourceQueryId (unique)
  daily / hourly cost ─────────────────────────────┤
                                                   ▼
                                          Booking.marginAmount
```

The whole project rests on the middle column existing. It does not today, which is why
**Step 1 is the only step that cannot be deferred** — `click_view` gives 90 days of history
and nothing more, so every month without it is a month of attribution that can never be
reconstructed.

---

## Step 0 — Google Ads access & auth handshake  🟡 IN PROGRESS

Nothing from Step 3 onward works without it. Independent of Step 1.

1. ✅ The MCC covers every ad account — one credential.
2. 🟡 The developer token shows **Explorer**, but that no longer counts: our project
   `dreams-yatri-ads-api` had never called the API, so it inherited nothing on 2026-09-09
   and is at Test. **Apply for Explorer on the project's Google Ads API page** (automated
   review).
3. In the Google Cloud project the token belongs to (Google Ads API enabled there): **IAM &
   Admin → Service Accounts → create** `dy-ads-sync`, no Cloud roles; **Keys → JSON**.
4. Google Ads **MCC → Admin → Access and security → Users → +** → the service account's
   email, **Read only**. (Standard access is needed only for Step 9's uploads.)
5. Secrets, in `.env.local` locally and in Vercel for Step 5:
   `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC, digits) and
   `GOOGLE_ADS_SERVICE_ACCOUNT` — the JSON key **base64-encoded onto one line**, because its
   multi-line private key is exactly what `.env` parsers and dashboards mangle:
   `base64 -i key.json | tr -d '\n'`.

Code: [`app/lib/ads/google/auth.ts`](<../../app/lib/ads/google/auth.ts>) signs the service
account's JWT with `node:crypto` and trades it for an hour's bearer token;
[`client.ts`](<../../app/lib/ads/google/client.ts>) runs GAQL over REST `searchStream`.

**Done when:** `npm run test:google-ads` prints our real customer ids and names.

---

## Step 1 — Capture campaign / ad group on the lead  *(foundation)*  ✅ COMPLETE

**Shipped 2026-09-11** — 1a migrated in dev and prod; 1b live on Vercel; 1c live on
Hostinger; 1d suffix set in Google Ads. Verified end to end with a test lead on each site,
and real Google leads now arrive with `adsPlatform`, click id and type.

**Found in production — `gad_campaignid`.** Google's auto-tagging now appends
`gad_campaignid` (and `gad_source`) to *every* ad click beside the gclid, suffix or not. Both
parsers read it when the suffix's `campaignid` is absent, so campaign-level attribution never
depended on 1d, covers any campaign the suffix doesn't reach, and — because landing URLs are
stored in `pageUrl` — can be backfilled for past leads from the database alone. Ad group,
creative and keyword still come only from the suffix.

The only step that touches the websites, and the only one whose delay costs data permanently.
Needs no API access — it can run entirely in parallel with Step 0.

There are **two capture surfaces** and they must both be covered:

| Surface | Today | Needs |
|---|---|---|
| `dreamsyatri.com` (PHP + static HTML) | captures `gclid` | extend the existing hook |
| `dreamsyatri.in` (this Next.js app) | captures **nothing** | the whole chain |

### 1a — Migration (first; migrations ship before code)

New columns on `package_queries`, all nullable, no backfill:

| Column | Type | Source |
|---|---|---|
| `adsPlatform` | VarChar(16) | `"GOOGLE"`, later `"META"` |
| `adsCampaignId` | VarChar(32) | `{campaignid}` |
| `adsAdGroupId` | VarChar(32) | `{adgroupid}` |
| `adsCreativeId` | VarChar(32) | `{creative}` |
| `adsKeyword` | VarChar(255) | `{keyword}` |
| `adsMatchType` | VarChar(16) | `{matchtype}` |
| `adsNetwork` | VarChar(16) | `{network}` |
| `adsDevice` | VarChar(16) | `{device}` |
| `adsTargetId` | VarChar(64) | `{targetid}` |
| `adsClickId` | VarChar(255) | gclid / gbraid / wbraid value |
| `adsClickIdType` | VarChar(16) | which of the three it was |
| `adsClickAt` | DateTime? | first-touch time |

Indexes: `[adsCampaignId, createdAt]`, `[adsAdGroupId, createdAt]`, `[adsClickId]` (the last
for Step 9 lookups).

Two decisions fixed here:

- **Ad ids are `VarChar`, not `BigInt`** — they arrive as URL text, are never summed, and
  intake must never throw on a malformed value. The Step 2 mirror tables use `VarChar` for the
  same ids so the join needs no casting.
- **The existing `gclid` column stays and keeps being written.** The lead report and the query
  detail sheet both read it. Everything here is additive; no existing behaviour changes.

Applied against the **direct (non-pooler) Neon endpoint**.

### 1b — Next.js changes (5 files)

1. [`enquiry/schema.ts`](<../../app/actions/enquiry/schema.ts>) — add the ad fields *and* the
   missing `gclid` / `utm*` to `enquirySchema`.
2. [`intake.service.ts`](<../../app/actions/enquiry/intake.service.ts>) — three edits: the
   `IntakeInput` type, the destructure, the `create` data block.
3. [`api/leads/external/schema.ts`](<../../app/api/leads/external/schema.ts>) — same fields via
   the existing `optionalText()` helper.
4. [`api/leads/external/route.ts`](<../../app/api/leads/external/route.ts>) — pass through in
   the `createLead({...})` call.
5. The public forms — [`offers/[slug]/LeadForm.tsx`](<../../app/(website)/offers/[slug]/LeadForm.tsx>)
   plus the two package-page enquiry forms.

Capture lives in **one shared hook**, not inline per form. Today it serves three forms; when a
`.com` landing page is eventually rebuilt on `.in` it inherits attribution automatically, with
no chance of a rebuilt page silently losing it. The hook reads `location.search` on mount,
persists to `localStorage` with a 30-day TTL, and falls back to the stored copy — mirroring
what the PHP cookie already does, so a visitor who browses before submitting is still
attributed.

### 1c — PHP hook (3 edits, one file)

In [`dy_capture.php`](<../../integrations/dreamsyatri-com/dy_capture.php>):

1. `dy_detect_attribution()` — read the eight ValueTrack params, and split the click id into
   value + type instead of collapsing three into one. This is the right insertion point: the
   array it returns feeds **both** the cookie path and the referrer-fallback path, so both
   gain the fields for free.
2. `dy_attrib_to_api()` — map the new keys into the outbound payload.
3. The `dy_sync_lead([...])` payload — add the fields alongside `gclid`.

⚠️ **The 30-day cookie is already in the wild.** Existing `dy_attrib` cookies carry the old
array shape with no ad-id keys, so every read must be null-safe. Leads from returning visitors
will have blank ad ids for up to 30 days after deploy — expected, self-healing, not a bug to
chase.

⚠️ **Deploy is manual.** This file lives at `/home/u329953352/dy_lead_bridge/` on Hostinger,
outside the repo's deploy path — so it is an SSH upload, linted on the server and swapped in
with an atomic rename (see the integration README). The hook is wired by a `php_value` line in
`~/domains/dreamsyatri.com/public_html/.htaccess`, not `.user.ini`, which this LiteSpeed server
ignores. SSH access is the one hard prerequisite in Step 1.

### 1d — Google Ads UI

Set an account-level **final URL suffix**:

```
campaignid={campaignid}&adgroupid={adgroupid}&creative={creative}&keyword={keyword}&matchtype={matchtype}&network={network}&device={device}&targetid={targetid}
```

No `utm_*` in it (the first draft had `utm_source=google&utm_medium=cpc`): the .com bridge
already labels Google leads google / cpc, and manual utm tags beside auto-tagging can change
how Google Analytics attributes the traffic. The **tracking template stays empty** — it is for
routing clicks through a third-party tracker, and anything wrong in it breaks every click.
A campaign- or ad-group-level suffix *replaces* the account one for its ads rather than adding
to it.

A **final URL suffix, never a tracking template or a final-URL edit.** Under Upgraded URLs the
tracking portion is deliberately separated from the landing page portion so that changing it
does **not** trigger editorial review. Editing an ad's actual final URL does the opposite: it
produces a **new ad id**, the old ad's stats stay orphaned under the old id with no way to
link them, and serving pauses for review. That distinction is the whole reason this step is
safe to run on live campaigns.

⚠️ Check that the landing page URLs do not redirect (www → non-www, http → https, trailing
slash). A redirect that drops the query string kills this silently, and it would only surface
weeks later as blank ad ids.

**Order:** `1a → 1b → 1c → 1d`. The suffix goes last, so the first tagged click already has
somewhere to land.

**Done when:** hitting a `.com` landing page *and* a `.in` `/offers/` page with
`?gclid=TEST123&campaignid=111&adgroupid=222&creative=333&keyword=kerala+packages&matchtype=e&network=g&device=m`
produces `package_queries` rows with the new columns filled, `gclid` and `utmSource` still
populated as before, and the lead report unchanged. Asserted by
`scripts/test-ads-attribution.ts` behind `npm run test:ads-attrib`.

**Depends on:** nothing. **Unblocks:** every report in Steps 6–9.

---

## Step 2 — Schema for the ads mirror

One migration: `ads_account`, `ads_campaign`, `ads_ad_group`, `ads_ad`, `ads_campaign_budget`,
`ads_campaign_budget_history`, `ads_daily_stats`, `ads_hourly_stats`, `ads_sync_run`.

Four decisions that are expensive to change later:

- **Money as `BigInt` micros**, converted at the display edge only.
- **Report date as `@db.Date`**, never a timestamp — see principle 5.
- **Google's own ids are the keys** (as `VarChar`, per Step 1a), which makes every upsert
  idempotent.
- **Soft delete via `lastSeenAt`** — a removed campaign must stay for history.

`ads_campaign_budget_history` exists because the API exposes only the *current* budget, and
every report needs "what was the budget on 12 August".

---

## Step 3 — Client + structure sync

**Call the REST API with plain `fetch`** rather than adding a gRPC client library. GAQL over
`POST /v25/customers/{id}/googleAds:searchStream` is JSON in, JSON out; `lib/` currently holds
one file, the official clients are heavy for Vercel functions, and this avoids being pinned to
a third party's release cadence when Google bumps versions. The cost is ~80 lines of client
code we own.

- `app/actions/ads/google/client.ts` — token refresh + GAQL execution
- `app/actions/ads/google/sync-structure.service.ts` — `customer_client` → `campaign` →
  `ad_group` → `ad_group_ad` → `campaign_budget`
- `npm run ads:sync-structure`

**Done when:** campaign and ad-group counts match the Google Ads UI exactly.

---

## Step 4 — Stats sync

`sync-stats.service.ts`, with a **rolling lookback** (default 30 days, overridable) that
re-upserts rather than inserting — see principle 4.

- Daily at account / campaign / ad group / ad level: cost, impressions, clicks, conversions,
  conversionsValue, `search_budget_lost_impression_share`
- Hourly at **campaign level only**
- Budget snapshot into `ads_campaign_budget_history` on every run

**Done when:** last-7-days cost per campaign reconciles against the Google Ads UI within
rounding.

---

## Step 5 — Cron

`app/api/cron/sync-google-ads/route.ts`, guarded by `isAuthorizedCron` like every other job in
[`app/api/cron/`](<../../app/api/cron/>), registered in [`vercel.json`](../../vercel.json).
Runs ~02:00 IST so the previous IST day is closed. Writes an `ads_sync_run` row every time —
started, finished, rows touched, error.

---

## Step 6 — The join layer & metric definitions

A service joining `ads_daily_stats` ↔ `package_queries` (via `adsCampaignId` / `adsAdGroupId`)
↔ `Booking` (via `sourceQueryId`). Definitions are fixed here, in one place, before any UI is
written:

| Metric | Definition |
|---|---|
| CPL | ad cost ÷ leads |
| Cost per **verified** lead | ad cost ÷ leads with `verified = true` |
| Junk rate | rejected leads ÷ total leads, per ad group |
| Cost per booking | ad cost ÷ bookings via `sourceQueryId` |
| Margin ROAS | `SUM(Booking.marginAmount)` ÷ ad cost |

**Date convention** is chosen per report and labelled in the UI: Google reports a conversion
on the *click's* date, we record a lead on its *submission* date. Efficiency reports read by
click date; sales and ops reports by lead date.

**Conversion lag** must be visible. A lead that clicks today and books in 45 days makes today's
ROAS look terrible for six weeks — without a cohort-maturity indicator the sales team will
kill campaigns that are working.

---

## Step 7 — Dashboard

A new route under [`(marketing)`](<../../app/(dashboard)/dashboard/(main)/(marketing)/>),
reusing the `lead-report` patterns and its [`ist.ts`](<../../app/(dashboard)/dashboard/(main)/lead-report/ist.ts>)
helpers. Account → campaign → ad group drill-down, budget pacing against the *monthly*
envelope, the `QueryStatus` funnel, and junk rate by ad group.

---

## Step 8 — Backfill  *(optional, time-boxed)*

`click_view` resolution of existing `gclid`s — one query per day, last 90 days only. Skip it if
Step 7 is more urgent; it buys history, not capability.

---

## Step 9 — Offline conversion import  *(write-back — separate sign-off)*

Push *verified lead* / *package sent* / *booked with margin* back to Google as `UPLOAD_CLICKS`
conversion actions, so Smart Bidding optimises for leads that **book** rather than leads that
merely submit. This is where the compounding return is.

- Requires a dry-run mode. It writes to the live ad account.
- Requires `adsClickIdType` from Step 1a to be correct.
- Travel bookings often close beyond the 90-day window, so upload an **intermediate** event
  inside it (verified / package sent, value-weighted) rather than waiting for the booking.
- Keep the existing gtag `send_to` conversions, but as **separate conversion actions** with
  only one marked primary for bidding — otherwise everything double-counts.

**Gated on:** Steps 1–6 live for a month with numbers reconciling against the Google Ads UI.

---

## Step 10 — Meta

Same skeleton: account → campaign → adset → ad, `fbclid` plus `ctwa_clid` for click-to-WhatsApp,
Conversions API for the write-back. Started only once Google is stable and boring.

---

## The `.com` → `.in` migration, and why it does not block this

The `.com` landing pages are ranked and are live ad destinations, so changing them is a
revenue risk. That risk is real, but it does not touch this project, and this project is what
makes the migration safe.

**Step 1 has zero blast radius on `.com`.** 1c edits `dy_capture.php`, which is wired in as
`auto_prepend_file` — no page markup, no forms, no URLs, and rollback is deleting one line
from the site's `.htaccess`. 1d sets a tracking suffix, which by design does not trigger ad
review.

**What actually causes ad losses in a landing page migration:**

1. Changing an ad's final URL → new ad id, orphaned stats, editorial review pauses serving.
2. A gap in conversion tracking → Smart Bidding starves. Fatal, and usually silent for days.
3. Landing page experience drops Quality Score → higher CPCs.
4. Redirects that drop the query string → attribution dies while spend continues.

**The approach when the time comes:**

- **Keep every path byte-identical and rewrite, never redirect.** `dreamsyatri.com/kerala-monsoon-packages/`
  stays exactly that. Put the domain behind an edge router that serves some paths from Next.js
  and the rest from the legacy PHP host — a strangler fig. The ad's final URL never changes,
  so cause (1) never fires and rollback is one routing rule.
- **Migrate one page at a time, lowest ad spend first.** Prove the pipeline where a mistake
  costs ₹500.
- **Never cut over cold — use a Google Ads custom experiment.** It splits eligible auctions
  between the original and the variant over the same period, giving a real read on CPL and
  conversion rate. Promote only when the new page wins or ties.
- **Conversion parity is a hard gate.** The `.in` platform already stores `googleAdsSendToForm`
  / `Call` / `Whatsapp` per landing page, so a rebuilt page can fire the *same* conversion
  actions. Verify with Tag Assistant before it takes a single click.

**Why we instrument first.** After Steps 1–5 we have cost, leads, bookings and margin per
campaign, ad group and landing page. That gives the migration a **baseline** (so a regression
shows in days, not at month-end), the **spend ranking** that dictates a safe migration order,
and the **verdict** on each experiment measured in bookings rather than form fires. Migrating
first and instrumenting second means making the riskiest change to a revenue system with no
instrument on it.

One opinion, recorded deliberately: rebuilding `.com` on Next.js is a developer-experience
win, not a revenue win. Those pages are ranked and converting. Migrate page by page where a
*specific* page has a business reason — it is slow, it converts badly, it needs something the
PHP cannot do — and never as a big-bang "modernise the stack" project. The `auto_prepend_file`
hook already feeds the legacy pages into the same database and the same sales queue, so there
is no data reason to hurry.

---

## Open decisions

- **Campaign mix.** Search vs Performance Max changes what Step 4 can store — PMax has no ad
  groups and returns blank `{adgroupid}` / `{keyword}`.
- **SSH/FTP access to the Hostinger box** — the one hard prerequisite for 1c.
- **Developer token access level** — Basic already, or a 5-day application?

---

## Reference

- [Release notes](https://developers.google.com/google-ads/api/docs/release-notes) ·
  [Access levels](https://developers.google.com/google-ads/api/docs/access-levels) ·
  [Upload click conversions](https://developers.google.com/google-ads/api/docs/conversions/upload-clicks)
- [ValueTrack parameters](https://support.google.com/google-ads/answer/6305348) ·
  [Segmentation](https://developers.google.com/google-ads/api/docs/reporting/segmentation) ·
  [PMax asset group reporting](https://developers.google.com/google-ads/api/performance-max/asset-group-reporting)
- Related internal docs: [`dashboard/marketing.md`](../dashboard/marketing.md),
  [`dashboard/analytics-and-reports.md`](../dashboard/analytics-and-reports.md),
  [`dreamsyatri-com/README.md`](<../../integrations/dreamsyatri-com/README.md>)

Per-step docs (`step1-attribution-capture.md`, …) are written as each step ships, following
the `channel-management/` convention.
