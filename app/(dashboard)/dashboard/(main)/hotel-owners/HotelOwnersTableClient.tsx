"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldAlert, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "../components/ui/badge";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import type { HotelOwnerListItem, OwnerVerifiedFilter } from "./actions";

function VerifiedBadge({ verified }: { verified: boolean }) {
    return verified ? (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
            <ShieldCheck className="size-3" />
            Verified
        </Badge>
    ) : (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
            <ShieldAlert className="size-3" />
            Unverified
        </Badge>
    );
}

const STATUS_CLASS: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    PENDING_VERIFICATION: "bg-slate-500/10 text-slate-600 border-slate-200",
    SUSPENDED: "bg-red-500/10 text-red-600 border-red-200",
    REJECTED: "bg-red-500/10 text-red-600 border-red-200",
};

function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant="outline" className={STATUS_CLASS[status] ?? "bg-muted text-muted-foreground"}>
            {status.replace(/_/g, " ")}
        </Badge>
    );
}

export function HotelOwnersTableClient({
    owners,
    totalCount,
    limit,
    currentPage,
    search,
    verified,
}: {
    owners: HotelOwnerListItem[];
    totalCount: number;
    limit: number;
    currentPage: number;
    search: string;
    verified: OwnerVerifiedFilter;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => { setLocalSearch(search); }, [search]);

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleSearch(value: string) {
        setLocalSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => updateParam("search", value), 400);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const totalPages = Math.ceil(totalCount / limit);
    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const label = `Showing ${from}–${to} of ${totalCount} owner${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<HotelOwnerListItem>[] = [
        {
            header: "Owner",
            width: "w-[240px]",
            cell: (o) => (
                <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{o.email}</p>
                </div>
            ),
        },
        {
            header: "Business",
            cell: (o) => <span className="text-sm truncate">{o.businessName ?? "—"}</span>,
        },
        {
            header: "Phone",
            cell: (o) => <span className="text-sm text-muted-foreground">{o.phone ? `${o.phone_cc ?? ""} ${o.phone}` : "—"}</span>,
        },
        {
            header: "Properties",
            align: "center",
            cell: (o) => <span className="text-sm font-medium">{o._count.hotels}</span>,
        },
        {
            header: "Verified",
            cell: (o) => <VerifiedBadge verified={o.verifiedAt != null} />,
        },
        {
            header: "Status",
            cell: (o) => <StatusBadge status={o.status} />,
        },
        {
            header: "Joined",
            cell: (o) => (
                <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                </span>
            ),
        },
        {
            header: "",
            align: "right",
            width: "w-[40px]",
            cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <TableFilters
                    className="flex-1 min-w-0"
                    search={localSearch}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search by name, email, or business..."
                    filters={[
                        {
                            value: verified,
                            onChange: (v) => updateParam("verified", v),
                            placeholder: "All Owners",
                            width: "w-44",
                            allValue: "all",
                            options: [
                                { label: "Verified", value: "verified" },
                                { label: "Unverified", value: "unverified" },
                            ],
                        },
                    ]}
                    filteredCount={owners.length}
                    totalCount={totalCount}
                />
            </div>

            {owners.length === 0 ? (
                <TableEmptyState
                    title="No hotel owners found"
                    description="Try adjusting your filters"
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={owners}
                    rowKey={(o) => o.id}
                    onRowClick={(o) => router.push(`/dashboard/hotel-owners/${o.id}`)}
                    pagination={{ currentPage, totalPages, buildHref, label }}
                />
            )}
        </div>
    );
}
