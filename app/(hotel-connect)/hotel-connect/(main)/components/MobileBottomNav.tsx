"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  BuildingOffice2Icon,
  TableCellsIcon,
  CalendarDaysIcon,
  Bars3Icon,
} from "@heroicons/react/24/solid";
import { cn } from "@/app/lib/utils";
import { useMobileNav } from "./MobileNavContext";
import { resolveActiveHref, type NavItem } from "./ConnectSidebar";

// Only the most-used destinations get a permanent tab — everything else
// (Revenue, Reviews, Group Inbox, Sign out) lives behind "More", which opens
// the same drawer as the header's hamburger button.
const TABS: NavItem[] = [
  { href: "/hotel-connect",            label: "Home",       icon: HomeIcon, exact: true },
  { href: "/hotel-connect/properties", label: "Properties", icon: BuildingOffice2Icon },
  {
    href: "/hotel-connect/calendar", label: "Rates", icon: TableCellsIcon,
    matchPatterns: [/^\/hotel-connect\/properties\/\d+\/(rates|calendar)(\/|$)/],
  },
  { href: "/hotel-connect/bookings",   label: "Bookings",    icon: CalendarDaysIcon },
];

// Hidden while actively filling out the property wizard on mobile — the
// wizard already has its own bottom nav (Previous / Step X of Y / Save &
// Continue), so stacking this one under it just eats screen space a small
// phone can't spare. Exported so DashboardMain can drop the bottom padding
// it otherwise reserves to keep page content clear of this nav.
export const HIDES_MOBILE_BOTTOM_NAV = /^\/hotel-connect\/properties\/\d+\/edit(\/|$)/;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpen } = useMobileNav();
  const activeHref = resolveActiveHref(pathname, TABS);

  if (HIDES_MOBILE_BOTTOM_NAV.test(pathname)) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-20 h-16 bg-white border-t border-neutral-200 flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-primary-600" : "text-neutral-400"
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-neutral-400"
      >
        <Bars3Icon className="w-5 h-5" />
        More
      </button>
    </nav>
  );
}
