"use client";

import { Bars3Icon } from "@heroicons/react/24/solid";
import { useMobileNav } from "./MobileNavContext";

export default function MobileMenuButton() {
  const { toggle } = useMobileNav();

  return (
    <button
      onClick={toggle}
      className="lg:hidden -ml-1.5 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors shrink-0"
      aria-label="Open menu"
    >
      <Bars3Icon className="w-5 h-5" />
    </button>
  );
}
