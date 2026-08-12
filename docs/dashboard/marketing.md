# Marketing — landing pages, blog reviews, coupons

The **Marketing** sidebar group. Lead triage (`/dashboard/queries`) also lives in this group
but belongs to the CRM pipeline and is documented in [`sales-crm.md`](./sales-crm.md).

| Sidebar item | Route | State |
|---|---|---|
| Queries | `/dashboard/queries` | built — see [`sales-crm.md`](./sales-crm.md) |
| Landing pages | `/dashboard/landing-pages` | built |
| Blog Reviews | `/dashboard/blogs` | built |
| Coupons and offers | `/dashboard/coupons` | **placeholder** — the page renders an empty div; there is no coupon model in the schema |
| Email Marketing, References, Reviews, Not Found | — | **nav entries only**; no route exists under `(main)` yet, so they 404 |

---

## 1. Landing Pages — `/dashboard/landing-pages`

Google-Ads-style campaign pages published at **`/offers/[slug]`**. Distinct from both the
`packages` catalog (browsable site pages) and `custom_packages` (per-client quotes): this is
marketing collateral for a single campaign, assembled from catalog packages and/or one-off
cards, with its own lead form that writes back into `package_queries` with
`source = LANDING_PAGE`.

Files: [`(main)/landing-pages/`](<../../app/(dashboard)/dashboard/(main)/landing-pages/>) —
`LandingPagesClient.tsx`, `LandingPageEditorClient.tsx`, `PackageItemsEditor.tsx`,
`ai-prompt.ts`, `actions.ts`.

### Schema

```prisma
model LandingPage {
  id        String @id @default(cuid())
  slug      String @unique          // path segment after /offers/
  title, seoTitle, description, seoDescription
  heroImageUrl  String?             // static fallback only — see below
  heroEyebrow   String?             // small label above the hero title
  heroHeadline  String?             // big hero title override
  destination   String?             // prefills the lead form's destination
  status        LandingPageStatus @default(DRAFT)   // DRAFT | PUBLISHED
  popupDelaySeconds Int @default(15)                // enquiry modal auto-open delay
  contactPhone  String                              // floating Call + WhatsApp buttons
  googleAdsSendToForm     String?                   // gtag send_to per action…
  googleAdsSendToCall     String?
  googleAdsSendToWhatsapp String?
  faqs          Json @default("[]")   // { question, answer }[]
  testimonials  Json @default("[]")   // { authorName, authorRole?, quote, rating? }[]
  createdBy, createdByName
  items         LandingPageItem[]
}

model LandingPageItem {
  landingPageId String
  sortOrder     Int    @default(0)
  packageId     Int?          // links back to a catalog package, or null for a custom card
  title         String
  imageUrl      String
  description   String?       // editorial blurb on the card face
  rating        Float?        // null hides the pill rather than inventing a number
  routeLabel    String?       // "5D / 4N"
  priceLabel    String?       // free text so it can carry "₹16,999/person"
  badgeLabel    String?       // "Best Seller"
  showInHero    Boolean @default(false)   // up to 4 appear in the rotating hero rail
}
```

**Items are snapshots, not joins.** Even when added from the catalog, every field is copied
at add-time — so a landing page never breaks or silently changes if the source package is
edited or deactivated later. `packageId` is kept purely for traceability.

**The hero is built from items.** The public page auto-builds an animated slider from items
marked `showInHero` (max 4); `heroImageUrl` is only the static fallback when none are marked.

The three `googleAdsSendTo*` fields are independent gtag `send_to` values (e.g.
`AW-123456789/AbCdEfGh`) for the form, call and WhatsApp conversions. A blank field simply
fires no conversion for that action.

### Actions

`listLandingPages`, `getLandingPage`, `saveLandingPage` (create/update through one
zod-validated payload: slug regex, FAQs and testimonials capped at 30 each,
`popupDelaySeconds` 0–120), `deleteLandingPage`. Item management:
`addItemFromCatalog(landingPageId, packageId)`, `addCustomItem`, `updateItem`, `removeItem`,
`reorderItems(landingPageId, orderedIds)` — with `nextSortOrder()` appending new items to
the end. `searchCatalogPackages(query)` backs the package picker, and
`listTeamMemberPhones()` populates the contact-phone dropdown from the team roster.

