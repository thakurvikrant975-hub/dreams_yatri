"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/app/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  [
    "group/tabs-list inline-flex w-fit items-center justify-center gap-1 p-1.5",
    "group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
    "rounded-xl",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-dashboard-base-100",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base layout
        "relative inline-flex flex-1 flex-col items-center justify-center",
        "gap-0.5 rounded-xl border border-transparent px-4 py-2.5",
        "text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",

        // Vertical overrides
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:flex-row",
        "group-data-vertical/tabs:justify-start",

        // Inactive styles
        "bg-transparent",
        "text-dashboard-base-content",
        "[&_[data-day]]:text-dashboard-base-content/45",
        "**:data-day:text-[11px] **:data-day:font-medium",

        // Hover
        "hover:bg-dashboard-base-200",

        // Focus ring
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-dashboard-primary",
        "focus-visible:ring-offset-1",

        // Disabled
        "disabled:pointer-events-none disabled:opacity-40",

        // SVG defaults
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",

        // ── Active state ─────────────────────────────────────────
        "data-[state=active]:bg-dashboard-primary",
        "data-[state=active]:text-dashboard-primary-content",
        "data-[state=active]:**:data-day:text-dashboard-primary-content/75",
        "data-[state=active]:border-transparent",
        "data-[state=active]:shadow-lg",
        "data-[state=active]:shadow-dashboard-primary/30",

        // ── Line variant overrides ────────────────────────────────
        "group-data-[variant=line]/tabs-list:bg-transparent",
        "group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent",
        "group-data-[variant=line]/tabs-list:rounded-none",

        // ── Underline bar (line variant only) ─────────────────────
        "after:absolute after:opacity-0 after:transition-opacity after:rounded-full",
        "after:bg-dashboard-primary",
        "group-data-horizontal/tabs:after:inset-x-3",
        "group-data-horizontal/tabs:after:bottom-[-4px]",
        "group-data-horizontal/tabs:after:h-0.5",
        "group-data-vertical/tabs:after:inset-y-3",
        "group-data-vertical/tabs:after:-right-1",
        "group-data-vertical/tabs:after:w-0.5",
        "group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",

        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm/relaxed outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }