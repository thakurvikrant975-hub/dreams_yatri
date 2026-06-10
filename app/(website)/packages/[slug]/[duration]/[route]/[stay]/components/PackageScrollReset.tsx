'use client';

import { useEffect } from 'react';
import { resetScrollForPackage } from './packageScroll';

/**
 * Scrolls to the top of the page when the *package* changes (slug change),
 * e.g. arriving from a package card or a different package. Switching duration,
 * route, or stay category keeps the same slug, so the scroll position is left
 * untouched — it feels like staying within the same package.
 *
 * Works in tandem with <LoadingScrollReset/> (shown by loading.tsx) which makes
 * the same decision the moment the skeleton appears, so there's no flash of the
 * skeleton at the previous scroll position. Renders nothing.
 */
export default function PackageScrollReset({ slug }: { slug: string }) {
  useEffect(() => {
    resetScrollForPackage(slug);
  }, [slug]);

  return null;
}
