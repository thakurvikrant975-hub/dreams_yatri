'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { resetScrollForPackage, slugFromPath } from './packageScroll';

// Layout effect runs before paint (no skeleton flash at the old scroll
// position); fall back to useEffect on the server to avoid the SSR warning.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Rendered inside loading.tsx. The skeleton shows before the real page mounts,
 * so we reset the scroll here too — but only when the package slug actually
 * changed (shared decision via resetScrollForPackage), so an in-page duration/
 * route/stay change keeps its scroll position. Renders nothing.
 */
export default function LoadingScrollReset() {
  const pathname = usePathname();

  useIsoLayoutEffect(() => {
    resetScrollForPackage(slugFromPath(pathname));
  }, [pathname]);

  return null;
}
