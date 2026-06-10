'use client';

// Shared between the page (<PackageScrollReset/>) and the loading skeleton
// (<LoadingScrollReset/>) so both make the identical "did the package change?"
// decision off one source of truth. Module-level → survives the page subtree's
// remounts within an SPA session.
let lastPackageSlug: string | null = null;

/** Pulls the package slug out of `/packages/<slug>/<duration>/<route>/<stay>`. */
export function slugFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  return parts[0] === 'packages' ? parts[1] ?? null : null;
}

/**
 * Jumps to the top of the page only when the package itself changed (slug
 * differs from the last one seen) — i.e. arriving from a package card or a
 * different package. Switching duration / route / stay keeps the same slug and
 * leaves the scroll position alone. Safe to call from both the skeleton and the
 * page; whichever runs first does the scroll, the other becomes a no-op.
 */
export function resetScrollForPackage(slug: string | null): void {
  if (!slug) return;
  if (lastPackageSlug !== slug) {
    window.scrollTo(0, 0);
  }
  lastPackageSlug = slug;
}
