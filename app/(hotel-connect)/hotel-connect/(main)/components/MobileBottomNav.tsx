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
import { isNavActive } from "./ConnectSidebar";

type HeroIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

// Only the most-used destinations get a permanent tab — everything else
// (Revenue, Reviews, Group Inbox, Sign out) lives behind "More", which opens
// the same drawer as the header's hamburger button.
const TABS: { href: string; label: string; icon: HeroIcon; exact?: boolean }[] = [
  { href: "/hotel-connect",            label: "Home",       icon: HomeIcon, exact: true },
  { href: "/hotel-connect/properties", label: "Properties", icon: BuildingOffice2Icon },
  { href: "/hotel-connect/calendar",   label: "Rates",       icon: TableCellsIcon },
  { href: "/hotel-connect/bookings",   label: "Bookings",    icon: CalendarDaysIcon },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpen } = useMobileNav();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-20 h-16 bg-white border-t border-neutral-200 flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = isNavActive(pathname, href, exact);
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
