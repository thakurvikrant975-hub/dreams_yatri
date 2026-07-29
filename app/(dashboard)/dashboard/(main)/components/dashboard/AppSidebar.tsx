"use client";
import { useState } from "react";
import {
  Sidebar, SidebarContent, SidebarGroup,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "../ui/sidebar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DyLogo from "@/app/components/ui/DyLogo";
import { cn } from "@/app/lib/utils";
import { useVerificationCounts } from "@/app/lib/ably-client";
import { NAV_GROUPS as navGroups } from "../../lib/rbac/nav-items";

// Nav hrefs that carry a live "still needs doing" count badge.
const NAV_BADGE_HREF = "/dashboard/verify-hotels";

export function AppSidebar({
  pageAccess,
  hotelsPending = 0,
}: {
  pageAccess?: string[] | null;
  hotelsPending?: number;
}) {
  const pathname = usePathname();

  // Live count — starts from the server-rendered value, then updates over
  // Ably whenever a booking enters/leaves the hotel-verification queue.
  // Re-synced from props during render (not an effect) on navigation.
  const [syncedFrom, setSyncedFrom] = useState(hotelsPending);
  const [liveHotelsPending, setLiveHotelsPending] = useState(hotelsPending);
  if (hotelsPending !== syncedFrom) {
    setSyncedFrom(hotelsPending);
    setLiveHotelsPending(hotelsPending);
  }
  useVerificationCounts((counts) => setLiveHotelsPending(counts.hotelsPending));

  function isPageAllowed(href: string) {
    if (!pageAccess || pageAccess.length === 0) return true;
    return pageAccess.includes(href);
  }

  function isActive(href: string) {
    if (href === "/dashboard/packages/new") return pathname === href;
    if (href === "/dashboard/packages") return pathname === href || (pathname.startsWith("/dashboard/packages") && pathname !== "/dashboard/packages/new");
    if (href === "/dashboard/activities/new") return pathname === href;
    if (href === "/dashboard/activities/categories") return pathname === href;
    if (href === "/dashboard/activities") return pathname === href || (pathname.startsWith("/dashboard/activities/") && pathname !== "/dashboard/activities/new" && !pathname.startsWith("/dashboard/activities/categories"));
    return pathname === href;
  }

  return (
    <Sidebar className="border-r-0">
      <SidebarContent className="scrollbar-none bg-dashboard-base-100">

        {/* Logo */}
        <div className="px-5 py-4 flex items-center border-b border-dashboard-base-300">
          <DyLogo className="h-8 text-primary-500" />
        </div>

        {/* Nav */}
        <Accordion type="multiple" defaultValue={navGroups.map(g => g.id)} className="py-3 px-2">
          {navGroups.map(group => {
            const visibleItems = group.items.filter(item => isPageAllowed(item.href));
            if (visibleItems.length === 0) return null;
            return (
            <AccordionItem key={group.id} value={group.id} className="border-none">

              <AccordionTrigger className="px-2 py-1.5 mb-0.5 text-[11px] font-semibold uppercase tracking-widest hover:no-underline hover:bg-transparent cursor-pointer text-dashboard-base-content">
                {group.label}
              </AccordionTrigger>

              <AccordionContent className="pb-2">
                <SidebarGroup className="p-0">
                  <SidebarMenu className="gap-0.5">
                    {visibleItems.map(item => {
                      const active = isActive(item.href);
                      const IconComponent = item.icon;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            className={cn(
                              "h-8 px-3 rounded-md transition-all duration-150",
                              active
                                ? "bg-dashboard-primary/10 text-dashboard-primary font-medium"
                                : "text-dashboard-neutral hover:bg-dashboard-primary/10 hover:text-dashboard- "
                            )}
                          >
                            <Link href={item.href} className="flex items-center gap-2.5 cursor-pointer">
                              <IconComponent
                                weight={item.phosphor ? "duotone" : undefined}
                                className="size-5 shrink-0"
                                style={{ color: "inherit" }}
                              />
                              <span className="text-[15px] leading-none">{item.title}</span>
                              {item.href === NAV_BADGE_HREF && liveHotelsPending > 0 && (
                                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white tabular-nums">
                                  {liveHotelsPending}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </AccordionContent>

            </AccordionItem>
            );
          })}
        </Accordion>
      </SidebarContent>
    </Sidebar>
  );
}