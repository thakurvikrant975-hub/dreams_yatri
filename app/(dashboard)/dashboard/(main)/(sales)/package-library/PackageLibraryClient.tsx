"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, ExternalLink, Search, ImageOff, Sparkles } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import type { LibraryPackage, DestinationFilterOption } from "./actions";
import type { QueryRow } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { UsePackageDialog } from "./UsePackageDialog";
import { getCardImage } from "@/app/lib/imageUrl";

export function PackageLibraryClient({
    packages,
    destinations,
    pendingQueries,
}: {
    packages:       LibraryPackage[];
    destinations:   DestinationFilterOption[];
    pendingQueries: QueryRow[];
}) {
    const [search, setSearch] = useState("");
    const [destinationId, setDestinationId] = useState<string>("all");

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return packages.filter((p) => {
            const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.destinationName.toLowerCase().includes(q);
            const matchesDestination =
                destinationId === "all" ||
                destinations.find((d) => d.name === p.destinationName)?.id === Number(destinationId);
            return matchesSearch && matchesDestination;
        });
    }, [packages, search, destinationId, destinations]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dashboard-base-content/40" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search packages by title or destination…"
                        className="pl-9 h-9 text-sm"
                    />
                </div>
                <Select value={destinationId} onValueChange={setDestinationId}>
                    <SelectTrigger className="w-full sm:w-56 h-9 text-sm">
                        <SelectValue placeholder="All destinations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All destinations</SelectItem>
                        {destinations.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {visible.length === 0 ? (
                <TableEmptyState title="No packages found" description="No packages match your filters." />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visible.map((pkg) => {
                        const liveUrl = pkg.durationSlug
                            ? `/packages/${pkg.slug}/${pkg.durationSlug}${pkg.routeSlug ? `/${pkg.routeSlug}` : ""}`
                            : `/packages/${pkg.slug}`;

                        return (
                            <div
                                key={pkg.id}
                                className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                <div className="h-36 bg-dashboard-base-200 relative">
                                    {pkg.thumbnail ? (
                                        <Image src={getCardImage(pkg.thumbnail)} alt={pkg.title} fill className="object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-dashboard-base-content/30">
                                            <ImageOff size={22} />
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 space-y-2">
                                    <h3 className="text-sm font-bold text-dashboard-base-content line-clamp-1">{pkg.title}</h3>
                                    <p className="text-xs text-dashboard-base-content/60 flex items-center gap-1">
                                        <MapPin size={11} /> {pkg.destinationName}
                                        {pkg.regionName && <Badge variant="outline" className="ml-1 text-[10px] font-normal">{pkg.regionName}</Badge>}
                                    </p>
                                    {pkg.description && (
                                        <p className="text-xs text-dashboard-base-content/50 line-clamp-2">{pkg.description}</p>
                                    )}
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        <Link
                                            href={liveUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-primary hover:underline"
                                        >
                                            View live <ExternalLink size={11} />
                                        </Link>
                                        <UsePackageDialog pkg={pkg} pendingQueries={pendingQueries}>
                                            <Button size="sm" className="h-7 gap-1 text-xs rounded-md">
                                                <Sparkles size={11} /> Use It
                                            </Button>
                                        </UsePackageDialog>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