Every save revalidates both the dashboard routes and the public `/offers/[slug]` page.

### "Generate with AI"

[`ai-prompt.ts`](<../../app/(dashboard)/dashboard/(main)/landing-pages/ai-prompt.ts>) builds
a copy-pasteable prompt for the editor's AI panel. It is a **plain string template, not a
server action** — it never touches the DB; the marketer copies it to ChatGPT and pastes the
JSON back, which `applyAiJson()` parses into the form.

The character limits quoted in the prompt are deliberately **tighter** than the schema's
hard caps (it asks for a ~155-char `seoDescription` where the schema allows 320) so results
aren't truncated in Google search results. `applyAiJson()` still clamps to the schema
maximum as a safety net if the model ignores the instructions.

---

## 2. Blog Reviews — `/dashboard/blogs`

Blog posts are written by **public-site users** (`User`, not `TeamMember`) at
`/blogs/write`; this page is the editorial gate.

```prisma
model blog_posts {
  id, slug @unique, title, excerpt
  content        Json                 // Tiptap document
  cover_image    String?
  status         BlogStatus @default(DRAFT)   // DRAFT PENDING_REVIEW PUBLISHED REJECTED
  rejection_note String?
  read_time      Int?
  published_at   DateTime?
  author_id      String               // → User (public site), cascade delete
  reviewed_by_id String?
  reviewed_at    DateTime?
  categories blog_post_categories[]   // M:N → blog_categories
  tags       blog_post_tags[]         // M:N → blog_tags
}
```

`getAllBlogs({ status, search, page, limit })` — limit capped at 50, ordered
`status asc, updated_at desc` so pending posts float to the top. Search matches the title
and the author's name or email. Each row carries a derived `submitted_at` (the post's
`updated_at`, but only when it is `PENDING_REVIEW`) and a `word_count_est` estimated as
`read_time × 200`. `getBlogStats()` returns total / pending / published / rejected / drafts.

Decisions (`BlogReviewSheet.tsx`):

- `approveBlog(id)` — only from `PENDING_REVIEW`; sets `PUBLISHED`, stamps `published_at`,
  `reviewed_by_id`, `reviewed_at`, and clears any previous `rejection_note`.
- `rejectBlog(id, note)` — only from `PENDING_REVIEW`; a non-empty note is required and is
  shown back to the author so they can revise and resubmit.

Both guard on the current status, so a double-click or a stale tab can't publish a post that
was already decided. `requireAdmin()` gates every action including the reads.

---

## 3. Coupons — `/dashboard/coupons`

The route exists and is reachable from the sidebar, but
[`(marketing)/coupons/page.tsx`](<../../app/(dashboard)/dashboard/(main)/(marketing)/coupons/page.tsx>)
currently renders an empty component. There is no coupon/discount model in
`prisma/schema.prisma` and no discount handling in the booking or quote flow — discounts
today are applied by adjusting a custom package's price during costing review.

Implementing it would need, at minimum: a `coupons` table (code, type, value, validity
window, usage caps, applicability), redemption tracking against `Booking`, and a hook in the
quote/price-lock path so a coupon can't change a price after the quote is signed (see
[`../booking/booking-system.md`](../booking/booking-system.md)).

---

## 4. Gotchas

- Landing-page items never re-read the catalog. Fixing a typo on a catalog package does
  **not** fix it on live landing pages — edit the item.
- `showInHero` beyond 4 items is ignored by the public hero rail.
- Blog authors are public-site `User` rows; blog moderation is the only dashboard feature
  that acts on public-user content.
- Several Marketing nav entries (Email Marketing, References, Reviews, Not Found) have no
  route yet — they are listed in `NAV_GROUPS` and appear in the Sidebar Access editor, so a
  role can be granted access to a page that doesn't exist.
