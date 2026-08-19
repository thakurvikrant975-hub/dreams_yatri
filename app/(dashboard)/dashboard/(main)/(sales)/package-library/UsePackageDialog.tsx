"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2, Search, MapPin, Phone } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { cn } from "@/app/lib/utils";
import { getPackageVariantOptions, type LibraryPackage, type PackageVariantOptions } from "./actions";
import { copyPackageIntoDraft, type QueryRow } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

export function UsePackageDialog({ pkg, pendingQueries, children }: {
    pkg:            LibraryPackage;
    pendingQueries: QueryRow[];
    children:       React.ReactNode;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const [variants, setVariants] = useState<PackageVariantOptions | null>(null);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [durationSlug, setDurationSlug] = useState("");
    const [routeSlug, setRouteSlug] = useState("");
    const [staySlug, setStaySlug] = useState("");

    const [queryFilter, setQueryFilter] = useState("");
    const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);

    // Load variant options once when the dialog opens, defaulting to the
    // package's default duration.
    useEffect(() => {
        if (!open) return;
        setLoadingVariants(true);
        getPackageVariantOptions(pkg.slug, pkg.durationSlug ?? "").then((data) => {
            setVariants(data);
            if (data) {
                setDurationSlug(data.selectedDurationSlug);
                setRouteSlug(data.selectedRouteSlug);
                setStaySlug(data.selectedStaySlug);
            }
            setLoadingVariants(false);
        });
    }, [open, pkg.slug, pkg.durationSlug]);

    // Changing duration reloads the routes available for it (route/stay reset
    // to that duration's defaults, mirroring the live package page).
    function handleDurationChange(next: string) {
        setDurationSlug(next);
        setLoadingVariants(true);
        getPackageVariantOptions(pkg.slug, next).then((data) => {
            setVariants(data);
            if (data) {
                setRouteSlug(data.selectedRouteSlug);
                setStaySlug(data.selectedStaySlug);
            }
            setLoadingVariants(false);
        });
    }

    const filteredQueries = useMemo(() => {
        const q = queryFilter.trim().toLowerCase();
        if (!q) return pendingQueries;
        return pendingQueries.filter((query) =>
            query.name.toLowerCase().includes(q) ||
            (query.destination ?? "").toLowerCase().includes(q) ||
            query.phone.includes(q),
        );
    }, [pendingQueries, queryFilter]);

    async function handleApply() {
        if (!selectedQueryId) return;
        setApplying(true);
        try {
            const payload = await copyPackageIntoDraft(pkg.slug, durationSlug, routeSlug, staySlug);
            // See CreatePackageDialog's handleUseTemplate for why this can't
            // just silently proceed — a null payload used to still navigate
            // to a completely empty draft with no indication of failure.
            if (!payload) {
                toast.error(`Couldn't load "${pkg.title}" as a template — try again.`);
                return;
            }
            sessionStorage.setItem(`pkgCopyPayload:${selectedQueryId}`, JSON.stringify(payload));
            router.push(`/dashboard/package-builder-v2/${selectedQueryId}`);
        } finally {
            setApplying(false);
        }
    }

    function resetState(next: boolean) {
        setOpen(next);
        if (!next) {
            setVariants(null);
            setQueryFilter("");
            setSelectedQueryId(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={resetState}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles size={15} className="text-dashboard-primary" /> Use &quot;{pkg.title}&quot;
                    </DialogTitle>
                    <DialogDescription>
                        Pick which version to copy, then choose the query it&apos;s for.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {loadingVariants && !variants ? (
                        <div className="flex items-center justify-center py-6 text-dashboard-base-content/50 text-sm gap-2">
                            <Loader2 size={14} className="animate-spin" /> Loading package details…
                        </div>
                    ) : !variants ? (
                        <p className="text-sm text-dashboard-error">Couldn&apos;t load this package&apos;s details.</p>
                    ) : (
                        <>
                            {/* Variant pickers */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {variants.durations.length > 1 && (
                                    <div>
                                        <label className="text-xs font-medium text-dashboard-base-content/70 mb-1 block">Duration</label>
                                        <Select value={durationSlug} onValueChange={handleDurationChange}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {variants.durations.map((d) => (
                                                    <SelectItem key={d.slug} value={d.slug}>{d.label} ({d.days}D/{d.nights}N)</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {variants.routes.length > 1 && (
                                    <div>
                                        <label className="text-xs font-medium text-dashboard-base-content/70 mb-1 block">Route</label>
                                        <Select value={routeSlug} onValueChange={setRouteSlug}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {variants.routes.map((r) => (
                                                    <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {variants.stayCategories.length > 1 && (
                                    <div>
                                        <label className="text-xs font-medium text-dashboard-base-content/70 mb-1 block">Stay Category</label>
                                        <Select value={staySlug} onValueChange={setStaySlug}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {variants.stayCategories.map((s) => (
                                                    <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* Target query picker */}
                            <div>
                                <label className="text-xs font-medium text-dashboard-base-content/70 mb-1.5 block">
                                    Apply to which query?
                                </label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dashboard-base-content/40" />
                                    <Input
                                        value={queryFilter}
                                        onChange={(e) => setQueryFilter(e.target.value)}
                                        placeholder="Search by name, destination, phone…"
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto rounded-lg border border-dashboard-base-300 divide-y divide-dashboard-base-300">
                                    {filteredQueries.length === 0 ? (
                                        <p className="text-xs text-dashboard-base-content/40 italic text-center py-4">
                                            No pending queries match.
                                        </p>
                                    ) : (
                                        filteredQueries.map((q) => (
                                            <button
                                                key={q.id}
                                                type="button"
                                                onClick={() => setSelectedQueryId(q.id)}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
                                                    selectedQueryId === q.id
                                                        ? "bg-dashboard-primary/10"
                                                        : "hover:bg-dashboard-base-200/60",
                                                )}
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-dashboard-base-content truncate">{q.name}</p>
                                                    <div className="flex items-center gap-2 text-[11px] text-dashboard-base-content/50">
                                                        {q.destination && <span className="flex items-center gap-0.5"><MapPin size={9} /> {q.destination}</span>}
                                                        <span className="flex items-center gap-0.5"><Phone size={9} /> {q.phone}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <Button type="button" variant="outline" onClick={() => resetState(false)}>Cancel</Button>
                                <Button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={!selectedQueryId || applying}
                                    className="gap-1.5"
                                >
                                    {applying && <Loader2 size={13} className="animate-spin" />}
                                    Open Builder
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
