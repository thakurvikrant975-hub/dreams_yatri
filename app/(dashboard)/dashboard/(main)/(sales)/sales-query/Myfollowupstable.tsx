"use client";

import { useState } from "react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
    CalendarClock, MapPin, User, Clock,
    AlertCircle, CheckCircle2, Inbox,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Input } from "@/components/ui/input";

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

export function MyFollowUpsTable({ followUps }: Props) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");

    const now = new Date();

    const filtered = followUps.filter(fu => {
        const s = search.toLowerCase();
        const matchSearch = !search
            || fu.note.toLowerCase().includes(s)
            || fu.packageQuery.name.toLowerCase().includes(s)
            || (fu.packageQuery.destination ?? "").toLowerCase().includes(s);

        const matchFilter = (() => {
            if (filter === "all") return true;
            if (!fu.followUpAt) return filter === "all";
            const d = new Date(fu.followUpAt);
            if (filter === "overdue") return isPast(d) && !isToday(d);
            if (filter === "today") return isToday(d);
            if (filter === "upcoming") return d > now && !isToday(d);
            return true;
        })();

        return matchSearch && matchFilter;
    });

    // Sort: overdue first, then today, then upcoming, then no date
    const sorted = [...filtered].sort((a, b) => {
        const da = a.followUpAt ? new Date(a.followUpAt).getTime() : Infinity;
        const db = b.followUpAt ? new Date(b.followUpAt).getTime() : Infinity;
        return da - db;
    });

    const overdueCount = followUps.filter(fu =>
        fu.followUpAt && isPast(new Date(fu.followUpAt)) && !isToday(new Date(fu.followUpAt))
    ).length;

    const todayCount = followUps.filter(fu =>
        fu.followUpAt && isToday(new Date(fu.followUpAt))
    ).length;

    function getFollowUpStatus(fu: FollowUpWithQuery) {
        if (!fu.followUpAt) return "no-date";
        const d = new Date(fu.followUpAt);
        if (isPast(d) && !isToday(d)) return "overdue";
        if (isToday(d)) return "today";
        return "upcoming";
    }

    function getStatusBadge(fu: FollowUpWithQuery) {
        const status = getFollowUpStatus(fu);
        if (status === "overdue") return (
            <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-2.5 w-2.5" /> Overdue
            </Badge>
        );
        if (status === "today") return (
            <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-200 bg-amber-50">
                <Clock className="h-2.5 w-2.5" /> Today
            </Badge>
        );
        if (status === "upcoming") return (
            <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/30 bg-primary/5">
                <CalendarClock className="h-2.5 w-2.5" /> Upcoming
            </Badge>
        );
        return null;
    }

    return (
        <div className="space-y-4">
            {/* Summary chips */}
            {(overdueCount > 0 || todayCount > 0) && (
                <div className="flex gap-2 flex-wrap">
                    {overdueCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {overdueCount} overdue follow-up{overdueCount > 1 ? "s" : ""}
                        </div>
                    )}
                    {todayCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {todayCount} due today
                        </div>
                    )}
                </div>
            )}

            {/* Search + filter */}
            <div className="flex gap-3 flex-wrap">
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search follow-ups, lead names..."
                    className="max-w-sm text-sm"
                />
                <div className="flex gap-1.5">
                    {(["all", "overdue", "today", "upcoming"] as const).map(f => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={[
                                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                filter === f
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                            ].join(" ")}
                        >
                            {f === "all" ? `All (${followUps.length})`
                                : f === "overdue" ? `Overdue (${overdueCount})`
                                : f === "today" ? `Today (${todayCount})`
                                : "Upcoming"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Follow-up cards */}
            {sorted.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                    <Inbox className="h-10 w-10" />
                    <p className="text-sm font-medium">No follow-ups found</p>
                    <p className="text-xs">
                        {search
                            ? "Try adjusting your search"
                            : "Add follow-ups from your query list to track them here"}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sorted.map(fu => {
                        const status = getFollowUpStatus(fu);
                        return (
                            <div
                                key={fu.id}
                                className={[
                                    "rounded-xl border bg-card p-4 space-y-2.5 transition-all",
                                    status === "overdue" ? "border-destructive/20 bg-destructive/5" : "",
                                    status === "today" ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/10" : "",
                                ].join(" ")}
                            >
                                {/* Header: lead name + status badge */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <a
                                                href={`/dashboard/sales-query?id=${fu.packageQuery.id}`}
                                                className="text-sm font-semibold hover:text-primary transition-colors truncate"
                                            >
                                                {fu.packageQuery.name}
                                            </a>
                                        </div>
                                        {fu.packageQuery.destination && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground pl-5">
                                                <MapPin className="h-3 w-3" />
                                                {fu.packageQuery.destination}
                                            </div>
                                        )}
                                    </div>
                                    <div className="shrink-0">{getStatusBadge(fu)}</div>
                                </div>

                                {/* Note */}
                                <p className="text-sm text-foreground/80 leading-relaxed pl-5">
                                    {fu.note}
                                </p>

                                {/* Footer: dates */}
                                <div className="flex items-center justify-between gap-2 flex-wrap pl-5">
                                    <p className="text-[11px] text-muted-foreground">
                                        Logged{" "}
                                        {formatDistanceToNow(new Date(fu.createdAt), { addSuffix: true })}
                                    </p>
                                    {fu.followUpAt && (
                                        <span
                                            className={[
                                                "flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 border",
                                                status === "overdue"
                                                    ? "text-destructive bg-destructive/5 border-destructive/20"
                                                    : status === "today"
                                                        ? "text-amber-700 bg-amber-50 border-amber-200"
                                                        : "text-primary bg-primary/5 border-primary/20",
                                            ].join(" ")}
                                        >
                                            <CalendarClock className="h-3 w-3" />
                                            {format(new Date(fu.followUpAt), "dd MMM yyyy, hh:mm a")}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}