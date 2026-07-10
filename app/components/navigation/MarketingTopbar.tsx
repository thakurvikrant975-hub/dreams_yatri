"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { BuildingOffice2Icon } from "@heroicons/react/24/solid";

const DISMISS_KEY = "dy_list_property_topbar_dismissed";

/**
 * Promo bar for hotel/homestay owners, shown above the main site Header.
 * Rendered inside Header.tsx itself (not per-page) so every page that
 * renders <Header> gets it automatically, with one place to change or
 * remove it later. Deliberately not sticky — scrolls away with the page,
 * leaving the header's own sticky behavior untouched.
 */
export default function MarketingTopbar() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  // Avoid a hydration mismatch — decide only after mount, since the
  // dismissed state depends on localStorage (server can't know it).
  if (!mounted || dismissed) return null;

  return (
    <div className="relative bg-white bg-linear-to-r from-red-400 via-red-600/80 to-red-600/90 text-white">
      <div className="screen-space flex items-center justify-center gap-2 sm:gap-3 py-2 pr-8 text-xs sm:text-sm font-medium text-center">
        <BuildingOffice2Icon className="hidden sm:block w-4 h-4 shrink-0" />
        <span className="truncate">
          <span className="sm:hidden">List your property for free</span>
          <span className="hidden sm:inline">
            List your property for free — join thousands of hosts earning with DreamsYatri.
          </span>
        </span>
        <Link
          href="/hotel-connect/signup"
          className="shrink-0 inline-flex items-center gap-1 rounded-full text-primary-600 bg-white  hover:bg-primary-100 px-3 py-1 font-semibold transition-colors"
        >
          List Your Property →
        </Link>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-1 rounded-full  hover:bg-white/15 transition-colors"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
