// app/(dashboard)/dashboard/(main)/lib/rbac/nav-items.ts
// Single source of truth for the dashboard sidebar — also used by the
// role "Sidebar Access" editor so the two stay in sync.
import {
  LayoutDashboard, Settings, BookOpen, BarChart3, Activity, IdCardLanyard, KeyRound, MessageCircleQuestion, ClockCheck, Mails, Forward, BadgePercent, Banknote, ChartSpline, BanknoteArrowDown, BanknoteX, Car, Bed, ChartNoAxesCombined, BellRing, PackagePlus, ChartNoAxesGantt, Star, IndianRupee, X,
} from "lucide-react";
import {
  GlobeHemisphereEastIcon, MapPinIcon, BuildingIcon, TagIcon,
  ParachuteIcon, FileTextIcon, PackageIcon, SteeringWheelIcon,
} from "@phosphor-icons/react";

export const NAV_GROUPS = [
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
      { title: "Categories", href: "/dashboard/activities/categories", icon: TagIcon, phosphor: true },
    ],
  },
  {
    id: "hotels", label: "Hotels",
    items: [
      { title: "Hotels", href: "/dashboard/hotels", icon: BuildingIcon, phosphor: true },
      { title: "Meal Types", href: "/dashboard/hotels/meal-types", icon: KeyRound },
      { title: "Diet Types", href: "/dashboard/hotels/diet-types", icon: IdCardLanyard },
      { title: "Verify Hotels", href: "/dashboard/verify-hotels", icon: Bed },

    ],
  },
  {
    id: "packages", label: "Packages",
    items: [
      { title: "Travel Packages", href: "/dashboard/packages", icon: PackageIcon, phosphor: true },
      { title: "Package Bookings", href: "/dashboard/package-bookings", icon: BookOpen },

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
    ],
  },
  {
    id: "settings", label: "Settings",
    items: [
      { title: "General", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

// Re-exported for the Sidebar Access editor — kept in a separate, icon-free
// module so server code (the dashboard layout) can import resolveNavHref
// without pulling icon libraries into the server bundle.
export { ALL_HREFS, resolveNavHref } from "./nav-hrefs";
