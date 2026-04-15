"use client";
import {
    Sidebar, SidebarContent, SidebarGroup,
    SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "../ui/sidebar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from "../ui/accordion";


import {
    MapPin, Hotel, Package, Globe, LayoutDashboard,
    Tag, Settings, Users, BookOpen, BarChart3,
} from "lucide-react";

import {
    GlobeHemisphereEastIcon,
    MapPinIcon,
    BuildingIcon,
    PlusIcon
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
            { title: "Categories", href: "/dashboard/categories", icon: <Tag className="size-6 text-muted-foreground" /> },
            { title: "Activities", href: "/dashboard/activities", icon: <BookOpen className="size-6 text-muted-foreground" /> },
            { title: "Policies", href: "/dashboard/policies", icon: <Package className="size-6 text-muted-foreground" /> },
        ],
    },
    {
        id: "hotels",
        label: "Hotels",
        items: [
            { title: "All Hotels", href: "/dashboard/hotels", icon: <BuildingIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
            { title: "Add New", href: "/dashboard/hotels/new", icon: <PlusIcon weight="duotone" className="size-6 scale-110 text-muted-foreground" /> },
        ],
    },
    {
        id: "users",
        label: "Users & Bookings",
        items: [
            { title: "Customers", href: "/dashboard/customers", icon: <Users className="size-6 text-muted-foreground" /> },
            { title: "Bookings", href: "/dashboard/bookings", icon: <BookOpen className="size-6 text-muted-foreground" /> },
            { title: "Leads", href: "/dashboard/leads", icon: <BarChart3 className="size-6 text-muted-foreground" /> },
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
                    defaultValue={navGroups.map(g => g.id)} // all open by default
                    className="px-2 py-2"
                >
                    {navGroups.map(group => (
                        <AccordionItem
                            key={group.id}
                            value={group.id}
                            className="border-none"
                        >
                            <AccordionTrigger className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground  hover:text-foreground ">
                                {group.label}
                            </AccordionTrigger>
                            <AccordionContent className="pb-1">
                                <SidebarGroup className="p-0">
                                    <SidebarMenu>
                                        {group.items.map(item => (
                                            <SidebarMenuItem key={item.href}>
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={pathname === item.href}
                                                >
                                                    <Link href={item.href} >
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