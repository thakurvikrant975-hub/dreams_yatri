"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
    CalendarClock, MapPin, Clock,
    AlertCircle, Inbox, Trash2, Loader2,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { TableFilters, type FilterConfig } from "../../components/dashboard/Tablefilters";
import { deleteFollowUp } from "../sales-query/actions";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";

type FollowUpStatus = "overdue" | "today" | "upcoming" | "no-date";

type FollowUpWithQuery = {
    id: string;
    note: string;
    followUpAt: Date | null;
    createdAt: Date;
    createdById: string | null;
    createdByName: string | null;
    packageQuery: {
        id: string;
        name: string;
        destination: string | null;
        status: string;
    };
};

type Props = { followUps: FollowUpWithQuery[] };

// "all" maps to the TableFilters allValue; the rest mirror FollowUpStatus
type FilterType = "all" | "overdue" | "today" | "upcoming";

export function MyFollowUpsTable({ followUps: initialFollowUps }: Props) {
    const [followUps, setFollowUps] = useState(initialFollowUps);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function getFollowUpStatus(fu: FollowUpWithQuery): FollowUpStatus {
        if (!fu.followUpAt) return "no-date";
        const d = new Date(fu.followUpAt);
        if (isPast(d) && !isToday(d)) return "overdue";
        if (isToday(d)) return "today";
        return "upcoming";
    }

    const overdueCount = followUps.filter(fu => getFollowUpStatus(fu) === "overdue").length;
    const todayCount = followUps.filter(fu => getFollowUpStatus(fu) === "today").length;
    const upcomingCount = followUps.filter(fu => getFollowUpStatus(fu) === "upcoming").length;

    const filtered = followUps.filter(fu => {
        const s = search.toLowerCase();
        const matchSearch =
            !search ||
            fu.note.toLowerCase().includes(s) ||
            fu.packageQuery.name.toLowerCase().includes(s) ||
            (fu.packageQuery.destination ?? "").toLowerCase().includes(s);

        const status = getFollowUpStatus(fu);
        const matchFilter =
            filter === "all" ? true :
                filter === "overdue" ? status === "overdue" :
                    filter === "today" ? status === "today" :
                        filter === "upcoming" ? status === "upcoming" : true;

        return matchSearch && matchFilter;
    });

    const sorted = [...filtered].sort((a, b) => {
        const da = a.followUpAt ? new Date(a.followUpAt).getTime() : Infinity;
        const db = b.followUpAt ? new Date(b.followUpAt).getTime() : Infinity;
        return da - db;
    });

    async function handleDelete(id: string) {
        setDeletingId(id);
        startTransition(async () => {
            try {
                await deleteFollowUp(id);
                setFollowUps(prev => prev.filter(fu => fu.id !== id));
                toast.success("Follow-up deleted");
            } catch {
                toast.error("Failed to delete follow-up");
            } finally {
                setDeletingId(null);
            }
        });
    }

    // ── Status badge ──────────────────────────────────────────────────────────
    function getStatusBadge(status: FollowUpStatus) {
        if (status === "overdue") return (
            <Badge variant="outline" className="text-[10px] gap-1 border-dashboard-error bg-dashboard-error text-dashboard-neutral rounded-md">
                <AlertCircle className="h-2.5 w-2.5" /> Overdue
            </Badge>
        );
        if (status === "today") return (
            <Badge variant="outline" className="text-[10px] gap-1 border-dashboard-warning bg-dashboard-warning text-dashboard-neutral rounded-md">
                <Clock className="h-2.5 w-2.5" /> Due Today
            </Badge>
        );
        if (status === "upcoming") return (
            <Badge variant="outline" className="text-[10px] gap-1 border-dashboard-primary bg-dashboard-primary text-dashboard-neutral rounded-md">
                <CalendarClock className="h-2.5 w-2.5" /> Upcoming
            </Badge>
        );
        return null;
    }

    // ── TableFilters config ───────────────────────────────────────────────────
    const statusFilter: FilterConfig = {
        value: filter,
        onChange: (val) => setFilter(val as FilterType),
        placeholder: "All statuses",
        allValue: "all",
        width: "w-44",
        options: [
            { label: `Overdue (${overdueCount})`, value: "overdue" },
            { label: `Today (${todayCount})`, value: "today" },
            { label: `Upcoming (${upcomingCount})`, value: "upcoming" },
        ],
    };

    // ── Accent bar color per status ───────────────────────────────────────────
    const accentBar: Record<FollowUpStatus, string> = {
        overdue: "bg-dashboard-error/60",
        today: "bg-dashboard-warning",
        upcoming: "bg-dashboard-primary/50",
        "no-date": "bg-dashboard-base-300",
    };

    // ── Card border + bg per status ───────────────────────────────────────────
    const cardStyle: Record<FollowUpStatus, string> = {
        overdue: "border-dashboard-error/20 bg-dashboard-error/[0.02]",
        today: "border-dashboard-warning/30 bg-dashboard-warning/[0.03]",
        upcoming: "border-dashboard-base-300 hover:border-dashboard-primary/20",
        "no-date": "border-dashboard-base-300 hover:border-dashboard-base-300",
    };

    // ── Date pill per status ──────────────────────────────────────────────────
    const datePill: Record<FollowUpStatus, string> = {
        overdue: "text-dashboard-error bg-dashboard-error border-dashboard-error",
        today: "text-dashboard-neutral bg-dashboard-warning border-dashboard-warning",
        upcoming: "text-dashboard-neutral bg-dashboard-primary border-dashboard-primary",
        "no-date": "text-dashboard-neutral bg-dashboard-base-200 border-dashboard-base-300",
    };

    return (
        <div className="space-y-4">

            {/* ── Alert chips ── */}
            {(overdueCount > 0 || todayCount > 0) && (
                <div className="flex gap-2 flex-wrap">
                    {overdueCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-dashboard-neutral bg-dashboard-error border border-dashboard-error rounded-lg px-3 py-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {overdueCount} overdue follow-up{overdueCount > 1 ? "s" : ""}
                        </div>
                    )}
                    {todayCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-dashboard-neutral bg-dashboard-warning border border-dashboard-warning rounded-lg px-3 py-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {todayCount} due today
                        </div>
                    )}
                </div>
            )}

            {/* ── Search + filter bar (TableFilters) ── */}
            <TableFilters
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by lead, destination, or note…"
                filters={[statusFilter]}
                filteredCount={sorted.length}
                totalCount={followUps.length}
            />

            {/* ── Empty state ── */}
            {sorted.length === 0 ? (
                <div className="bg-white p-4 py-12 rounded-xl border border-dashboard-base-300">
                <TableEmptyState
                    description={"No follow-ups found... they ghosted harder than your crush 👻"}
                    title="No follow-up found"

                />
                </div>
            ) : (
                <div className="space-y-2.5">
                    {sorted.map(fu => {
                        const status = getFollowUpStatus(fu);
                        const isDeleting = deletingId === fu.id && isPending;

                        return (
                            <div
                                key={fu.id}
                                className={cn(
                                    "group rounded-xl border p-4 transition-all duration-150",
                                    "bg-dashboard-base-100",
                                    isDeleting && " pointer-events-none"
                                )}
                            >
                                <div className="flex items-start gap-3">

                                    {/* Accent bar */}
                                    <div className={cn(
                                        "mt-0.5 w-[3px] self-stretch rounded-full shrink-0",
                                        accentBar[status]
                                    )} />

                                    <div className="flex-1 min-w-0 space-y-2">

                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5 min-w-0">
                                                <a
                                                    href={`/dashboard/sales-query?id=${fu.packageQuery.id}`}
                                                    className="text-sm font-semibold text-dashboard-base-content hover:text-dashboard-primary transition-colors truncate block"
                                                >
                                                    {fu.packageQuery.name}
                                                </a>
                                                {fu.packageQuery.destination && (
                                                    <div className="flex items-center gap-1 text-xs text-dashboard-base-content/45">
                                                        <MapPin className="h-3 w-3 shrink-0" />
                                                        {fu.packageQuery.destination}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {getStatusBadge(status)}

                                                {/* Delete */}
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 group-hover:opacity-100 transition-opacity text-dashboard-error hover:text-dashboard-error bg-dashboard-error/10 hover:bg-dashboard-error/20"
                                                        >
                                                            {isDeleting
                                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                : <Trash2 className="h-3.5 w-3.5" />
                                                            }
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-dashboard-base-100 border-dashboard-base-300 rounded-2xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-dashboard-base-content">
                                                                Delete Follow-Up?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription className="text-dashboard-base-content/55">
                                                                This will permanently delete the follow-up for{" "}
                                                                <strong className="text-dashboard-base-content">
                                                                    {fu.packageQuery.name}
                                                                </strong>. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content hover:bg-dashboard-base-200">
                                                                Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className="rounded-xl bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90"
                                                                onClick={() => handleDelete(fu.id)}
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>

                                        {/* Note */}
                                        <p className="text-sm text-dashboard-base-content/65 leading-relaxed">
                                            {fu.note}
                                        </p>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <p className="text-[11px] text-dashboard-base-content/85">
                                                Logged{" "}
                                                {formatDistanceToNow(new Date(fu.createdAt), { addSuffix: true })}
                                            </p>
                                            {fu.followUpAt && (
                                                <span className={cn(
                                                    "flex items-center gap-1 text-[11px] rounded-md px-2 py-0.5 border font-medium",
                                                    datePill[status]
                                                )}>
                                                    <CalendarClock className="h-3 w-3" />
                                                    {format(new Date(fu.followUpAt), "dd MMM yyyy, hh:mm a")}
                                                </span>
                                            )}
                                        </div>
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