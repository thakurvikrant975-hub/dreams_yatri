/**
 * Internal, non-customer-facing packages — the live payment-test SKUs seeded by
 * scripts/seed-test-payment-skus.ts.
 *
 * These have to stay `is_active: true`, because the quote page's own fetch
 * (fetchPackagePageData) requires it and there is no separate "bookable" flag on
 * `packages` — one column drives both bookability and discovery. So rather than
 * hiding them with is_active, every *discovery* surface excludes them by slug:
 * the /packages listing, the sitemap/prebuild params, destination and region
 * pages, and the related/recent rails. The result is a package reachable only by
 * someone who already knows its URL.
 *
 * Anything added here must be genuinely internal — this filter silently removes
 * rows from customer-facing queries.
 */
export const INTERNAL_PACKAGE_SLUGS = ["test-payment-package"];

/**
 * Deep clones (scripts/clone-test-skus.ts) are named `test-clone-<source>-<runid>`
 * with a per-run suffix, so they cannot be listed individually above — matching
 * the prefix is what keeps every clone, including ones made later, out of view.
 */
export const INTERNAL_PACKAGE_SLUG_PREFIX = "test-clone-";

/** Spread into a `packages` where-clause to drop internal SKUs from a listing. */
export const NOT_INTERNAL_PACKAGE = {
    slug: { notIn: INTERNAL_PACKAGE_SLUGS, not: { startsWith: INTERNAL_PACKAGE_SLUG_PREFIX } },
};

/**
 * The standard "a customer may see this package" predicate. Prefer this over a
 * bare `is_active: true` in any query that feeds a browse/search/sitemap surface.
 */
export const PUBLIC_PACKAGE = { is_active: true, ...NOT_INTERNAL_PACKAGE };
