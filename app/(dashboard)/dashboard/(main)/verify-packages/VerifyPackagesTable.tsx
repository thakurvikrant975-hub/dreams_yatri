"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Clock, CheckCircle2, XCircle, Send, MessageSquare, Check } from "lucide-react";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export type PackageRow = {
    id: string;
    title: string;
    destination: string;
    totalDays: number;
    totalNights: number;
    travelDate: Date | null;
    adults: number;
    children: number;
    infants: number;
    pricePerPerson: number | null;
    totalPrice: number | null;
    currency: string;
    status: string;
    builtByName: string | null;
    sentAt: Date | null;
    readyAt: Date | null;
    readyByName: string | null;
    readyNote: string | null;
    viewedAt: Date | null;
    viewCount: number;
    verified: boolean;
    verifiedAt: Date | null;
    verifiedByName: string | null;
    rejectedAt: Date | null;
    rejectedByName: string | null;
    rejectionReasonLabel: string | null;
    client: { id: string; name: string; phone: string; email: string | null } | null;
};

export type PackageStats = {
    total: number;
    pending: number;
    verified: number;
    rejected: number;
    verifiedToday: number;
};

const fmtDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d)) : "—";
const inr = (n: number | null) => n != null ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—";

function StatusPill({ status }: { status: string }) {
    const styles: Record<string, string> = {
        SENT:     "bg-blue-100 text-blue-700",
        READY:    "bg-amber-100 text-amber-700",
        DRAFT:    "bg-dashboard-base-300 text-dashboard-base-content",
        ACCEPTED: "bg-green-100 text-green-700",
        DECLINED: "bg-red-100 text-red-700",
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] ?? "bg-dashboard-base-300 text-dashboard-base-content"}`}>
            {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
    );
}

function VerificationBadge({ row }: { row: PackageRow }) {
    if (row.verified) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <CheckCircle2 className="size-3" /> Verified
            </span>
        );
    }
    if (row.rejectedAt) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                title={row.rejectionReasonLabel ?? undefined}
            >
                <XCircle className="size-3" /> Rejected
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            <Clock className="size-3" /> Pending
        </span>
    );
}

export function VerifyPackagesTable({
    packages,
    stats,
    currentPage,
    totalPages,
    totalCount,
    limit,
    search,
    filter,
}: {
    packages: PackageRow[];
    stats: PackageStats;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    filter: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleSearch(value: string) {
        updateParam("search", value);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} package${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<PackageRow>[] = [
        {
            header: "Package",
            sortKey: (p) => p.title?.toLowerCase() ?? "",
            cell: (p) => (
                <div>
                    <div className="flex items-center gap-1.5">
                        <Link
                            href={`/dashboard/verify-packages/${p.id}`}
                            className="font-semibold text-dashboard-primary hover:underline text-sm line-clamp-1"
                        >
                            {p.title}
                        </Link>
                        {p.readyNote && (
                            <span title={p.readyNote} className="shrink-0">
                                <MessageSquare className="size-3.5 text-dashboard-primary" />
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-dashboard-neutral">
                        {p.destination} · {p.totalDays}D/{p.totalNights}N
                    </div>
                </div>
            ),
        },
        {
            header: "Client",
            sortKey: (p) => p.client?.name?.toLowerCase() ?? "",
            cell: (p) => (
                <div>
                    <div className="text-sm font-medium text-dashboard-base-content">{p.client?.name ?? "—"}</div>
                    <div className="text-xs text-dashboard-neutral">{p.client?.phone ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Sent / Ready",
            sortKey: (p) => (p.sentAt ?? p.readyAt) ? new Date((p.sentAt ?? p.readyAt)!).getTime() : 0,
            cell: (p) => (
                <div>
                    <div className="flex items-center gap-1 text-sm text-dashboard-base-content whitespace-nowrap">
                        <Send className="size-3 text-dashboard-neutral shrink-0" /> {fmtDate(p.sentAt ?? p.readyAt)}
                        {!p.sentAt && <span className="text-[10px] font-medium text-amber-600">(ready)</span>}
                    </div>
                    <div className="text-xs text-dashboard-neutral mt-0.5">by {p.builtByName ?? "—"}</div>
                </div>
            ),
        },
        {
            header: "Price",
            align: "right",
            sortKey: (p) => p.totalPrice ?? 0,
            cell: (p) => (
                <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-dashboard-base-content">{inr(p.totalPrice)}</div>
                    <div className="text-[11px] text-dashboard-neutral">{inr(p.pricePerPerson)}/person</div>
                </div>
            ),
        },
        {
            header: "Status",
            align: "center",
            width: "w-[130px]",
            cell: (p) => (
                <div className="flex flex-col items-center gap-1">
                    <StatusPill status={p.status} />
                    <VerificationBadge row={p} />
                </div>
            ),
        },
        {
            header: "Action",
            align: "right",
            width: "w-[110px]",
            cell: (p) => (
                // The classic /verify-packages/[id] screen's "Approve →" link
                // used to sit next to this one — dropped in favor of this
                // single entry point, which opens the same package in the
                // builder's review workspace (CostingDecisionButtons there
                // calls the identical approveCustomPackage/rejectCustomPackage
                // actions this list used to link out to directly).
                //
                // New tab: opening it leaves the queue exactly as the
                // reviewer left it — same page, same filter, same scroll —
                // to come back to. `rel="noopener"` rather than "noreferrer",
                // because the editor's back control reads document.referrer
                // to return here.
                <div className="inline-flex items-center justify-end">
                    <Link
                        href={`/dashboard/package-builder/${p.id}/review`}
                        target="_blank"
                        rel="noopener"
                        title="Review in the editor — correct the itinerary where it sits, then approve or reject"
                        className="inline-flex items-center gap-1 justify-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                        <Check className="size-3" /> Approve
                    </Link>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Stats */}
            <StatGrid cols={5}>
                <StatCard label="Total Sent"      value={stats.total}         icon={Send} />
                <StatCard label="Pending Review"  value={stats.pending}       icon={Clock} />
                <StatCard label="Verified"        value={stats.verified}      icon={ShieldCheck} />
                <StatCard label="Rejected"        value={stats.rejected}      icon={XCircle} />
                <StatCard label="Verified Today"  value={stats.verifiedToday} icon={CheckCircle2} />
            </StatGrid>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={search}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search package title, client name or phone…"
                    className="flex-1"
                    filters={[
                        {
                            value: filter,
                            onChange: (v) => updateParam("filter", v),
                            placeholder: "All packages",
                            width: "w-40",
                            options: [
                                { label: "Pending review", value: "pending" },
                                { label: "Verified",       value: "verified" },
                                { label: "Rejected",       value: "rejected" },
                            ],
                        },
                    ]}
                />
                <Select
                    value={String(limit)}
                    onValueChange={(v) => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("limit", v);
                        params.delete("page");
                        startTransition(() => router.replace(`?${params.toString()}`));
                    }}
                >
                    <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg focus:ring-dashboard-primary/30 focus:border-dashboard-primary">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                        {[10, 20, 50].map((n) => (
                            <SelectItem key={n} value={String(n)} className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer">
                                {n} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <DataTable
                data={packages}
                columns={columns}
                rowKey={(p) => p.id}
                rowClassName={(p) => (p.verified ? "bg-green-50/40 hover:bg-green-50" : p.rejectedAt ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-dashboard-base-200")}
                emptyState={
                    <TableEmptyState
                        title="No sent packages found"
                        description="Packages appear here once a sales exec sends one to a client."
                    />
                }
                pagination={{
                    currentPage,
                    totalPages,
                    buildHref,
                    label: paginationLabel,
                }}
            />
        </div>
    );
}
