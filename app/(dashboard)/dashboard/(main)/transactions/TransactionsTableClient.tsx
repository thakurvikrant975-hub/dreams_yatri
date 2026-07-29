"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { PaymentPill } from "../package-bookings/pills";
import { Badge } from "../components/ui/badge";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../components/ui/select";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function fmtDateTime(d: Date): string {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

const PURPOSE_LABEL: Record<string, string> = { INITIAL: "Initial", TOPUP: "Top-up", BALANCE: "Balance" };
const PURPOSE_TONE: Record<string, string> = {
    INITIAL: "bg-blue-100 text-blue-700",
    TOPUP: "bg-purple-100 text-purple-700",
    BALANCE: "bg-amber-100 text-amber-700",
};

export type TransactionRow = {
    id: string;
    amount_paise: number;
    gateway: string;
    method: string | null;
    status: string;
    purpose: string;
    gatewayPaymentId: string | null;
    gatewayOrderId: string | null;
    refundAmount: number | null;
    refundedAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
    paidAt: Date | null;
    booking: {
        id: string;
        bookingNumber: string;
        contactEmail: string | null;
        user: { name: string | null } | null;
        travellersList: { fullName: string }[];
        package: { title: string } | null;
    };
};

export function TransactionsTableClient({
    txns,
    totalCount,
    limit,
    currentPage,
    search,
    status,
    purpose,
    gateway,
    statusOptions,
    purposeOptions,
    gatewayOptions,
}: {
    txns: TransactionRow[];
    totalCount: number;
    limit: number;
    currentPage: number;
    search: string;
    status: string;
    purpose: string;
    gateway: string;
    statusOptions: string[];
    purposeOptions: { value: string; label: string }[];
    gatewayOptions: string[];
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // ── URL helpers ───────────────────────────────────────────────────────

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        router.push(`?${params.toString()}`);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    // ── Pagination ────────────────────────────────────────────────────────

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const label = `Showing ${from}–${to} of ${totalCount} transaction${totalCount !== 1 ? "s" : ""}`;

    // ── Columns ───────────────────────────────────────────────────────────

    const columns: ColumnDef<TransactionRow>[] = [
        {
            header: "When",
            width: "w-[150px]",
            sortKey: (t) => new Date(t.paidAt ?? t.createdAt).getTime(),
            cell: (t) => <span className="whitespace-nowrap">{fmtDateTime(t.paidAt ?? t.createdAt)}</span>,
        },
        {
            header: "Booking",
            sortKey: (t) => t.booking.bookingNumber?.toLowerCase() ?? "",
            cell: (t) => (
                <div className="min-w-0">
                    <Link href={`/dashboard/package-bookings/${t.booking.id}`} className="font-medium text-dashboard-primary hover:underline">
                        {t.booking.bookingNumber}
                    </Link>
                    {t.booking.package?.title && (
                        <p className="text-xs text-dashboard-base-content/50 truncate max-w-44">{t.booking.package.title}</p>
                    )}
                </div>
            ),
        },
        {
            header: "Customer",
            cell: (t) => (
                <div className="min-w-0">
                    <p className="text-sm text-dashboard-base-content truncate max-w-44">{t.booking.travellersList[0]?.fullName ?? t.booking.user?.name ?? "—"}</p>
                    <p className="text-xs text-dashboard-base-content/50 truncate max-w-44">{t.booking.contactEmail ?? ""}</p>
                </div>
            ),
        },
        {
            header: "Type",
            cell: (t) => (
                <Badge variant="secondary" className={`text-xs font-normal ${PURPOSE_TONE[t.purpose] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {PURPOSE_LABEL[t.purpose] ?? titleCase(t.purpose)}
                </Badge>
            ),
        },
        {
            header: "Amount",
            align: "right",
            sortKey: (t) => t.amount_paise,
            cell: (t) => (
                <div className="whitespace-nowrap">
                    <span className="font-medium text-dashboard-base-content">{formatPaiseRoundedUp(t.amount_paise)}</span>
                    {t.refundedAt && t.refundAmount != null && (
                        <p className="text-xs font-normal text-purple-600">−{formatPaiseRoundedUp(Math.round(t.refundAmount * 100))} refunded</p>
                    )}
                </div>
            ),
        },
        {
            header: "Gateway",
            cell: (t) => (
                <div>
                    <p className="text-sm text-dashboard-base-content">{titleCase(t.gateway)}</p>
                    {t.method && <p className="text-xs text-dashboard-base-content/50">{titleCase(t.method)}</p>}
                </div>
            ),
        },
        {
            header: "Status",
            cell: (t) => <PaymentPill status={t.status} />,
        },
        {
            header: "Gateway ref",
            width: "w-[190px]",
            cell: (t) => (
                <div className="text-xs text-dashboard-base-content/50 break-all">
                    {t.gatewayPaymentId ?? t.gatewayOrderId ?? "—"}
                    {t.failureReason && <p className="text-dashboard-error">{t.failureReason}</p>}
                </div>
            ),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">

            {/* Filters + rows per page */}
            <div className="flex flex-wrap items-center gap-3">
                <TableFilters
                    className="flex-1 min-w-0"
                    search={search}
                    onSearchChange={(v) => updateParam("search", v)}
                    searchPlaceholder="Search booking #, gateway ref, customer…"
                    filters={[
                        {
                            value: purpose || "all",
                            onChange: (v) => updateParam("purpose", v),
                            placeholder: "All Types",
                            width: "w-36",
                            options: purposeOptions,
                        },
                        {
                            value: status || "all",
                            onChange: (v) => updateParam("status", v),
                            placeholder: "All Statuses",
                            width: "w-44",
                            options: statusOptions.map((o) => ({ label: titleCase(o), value: o })),
                        },
                        {
                            value: gateway || "all",
                            onChange: (v) => updateParam("gateway", v),
                            placeholder: "All Gateways",
                            width: "w-36",
                            options: gatewayOptions.map((o) => ({ label: titleCase(o), value: o })),
                        },
                    ]}
                />
                <div className="flex items-center gap-2 shrink-0 rounded-lg">
                    <Select value={String(limit)} onValueChange={(v) => updateParam("limit", v)}>
                        <SelectTrigger className="w-32 cursor-pointer h-10 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg cursor-pointer">
                            <SelectItem className="cursor-pointer" value="10">10 / Page</SelectItem>
                            <SelectItem className="cursor-pointer" value="20">20 / Page</SelectItem>
                            <SelectItem className="cursor-pointer" value="50">50 / Page</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table or empty state */}
            {txns.length === 0 ? (
                <TableEmptyState
                    title="No transactions found"
                    description={totalCount === 0 ? "No payments have been recorded yet" : "Try adjusting your filters"}
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={txns}
                    rowKey={(t) => t.id}
                    pagination={{ currentPage, totalPages, buildHref, label }}
                />
            )}
        </div>
    );
}
