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
    "group/tabs-list inline-flex w-fit items-center justify-center p-1",
    "text-[var(--color-dashboard-base-content)]",
    "group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
    // default variant shape
    "data-[variant=line]:rounded-none rounded-xl",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-[var(--color-dashboard-base-200)]",
        line:    "gap-1 bg-transparent",
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
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center",
        "gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5",
        "text-xs font-medium whitespace-nowrap transition-all cursor-pointer",

        // Vertical overrides
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        "group-data-vertical/tabs:py-[calc(--spacing(1.25))]",

        // Inactive text — muted version of base-content
        "text-[color-mix(in_oklch,var(--color-dashboard-base-content)_45%,transparent)]",
        "hover:text-[var(--color-dashboard-base-content)]",

        // Focus ring using primary
        "focus-visible:border-[var(--color-dashboard-primary)]",
        "focus-visible:ring-[3px]",
        "focus-visible:ring-[color-mix(in_oklch,var(--color-dashboard-primary)_50%,transparent)]",
        "focus-visible:outline-1 focus-visible:outline-[var(--color-dashboard-primary)]",

        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",

        // Icon padding helpers
        "has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1",

        // SVG defaults
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",

        // ── Active state (default pill variant) ──────────────────────────
        "data-active:bg-[var(--color-dashboard-base-100)]",
        "data-active:text-[var(--color-dashboard-base-content)]",
        "data-active:border-[var(--color-dashboard-base-300)]",
        "data-active:shadow-sm",

        // ── Line variant overrides ───────────────────────────────────────
        // Inactive in line variant: no bg
        "group-data-[variant=line]/tabs-list:bg-transparent",
        // Active in line variant: also no bg fill, just the underline
        "group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "group-data-[variant=line]/tabs-list:data-active:border-transparent",

        // ── Underline bar (line variant only) ───────────────────────────
        "after:absolute after:opacity-0 after:transition-opacity",
        "after:bg-[var(--color-dashboard-primary)]",
        // Horizontal: bar at the bottom
        "group-data-horizontal/tabs:after:inset-x-0",
        "group-data-horizontal/tabs:after:bottom-[-5px]",
        "group-data-horizontal/tabs:after:h-0.5",
        // Vertical: bar on the right edge
        "group-data-vertical/tabs:after:inset-y-0",
        "group-data-vertical/tabs:after:-right-1",
        "group-data-vertical/tabs:after:w-0.5",
        // Show bar only when active + line variant
        "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",

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
      className={cn("flex-1 text-xs/relaxed outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }