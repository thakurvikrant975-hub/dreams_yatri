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

const navItems = [
  { href: "/hotel-connect", label: "Dashboard", icon: HouseLine, exact: true },
  { href: "/hotel-connect/properties", label: "My Properties", icon: Buildings },
  { href: "/hotel-connect/bookings", label: "Bookings", icon: CalendarBlank },
  { href: "/hotel-connect/revenue", label: "Revenue", icon: CurrencyInr },
  { href: "/hotel-connect/reviews", label: "Reviews", icon: Star },
  { href: "/hotel-connect/inbox", label: "Group Inbox", icon: ChatCircleDots },
];

export default function ConnectSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-[70px] lg:w-[220px] min-h-screen flex flex-col border-r border-gray-200 bg-white flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-100">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
          }}
        >
          <Buildings size={18} weight="fill" color="white" />
        </div>
        <div className="hidden lg:block">
          <span
            className="text-base font-black text-gray-900 block leading-none"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Dreams<span className="text-orange-500">Yatri</span>
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500 leading-none">
            connect
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-150 group ${
                active
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  active ? "bg-orange-100" : "group-hover:bg-gray-100"
                }`}
              >
                <Icon
                  size={18}
                  weight={active ? "fill" : "regular"}
                  className={active ? "text-orange-500" : "text-gray-400 group-hover:text-gray-600"}
                />
              </div>
              <span className={`hidden lg:block text-sm font-medium ${active ? "text-orange-600" : ""}`}>
                {label}
              </span>
              {active && (
                <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-2 border-t border-gray-100">
        <form action={signOutHotelOwner}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-150 group cursor-pointer"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors">
              <SignOut size={18} weight="regular" />
            </div>
            <span className="hidden lg:block text-sm font-medium">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
