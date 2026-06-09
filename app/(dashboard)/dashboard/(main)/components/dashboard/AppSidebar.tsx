"use client";
import {
  Sidebar, SidebarContent, SidebarGroup,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "../ui/sidebar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import {
  LayoutDashboard, Settings, BookOpen, BarChart3, Activity, IdCardLanyard, KeyRound,
  MessageCircleQuestion, ClockCheck, Mails, Forward, BadgePercent, Banknote,
  ChartSpline, BanknoteArrowDown, BanknoteX, Car, Bed, ChartNoAxesCombined,
  BellRing, PackagePlus, ChartNoAxesGantt, Star, IndianRupee,
  UserRound,
  X,
} from "lucide-react";
import {
  GlobeHemisphereEastIcon, MapPinIcon, BuildingIcon, TagIcon,
  ParachuteIcon, FileTextIcon, PackageIcon, SteeringWheelIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import DyLogo from "@/app/components/ui/DyLogo";
import { cn } from "@/app/lib/utils";

const navGroups = [ 
  {
    id: "overview", label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    id: "content", label: "Content Management",
    items: [
      { title: "Regions", href: "/dashboard/regions", icon: GlobeHemisphereEastIcon, phosphor: true },
      { title: "Destinations", href: "/dashboard/destinations", icon: MapPinIcon, phosphor: true },
      { title: "Categories", href: "/dashboard/categories", icon: TagIcon, phosphor: true },
      { title: "Policies", href: "/dashboard/policies", icon: FileTextIcon, phosphor: true },
      { title: "Blog Reviews", href: "/dashboard/blogs", icon: BookOpen },
    ],
  },
  {
    id: "activities", label: "Activities",
    items: [
      { title: "Activities", href: "/dashboard/activities", icon: ParachuteIcon, phosphor: true },
      // { title: "New Activity",   href: "/dashboard/activities/new",        icon: PlusIcon,      phosphor: true },
      { title: "Categories", href: "/dashboard/activities/categories", icon: TagIcon, phosphor: true },
    ],
  },
  {
    id: "hotels", label: "Hotels",
    items: [
      { title: "Hotels", href: "/dashboard/hotels", icon: BuildingIcon, phosphor: true },
      // { title: "Add New",    href: "/dashboard/hotels/new",       icon: PlusIcon,     phosphor: true },
      { title: "Meal Types", href: "/dashboard/hotels/meal-types", icon: KeyRound },
      { title: "Diet Types", href: "/dashboard/hotels/diet-types", icon: IdCardLanyard },
    ],
  },
  {
    id: "packages", label: "Packages",
    items: [
      { title: "Travel Packages", href: "/dashboard/packages", icon: PackageIcon, phosphor: true },
      // { title: "New Package",  href: "/dashboard/packages/new", icon: PlusIcon,           phosphor: true },
    ],
  },
  {
    id: "cab", label: "Cab management",
    items: [
      { title: "Vehicle Types", href: "/dashboard/vehicles", icon: Car, phosphor: true },
      { title: "Cab Pricing", href: "/dashboard/cab-pricing", icon: IndianRupee },
      { title: "Cab Drivers", href: "/dashboard/cab-drivers", icon: SteeringWheelIcon, phosphor: true },
      { title: "Verify Cabs", href: "/dashboard/verify-cabs", icon: Car },
      { title: "Assign Drivers", href: "/dashboard/assign-driver", icon: SteeringWheelIcon, phosphor: true },
    ],
  },
  {
    id: "marketing", label: "Marketing",
    items: [
      { title: "Queries", href: "/dashboard/queries", icon: MessageCircleQuestion },
      { title: "Email Marketing", href: "/dashboard/email-marketing", icon: Mails },
      { title: "Follow ups", href: "/dashboard/follow-ups", icon: ClockCheck },
      { title: "References", href: "/dashboard/references", icon: Forward },
      { title: "Coupons and offers", href: "/dashboard/coupons", icon: BadgePercent },
      { title: "Reviews", href: "/dashboard/reviews", icon: Star },
      { title: "Not Found", href: "/dashboard/not-found", icon: X },
    ],
  },
  {
    id: "sales", label: "Sales",
    items: [
      { title: "Dashboard", href: "/sales-dashboard", icon: LayoutDashboard },
      { title: "Queries Management", href: "/dashboard/sales-query", icon: ChartNoAxesGantt },
      { title: "Analytics", href: "/dashboard/sale-analytics", icon: ChartNoAxesCombined },
      { title: "Follow ups", href: "/dashboard/follow-ups", icon: BellRing },
      { title: "Package Builder", href: "/dashboard/package-builder", icon: PackagePlus },
    ],
  },
  {
    id: "Transactions", label: "Transactions",
    items: [
      { title: "Transactions", href: "/dashboard/transactions", icon: Banknote },
      { title: "Failed Transactions", href: "/dashboard/failed-transactions", icon: BanknoteX },
      { title: "Refunds", href: "/dashboard/refunds", icon: BanknoteArrowDown },
      { title: "Analytics", href: "/dashboard/analytics", icon: ChartSpline },
    ],
  },
  {
    id: "team", label: "Our Team",
    items: [
      { title: "Team Members", href: "/dashboard/team-members", icon: IdCardLanyard },
      { title: "Activity Logs", href: "/dashboard/activity-logs", icon: Activity },
      { title: "Roles and Permissions", href: "/dashboard/roles-and-permissions", icon: KeyRound },
      { title: "Page Access", href: "/dashboard/roles-and-permissions/page-access", icon: LayoutDashboard },
    ],
  },
  {
    id: "bookings", label: "Booking Management",
    items: [
      { title: "Package Bookings", href: "/dashboard/package-bookings", icon: BookOpen },
      { title: "Verify Hotels", href: "/dashboard/verify-hotels", icon: Bed },
    ],
  },
  {
    id: "settings", label: "Settings",
    items: [
      { title: "General", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export function AppSidebar({ pageAccess }: { pageAccess?: string[] | null }) {
  const pathname = usePathname();

  // null / undefined = no restriction (admin or role without page access config)
  // string[] = only show pages in the list
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