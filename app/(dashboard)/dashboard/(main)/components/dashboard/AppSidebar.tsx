"use client";
import {
    Sidebar, SidebarContent, SidebarGroup,
    SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "../ui/sidebar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from "../ui/accordion";

import { LayoutDashboard, Settings, Users, BookOpen, BarChart3, Activity, IdCardLanyard, KeyRound, MessageCircleQuestion, ClockCheck, Mails, Forward, BadgePercent, HandCoins, Banknote, ChartSpline, BanknoteArrowDown, BanknoteX, Car, Bed
} from "lucide-react";

import {
    GlobeHemisphereEastIcon,
    MapPinIcon,
    BuildingIcon,
    PlusIcon,
    TagIcon,
    ParachuteIcon,
    FileTextIcon,
    PackageIcon,
    SteeringWheelIcon,
} from "@phosphor-icons/react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const navGroups = [
    {
        id: "overview",
        label: "Overview",
        items: [
            { title: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="size-6 text-muted-foreground" /> },
            { title: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 className="size-6 text-muted-foreground" /> },
        ],
    },
    {
        id: "content",
        label: "Content Management",
        items: [
            { title: "Regions", href: "/dashboard/regions", icon: <GlobeHemisphereEastIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
            { title: "Destinations", href: "/dashboard/destinations", icon: <MapPinIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
            { title: "Categories", href: "/dashboard/categories", icon: <TagIcon weight="duotone" className="size-6 text-muted-foreground" /> },
            { title: "Activities", href: "/dashboard/activities", icon: <ParachuteIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
            { title: "Policies", href: "/dashboard/policies", icon: <FileTextIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
        ],
    },
    {
        id: "hotels",
        label: "Hotels",
        items: [
            { title: "All Hotels", href: "/dashboard/hotels", icon: <BuildingIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
            { title: "Add New", href: "/dashboard/hotels/new", icon: <PlusIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
            { title: "Meal Types", href: "/dashboard/hotels/meal-types", icon: <KeyRound className="size-6 text-muted-foreground" /> },
            { title: "Diet Types", href: "/dashboard/hotels/diet-types", icon: <IdCardLanyard className="size-6 text-muted-foreground" /> },
        ],
    },
    {
        id: "packages",
        label: "Packages",
        items: [
            { title: "All Packages", href: "/dashboard/packages", icon: <PackageIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
            { title: "New Package", href: "/dashboard/packages/new", icon: <PlusIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
        ],
    },
    {
        id: "marketing",
        label: "Marketing",
        items: [
            { title: "Queries", href: "/dashboard/queries", icon: <MessageCircleQuestion className="size-6 text-muted-foreground" /> },
            { title: "Email Marketing", href: "/dashboard/email-marketing", icon: <Mails className="size-6 text-muted-foreground" /> },
            { title: "Follow ups", href: "/dashboard/follow-ups", icon: <ClockCheck className="size-6 text-muted-foreground" /> },
            { title: "References", href: "/dashboard/references", icon: <Forward className="size-6 text-muted-foreground" /> },
            { title: "Coupons and offers", href: "/dashboard/coupons", icon: <BadgePercent className="size-6 text-muted-foreground" /> },
        ],
    },
    {
        id: "Transactions",
        label: "Transactions",
        items: [
            { title: "Transactions", href: "/dashboard/transactions", icon: <Banknote className="size-6 text-muted-foreground" /> },
            { title: "Failed Transactions", href: "/dashboard/failed-transactions", icon: <BanknoteX className="size-6 text-muted-foreground" /> },
            { title: "Refunds", href: "/dashboard/refunds", icon: <BanknoteArrowDown className="size-6 text-muted-foreground" /> },
            { title: "Analytics", href: "/dashboard/analytics", icon: <ChartSpline className="size-6 text-muted-foreground" /> },

        ],
    },
    {
        id: "team",
        label: "Out team",
        items: [
            { title: "Team Members", href: "/dashboard/team-members", icon: <IdCardLanyard className="size-6 text-muted-foreground" /> },
            { title: "Activity Logs", href: "/dashboard/activity-logs", icon: <Activity className="size-6 text-muted-foreground" /> },
            { title: "Roles and Permissions", href: "/dashboard/roles-and-permissions", icon: <KeyRound className="size-6 text-muted-foreground" /> },
        ],
    },
    {
        id: "bookings",
        label: "Booking management",
        items: [
            { title: "Package Bookings", href: "/dashboard/package-bookings", icon: <BookOpen className="size-6 text-muted-foreground" /> },
            { title: "Verify Hotels", href: "/dashboard/verify-hotels", icon: <Bed className="size-6 text-muted-foreground" /> },
            { title: "Verify Cabs", href: "/dashboard/verify-cabs", icon: <Car className="size-6 text-muted-foreground" /> },
            { title: "Assign Cab Driver", href: "/dashboard/assign-driver", icon: <SteeringWheelIcon className="size-6 text-muted-foreground" /> },
        ],
    },
    {
        id: "settings",
        label: "Settings",
        items: [
            { title: "General", href: "/dashboard/settings", icon: <Settings className="size-6 text-muted-foreground" /> },
        ],
    },
];

export function AppSidebar() {
    const pathname = usePathname();

    // Mark packages section active for any /dashboard/packages/* route
    function isActive(href: string) {
        if (href === "/dashboard/packages/new") return pathname === href;
        if (href === "/dashboard/packages") return pathname === href || (pathname.startsWith("/dashboard/packages") && pathname !== "/dashboard/packages/new");
        return pathname === href;
    }

    return (
        <Sidebar>
            <SidebarContent>
                {/* Logo */}
                <div className="px-4 py-5 font-bold text-lg border-b flex items-center">
                    <Image src="/dy_logo.svg" alt="Dreams Yatri Logo" width={1267} height={461} className="mr-2 h-8 aspect-1267/461" />
                </div>

                {/* Accordion Nav */}
                <Accordion
                    type="multiple"
                    defaultValue={navGroups.map(g => g.id)}
                    className="px-2 py-2"
                >
                    {navGroups.map(group => (
                        <AccordionItem
                            key={group.id}
                            value={group.id}
                            className="border-none"
                        >
                            <AccordionTrigger className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                                {group.label}
                            </AccordionTrigger>
                            <AccordionContent className="pb-1">
                                <SidebarGroup className="p-0">
                                    <SidebarMenu>
                                        {group.items.map(item => (
                                            <SidebarMenuItem key={item.href}>
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={isActive(item.href)}
                                                >
                                                    <Link href={item.href}>
                                                        {item.icon}
                                                        <span className="text-sm ml-1.5">{item.title}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </SidebarMenu>
                                </SidebarGroup>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </SidebarContent>
        </Sidebar>
    );
} 