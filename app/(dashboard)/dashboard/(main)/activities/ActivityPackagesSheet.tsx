"use client";

import { useState, useTransition } from "react";
import {
    Package, ExternalLink, MapPin, Loader2, PackageOpen,
    CalendarDays, ChevronDown, ChevronUp, Hash,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/app/lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../components/ui/sheet";
import { getActivityPackageUsage, type ActivityPackageUsage } from "./actions";

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

// ── Package card ──────────────────────────────────────────────────────────

function UsagePill({ day, label }: { day: number; label: string }) {
    return (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-dashboard-base-300 bg-dashboard-base-200 px-2 py-1 text-[11px] text-dashboard-base-content/70">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-dashboard-primary/10 text-[10px] font-bold text-dashboard-primary shrink-0">
                {day}
            </span>
            <span className="truncate max-w-40">{label}</span>
        </div>
    );
}

function PackageCard({ pkg }: { pkg: ActivityPackageUsage }) {
    const [expanded, setExpanded] = useState(false);
    const MAX_VISIBLE = 3;
    const visibleUsages = expanded ? pkg.usages : pkg.usages.slice(0, MAX_VISIBLE);
    const hasMore = pkg.usages.length > MAX_VISIBLE;

    function openEditor() {
        window.open(
            `/dashboard/packages/${pkg.packageId}`,
            "_blank",
            "noopener,noreferrer",
        );
    }

    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden group transition-all hover:border-dashboard-primary/30 hover:shadow-sm">
            {/* ── Header row ────────────────────────────────────────────── */}
            <div className="flex items-start gap-3 p-3.5">
                {/* Thumbnail */}
                {pkg.thumbnail ? (
                    <Image
                        src={`${BASE}/${pkg.thumbnail}`}
                        alt={pkg.packageTitle}
                        width={52}
                        height={52}
                        className="h-[52px] w-[52px] rounded-lg object-cover shrink-0 border border-dashboard-base-300"
                    />
                ) : (
                    <div className="h-[52px] w-[52px] rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 flex items-center justify-center shrink-0">
                        <Package className="h-5 w-5 text-dashboard-base-content/30" />
                    </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-dashboard-base-content leading-tight line-clamp-2">
                            {pkg.packageTitle}
                        </p>
                        <Badge
                            variant={pkg.isActive ? "default" : "secondary"}
                            className="text-[10px] shrink-0 px-1.5 py-0"
                        >
                            {pkg.isActive ? "Active" : "Draft"}
                        </Badge>
                    </div>

                    {pkg.destination && (
                        <p className="flex items-center gap-1 text-[11px] text-dashboard-base-content/50">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {pkg.destination}
                        </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-dashboard-base-content/50">
                        <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {pkg.durationCount} duration{pkg.durationCount !== 1 ? "s" : ""}
                        </span>
                        <span className="text-dashboard-base-content/20">·</span>
                        <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {pkg.usages.length} itinerary use{pkg.usages.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Day/itinerary usages ───────────────────────────────────── */}
            <div className="border-t border-dashboard-base-300 bg-dashboard-base-200/50 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-dashboard-base-content/40 mb-2">
                    Appears in
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {visibleUsages.map((u, i) => (
                        <UsagePill
                            key={i}
                            day={u.day}
                            label={`Day ${u.day} · ${u.durationLabel} · ${u.itineraryTitle}`}
                        />
                    ))}
                </div>

                {hasMore && (
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="mt-2 flex items-center gap-1 text-[11px] text-dashboard-primary font-medium hover:underline"
                    >
                        {expanded ? (
                            <><ChevronUp className="h-3 w-3" /> Show less</>
                        ) : (
                            <><ChevronDown className="h-3 w-3" /> +{pkg.usages.length - MAX_VISIBLE} more</>
                        )}
                    </button>
                )}
            </div>

            {/* ── Footer action ──────────────────────────────────────────── */}
            <div className="border-t border-dashboard-base-300 px-3.5 py-2.5 flex items-center justify-between">
                <p className="text-[11px] text-dashboard-base-content/40 truncate">
                    /packages/{pkg.packageSlug}
                </p>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1.5 text-dashboard-primary hover:text-dashboard-primary hover:bg-dashboard-primary/8 shrink-0"
                    onClick={openEditor}
                >
                    Open Editor
                    <ExternalLink className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-dashboard-base-200 border border-dashboard-base-300 flex items-center justify-center">
                <PackageOpen className="h-7 w-7 text-dashboard-base-content/30" />
            </div>
            <div className="space-y-1">
                <p className="text-sm font-semibold text-dashboard-base-content">
                    Not used in any package
                </p>
                <p className="text-xs text-dashboard-base-content/50 max-w-52 mx-auto leading-relaxed">
                    This activity hasn't been added to any package itinerary yet.
                </p>
            </div>
        </div>
    );
}

// ── Main sheet ────────────────────────────────────────────────────────────

export function ActivityPackagesSheet({
    activityId,
    activityName,
    usageCount,
}: {
    activityId:  number;
    activityName: string;
    usageCount:  number;
}) {
    const [open, setOpen]              = useState(false);
    const [packages, setPackages]      = useState<ActivityPackageUsage[]>([]);
    const [loaded, setLoaded]          = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleOpen(o: boolean) {
        setOpen(o);
        if (o && !loaded) {
            startTransition(async () => {
                const result = await getActivityPackageUsage(activityId);
                setPackages(result);
                setLoaded(true);
            });
        }
    }

    const uniquePackages = loaded ? packages.length : null;

    return (
        <Sheet open={open} onOpenChange={handleOpen}>
            <SheetTrigger asChild>
                <button
                    title="See which packages use this activity"
                    className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-all",
                        usageCount > 0
                            ? "bg-dashboard-primary/10 text-dashboard-primary hover:bg-dashboard-primary/20 border border-dashboard-primary/20"
                            : "bg-dashboard-base-200 text-dashboard-base-content/40 hover:bg-dashboard-base-300 border border-dashboard-base-300",
                    )}
                >
                    <Package className="h-3 w-3 shrink-0" />
                    {usageCount > 0 ? usageCount : "—"}
                </button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col gap-0 p-0">

                {/* Header */}
                <SheetHeader className="shrink-0 border-b border-dashboard-base-300 px-5 py-4 gap-0.5">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-dashboard-primary/10 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-dashboard-primary" />
                        </div>
                        <div className="min-w-0">
                            <SheetTitle className="text-sm font-semibold leading-tight">
                                Package Usage
                            </SheetTitle>
                            <p className="text-xs text-dashboard-base-content/50 truncate mt-0.5">
                                {activityName}
                            </p>
                        </div>
                    </div>
                </SheetHeader>

                {/* Summary bar */}
                {loaded && (
                    <div className="shrink-0 flex items-center gap-2 border-b border-dashboard-base-300 bg-dashboard-base-200/60 px-5 py-2.5">
                        <div className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            uniquePackages! > 0 ? "bg-dashboard-success" : "bg-dashboard-base-content/20",
                        )} />
                        <p className="text-xs text-dashboard-base-content/60">
                            {uniquePackages === 0
                                ? "Not used in any package"
                                : `Used in ${uniquePackages} package${uniquePackages !== 1 ? "s" : ""}`}
                        </p>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {isPending ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-dashboard-base-content/40">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">Loading packages…</p>
                        </div>
                    ) : loaded && packages.length === 0 ? (
                        <EmptyState />
                    ) : loaded ? (
                        <div className="px-4 py-4 space-y-3">
                            {packages.map((pkg) => (
                                <PackageCard key={pkg.packageId} pkg={pkg} />
                            ))}
                        </div>
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
}
