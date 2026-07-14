"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  TableCellsIcon,
  CurrencyRupeeIcon,
  StarIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightStartOnRectangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { signOutHotelOwner } from "@/app/lib/auth-hotel-connect-actions";
import DyLogo from "@/app/components/ui/DyLogo";
import { cn } from "@/app/lib/utils";
import { useMobileNav } from "./MobileNavContext";

type HeroIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type NavItem = {
  href: string;
  label: string;
  icon: HeroIcon;
  exact?: boolean;
  // Extra URL patterns that should also light up this item — for pages that
  // live outside this item's own href prefix (e.g. Rates & Inventory's real
  // pages are nested under /properties/[id]/rates and /properties/[id]/calendar,
  // not under this item's own /calendar href).
  matchPatterns?: RegExp[];
};

export const navItems: NavItem[] = [
  { href: "/hotel-connect",            label: "Dashboard",     icon: HomeIcon, exact: true },
  { href: "/hotel-connect/properties", label: "My Properties", icon: BuildingOffice2Icon },
  {
    href: "/hotel-connect/calendar", label: "Rates & Inventory", icon: TableCellsIcon,
    matchPatterns: [/^\/hotel-connect\/properties\/\d+\/(rates|calendar)(\/|$)/],
  },
  { href: "/hotel-connect/bookings",   label: "Bookings",      icon: CalendarDaysIcon },
  { href: "/hotel-connect/revenue",    label: "Revenue",       icon: CurrencyRupeeIcon },
  { href: "/hotel-connect/reviews",    label: "Reviews",       icon: StarIcon },
  { href: "/hotel-connect/inbox",      label: "Group Inbox",   icon: ChatBubbleLeftRightIcon },
];

/**
 * Picks exactly one "winning" nav item for a pathname. Nav items are checked
 * independently by href-prefix elsewhere in the app, which breaks down when
 * two items' prefixes overlap (e.g. "My Properties" at /properties also
 * prefix-matches Rates & Inventory's real pages at /properties/[id]/rates,
 * so both would light up, or the more specific one never would). An item's
 * explicit matchPatterns (most specific) win over generic href-prefix
 * matches; among prefix matches, the longest href wins.
 */
export function resolveActiveHref(pathname: string, items: NavItem[]): string | null {
  for (const item of items) {
    if (item.exact && pathname === item.href) return item.href;
  }
  for (const item of items) {
    if (item.matchPatterns?.some((p) => p.test(pathname))) return item.href;
  }
  let best: { href: string; len: number } | null = null;
  for (const item of items) {
    if (item.exact) continue;
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.len) best = { href: item.href, len: item.href.length };
    }
  }
  return best?.href ?? null;
}

export default function ConnectSidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const activeHref = resolveActiveHref(pathname, navItems);

  return (
    <>
      {/* Mobile-only backdrop, closes the drawer on tap */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 h-full flex flex-col border-r border-neutral-200 bg-white shrink-0",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:sticky lg:top-0 lg:z-auto lg:w-60",
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between gap-2.5 px-4 border-b border-neutral-200 shrink-0">
          <Link href="/hotel-connect" className="flex items-center gap-2 min-w-0">
            <DyLogo className="h-9 w-full text-primary-500 shrink-0" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 shrink-0"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-white bg-linear-to-b from-primary-100/80 to-white text-primary-600 ring-1 ring-inset ring-primary-200/80 relative after:absolute after:left-0 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-1 after:h-1/2 after:bg-linear-to-b after:bg-white after:from-primary-400 after:to-primary-600 after:rounded-pill"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800"
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0",  active ? "text-primary-500/90" : "text-neutral-400")} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-2 border-t border-neutral-200">
          <form action={signOutHotelOwner}>
            <button
              type="submit"
              title="Sign out"
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            >
              <ArrowRightStartOnRectangleIcon className="w-5 h-5 shrink-0" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
