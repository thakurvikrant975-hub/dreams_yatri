"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Buildings,
  ChatCircleDots,
  HouseLine,
  SignOut,
  Star,
  CalendarBlank,
  CurrencyInr,
} from "@phosphor-icons/react";
import { signOutHotelOwner } from "@/app/lib/auth-hotel-connect-actions";
import DyLogo from "@/app/components/ui/DyLogo";
import { cn } from "@/app/lib/utils";

const navItems = [
  { href: "/hotel-connect",            label: "Dashboard",    icon: HouseLine,    exact: true },
  { href: "/hotel-connect/properties", label: "My Properties", icon: Buildings },
  { href: "/hotel-connect/bookings",   label: "Bookings",     icon: CalendarBlank },
  { href: "/hotel-connect/revenue",    label: "Revenue",      icon: CurrencyInr },
  { href: "/hotel-connect/reviews",    label: "Reviews",      icon: Star },
  { href: "/hotel-connect/inbox",      label: "Group Inbox",  icon: ChatCircleDots },
];

export default function ConnectSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-15 lg:w-60 min-h-screen flex flex-col border-r border-neutral-100 bg-white shrink-0">

      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-neutral-100 overflow-hidden">
        <Link href="/hotel-connect" className="hidden lg:flex items-center gap-2 min-w-0">
          <DyLogo className="h-9 w-full text-primary-500 shrink-0" />
        </Link>
        <Link href="/hotel-connect" className="lg:hidden w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
          <Buildings size={16} weight="fill" color="white" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary-50 text-primary-700"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
              )}
            >
              <Icon size={17} weight={active ? "fill" : "regular"} className="shrink-0" />
              <span className="hidden lg:block truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-2 border-t border-neutral-100">
        <form action={signOutHotelOwner}>
          <button
            type="submit"
            title="Sign out"
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
          >
            <SignOut size={17} weight="regular" className="shrink-0" />
            <span className="hidden lg:block">Sign out</span>
          </button>
        </form>
      </div>

    </aside>
  );
}
