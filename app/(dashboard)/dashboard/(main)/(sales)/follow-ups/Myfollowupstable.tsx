"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
    CalendarClock, MapPin, User, Clock,
    AlertCircle, Inbox, Trash2, Loader2,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "../../components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { deleteFollowUp } from "../sales-query/actions"; // ← add this server action
import { toast } from "sonner";

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

type Props = {
    followUps: FollowUpWithQuery[];
};

type FilterType = "all" | "overdue" | "today" | "upcoming";

export function MyFollowUpsTable({ followUps: initialFollowUps }: Props) {
    const [followUps, setFollowUps] = useState(initialFollowUps);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const now = new Date();

    function getFollowUpStatus(fu: FollowUpWithQuery): FollowUpStatus {
        if (!fu.followUpAt) return "no-date";
        const d = new Date(fu.followUpAt);
        if (isPast(d) && !isToday(d)) return "overdue";
        if (isToday(d)) return "today";
        return "upcoming";
    }

    const overdueCount = followUps.filter(fu => getFollowUpStatus(fu) === "overdue").length;
    const todayCount   = followUps.filter(fu => getFollowUpStatus(fu) === "today").length;
    const upcomingCount = followUps.filter(fu => getFollowUpStatus(fu) === "upcoming").length;

    const filtered = followUps.filter(fu => {
        const s = search.toLowerCase();
        const matchSearch =
            !search ||
            fu.note.toLowerCase().includes(s) ||
            fu.packageQuery.name.toLowerCase().includes(s) ||
            (fu.packageQuery.destination ?? "").toLowerCase().includes(s);

        const status = getFollowUpStatus(fu);
        const matchFilter: boolean =
            filter === "all"
                ? true
                : filter === "overdue"
                ? status === "overdue"
                : filter === "today"
                ? status === "today"
                : filter === "upcoming"
                ? status === "upcoming"
                : true;

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

    function getStatusBadge(status: FollowUpStatus) {
        if (status === "overdue") return (
            <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-2.5 w-2.5" /> Overdue
            </Badge>
        );
        if (status === "today") return (
            <Badge variant="outline" className="text-[10px] gap-1 text-amber-700 border-amber-300/50 bg-amber-50 dark:bg-amber-950/20">
                <Clock className="h-2.5 w-2.5" /> Due Today
            </Badge>
        );
        if (status === "upcoming") return (
            <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/30 bg-primary/5">
                <CalendarClock className="h-2.5 w-2.5" /> Upcoming
            </Badge>
        );
        return null;
    }

    const filters: { key: FilterType; label: string; count?: number }[] = [
        { key: "all",      label: "All",      count: followUps.length },
        { key: "overdue",  label: "Overdue",  count: overdueCount },
        { key: "today",    label: "Today",    count: todayCount },
        { key: "upcoming", label: "Upcoming", count: upcomingCount },
    ];

    return (
        <div className="space-y-4">
            {/* Alert chips */}
            {(overdueCount > 0 || todayCount > 0) && (
                <div className="flex gap-2 flex-wrap">
                    {overdueCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {overdueCount} overdue follow-up{overdueCount > 1 ? "s" : ""}
                        </div>
                    )}
                    {todayCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {todayCount} due today
                        </div>
                    )}
                </div>
            )}

            {/* Search + filter bar */}
            <div className="flex gap-3 items-center">
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by lead, destination, or note…"
                    className="w-full text-sm h-9 rounded-md ring-1 ring-gray-200"
                />
                <div className="flex gap-1">
                    {filters.map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className={[
                                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                filter === f.key
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                            ].join(" ")}
                        >
                            {f.label}
                            {f.count !== undefined && (
                                <span className={[
                                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                    filter === f.key
                                        ? "bg-white/20 text-primary-foreground"
                                        : "bg-muted text-muted-foreground",
                                ].join(" ")}>
                                    {f.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cards */}
            {sorted.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground rounded-xl border bg-muted/20">
                    <Inbox className="h-10 w-10 opacity-40" />
                    <p className="text-sm font-medium">No follow-ups found</p>
                    <p className="text-xs opacity-70">
                        {search ? "Try adjusting your search" : "Add follow-ups from your query list to track them here"}
                    </p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {sorted.map(fu => {
                        const status = getFollowUpStatus(fu);
                        const isDeleting = deletingId === fu.id && isPending;

                        return (
                            <div
                                key={fu.id}
                                className={[
                                    "group rounded-xl border bg-card p-4 transition-all",
                                    status === "overdue" ? "border-destructive/25 bg-destructive/[0.03]" : "",
                                    status === "today"   ? "border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800/30" : "",
                                    status === "upcoming" || status === "no-date" ? "hover:border-primary/20" : "",
                                    isDeleting ? "opacity-50 pointer-events-none" : "",
                                ].join(" ")}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Left accent bar */}
                                    <div className={[
                                        "mt-0.5 w-1 self-stretch rounded-full shrink-0",
                                        status === "overdue"  ? "bg-destructive/60" : "",
                                        status === "today"    ? "bg-amber-400" : "",
                                        status === "upcoming" ? "bg-primary/50" : "",
                                        status === "no-date"  ? "bg-muted-foreground/30" : "",
                                    ].join(" ")} />

                                    <div className="flex-1 min-w-0 space-y-2">
                                        {/* Header row */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="">
                                                    <a
                                                        href={`/dashboard/sales-query?id=${fu.packageQuery.id}`}
                                                        className="text-sm font-semibold hover:text-primary transition-colors truncate"
                                                    >
                                                        {fu.packageQuery.name}
                                                    </a>
                                                </div>
                                                {fu.packageQuery.destination && (
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <MapPin className="h-3 w-3" />
                                                        {fu.packageQuery.destination}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {getStatusBadge(status)}

                                                {/* Delete button */}
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            {isDeleting
                                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                : <Trash2 className="h-3.5 w-3.5" />
                                                            }
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Follow-Up?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete the follow-up for{" "}
                                                                <strong>{fu.packageQuery.name}</strong>. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className="bg-destructive hover:bg-destructive/90"
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
                                        <p className="text-sm text-foreground/75 leading-relaxed">
                                            {fu.note}
                                        </p>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <p className="text-[11px] text-muted-foreground">
                                                Logged{" "}
                                                {formatDistanceToNow(new Date(fu.createdAt), { addSuffix: true })}
                                            </p>
                                            {fu.followUpAt && (
                                                <span className={[
                                                    "flex items-center gap-1 text-[11px] rounded-md px-2 py-0.5 border font-medium",
                                                    status === "overdue"
                                                        ? "text-destructive bg-destructive/5 border-destructive/20"
                                                        : status === "today"
                                                        ? "text-amber-700 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40"
                                                        : "text-primary bg-primary/5 border-primary/20",
                                                ].join(" ")}>
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