"use client";

import { useEffect, useRef } from "react";
import { markPackageViewed } from "@/app/actions/packages/fetch-shared-package";

/** Fires once per page load — records that the client actually opened this
 * itinerary link, without blocking or affecting the render in any way. */
export function ViewTracker({ packageId }: { packageId: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    markPackageViewed(packageId);
  }, [packageId]);

  return null;
}
