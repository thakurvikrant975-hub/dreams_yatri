"use client";

import { useState, useTransition } from "react";
import {
    History, Check, Pencil, Trash2, Power, PowerOff,
    AlertCircle, Loader2, ArrowRight,
} from "lucide-react";
import { Button } from "../ui/button";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../ui/sheet";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HistoryEntry = {
    id:           string;
    action:       string;
    description:  string | null;
    userName:     string | null;
    userEmail:    string | null;
    previousData: unknown;
    newData:      unknown;
    metadata:     unknown;
    status:       string;
    actionAt:     Date;
};

type ActorInfo = {
    label: string;
    name?:  string | null;
    at?:    Date | string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name?: string | null): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatValue(v: unknown): string {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    return String(v);
}

const ACTION_META: Record<string, { label: string; icon: typeof Check; className: string }> = {
    CREATE: {
        label: "Created",
        icon:  Check,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400",
    },
    DELETE: {
        label: "Deleted",
        icon:  Trash2,
        className: "border-destructive/20 bg-destructive/5 text-destructive",
    },
    UPDATE: {
        label: "Updated",
        icon:  Pencil,
        className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-400",
    },
};

function getActionMeta(entry: HistoryEntry) {
    const meta = entry.metadata as Record<string, unknown> | null;
    if (meta?.operation === "toggle_active") {
        const nd = entry.newData as { is_active?: boolean } | null;
        return nd?.is_active
            ? { label: "Activated",   icon: Power,     className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400" }
            : { label: "Deactivated", icon: PowerOff,  className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400" };
    }
    return ACTION_META[entry.action] ?? ACTION_META.UPDATE;
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, name, at }: ActorInfo) {
    return (
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs font-semibold bg-dashboard-primary/10 text-dashboard-primary">
                    {initials(name)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
                <p className="text-sm font-medium leading-tight truncate">{name ?? "Unknown"}</p>
                {at && (
                    <p
                        className="text-[11px] text-muted-foreground leading-tight mt-0.5"
                        title={format(new Date(at), "PPpp")}
                    >
                        {formatDistanceToNow(new Date(at), { addSuffix: true })}
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Change diff ───────────────────────────────────────────────────────────────

function ChangeSummary({ entry }: { entry: HistoryEntry }) {
    const prev = entry.previousData as Record<string, unknown> | null;
    const next = entry.newData     as Record<string, unknown> | null;

    if (!prev && !next) return null;

    const changed = Object.keys({ ...prev, ...next }).filter(
        (k) => k !== "is_active" && JSON.stringify(prev?.[k]) !== JSON.stringify(next?.[k])
    );

    if (changed.length === 0) return null;

    return (
        <div className="mt-2 rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden">
            {changed.map((k) => (
                <div key={k} className="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-muted/30">
                    <span className="font-medium capitalize text-foreground/60 w-24 shrink-0">
                        {k.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {prev?.[k] !== undefined && (
                            <span className="line-through text-muted-foreground/70 truncate">
                                {formatValue(prev[k])}
                            </span>
                        )}
                        {prev?.[k] !== undefined && next?.[k] !== undefined && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        {next?.[k] !== undefined && (
                            <span className="text-foreground font-medium truncate">
                                {formatValue(next[k])}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Timeline entry ────────────────────────────────────────────────────────────

function TimelineEntry({ entry, isLast }: { entry: HistoryEntry; isLast: boolean }) {
    const { label, icon: Icon, className } = getActionMeta(entry);

    return (
        <div className="flex gap-3">
            {/* Connector line */}
            <div className="flex flex-col items-center">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2", className)}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
                {!isLast && <div className="w-px flex-1 bg-border mt-1.5" />}
            </div>

            {/* Content */}
            <div className="pb-6 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs font-medium", className)}>
                        {label}
                    </Badge>
                    <time
                        title={format(new Date(entry.actionAt), "PPpp")}
                        className="text-xs text-muted-foreground shrink-0"
                    >
                        {formatDistanceToNow(new Date(entry.actionAt), { addSuffix: true })}
                    </time>
                </div>

                {entry.status === "FAILED" && (
                    <Badge variant="destructive" className="mt-1.5 text-[10px] py-0">Failed</Badge>
                )}

                {entry.description && (
                    <p className="text-sm text-foreground/80 mt-1.5">
                        {entry.description}
                    </p>
                )}

                <ChangeSummary entry={entry} />

                <div className="flex items-center gap-1.5 mt-2.5">
                    <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-[10px] font-medium">
                            {initials(entry.userName ?? entry.userEmail)}
                        </AvatarFallback>
                    </Avatar>
                    <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium text-foreground/70">
                            {entry.userName ?? entry.userEmail ?? "Unknown"}
                        </span>
                        {entry.userName && entry.userEmail && (
                            <span className="text-muted-foreground/70"> · {entry.userEmail}</span>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HistorySheet({
    id,
    title,
    entityLabel,
    fetchHistory,
    createdBy,
    createdAt,
    updatedBy,
    updatedAt,
}: {
    /** Primary key of the entity (number for int PKs, string for BigInt PKs) */
    id: number | string;
    /** Display name shown in the sheet header, e.g. the package title */
    title: string;
    /** Lowercase singular noun used in empty-state copy, e.g. "package" */
    entityLabel: string;
    /** Server action returning ActivityLog rows for this entity */
    fetchHistory: (id: number | string) => Promise<HistoryEntry[]>;
    createdBy?: string | null;
    createdAt?: Date | string | null;
    updatedBy?: string | null;
    updatedAt?: Date | string | null;
}) {
    const [open, setOpen]             = useState(false);
    const [history, setHistory]       = useState<HistoryEntry[]>([]);
    const [loaded, setLoaded]         = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleOpen(o: boolean) {
        setOpen(o);
        if (o && !loaded) {
            startTransition(async () => {
                const result = await fetchHistory(id);
                setHistory(result);
                setLoaded(true);
            });
        }
    }

    const showSummary = Boolean(createdBy || updatedBy);

    return (
        <Sheet open={open} onOpenChange={handleOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="View timeline"
                >
                    <History className="h-3.5 w-3.5" />
                </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
                <SheetHeader className="shrink-0 border-b border-border/60 px-6 py-4 gap-1">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <History className="h-4 w-4 text-muted-foreground" />
                        Timeline
                    </SheetTitle>
                    <p className="text-sm font-medium text-foreground/80 truncate">{title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{entityLabel} activity log</p>
                </SheetHeader>

                {showSummary && (
                    <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2 px-6 py-3 border-b border-border/60 bg-muted/30">
                        {createdBy && (
                            <SummaryCard label="Created by" name={createdBy} at={createdAt} />
                        )}
                        {updatedBy && (
                            <SummaryCard label="Last edited by" name={updatedBy} at={updatedAt} />
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {isPending ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">Loading timeline…</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <AlertCircle className="h-8 w-8" />
                            <p className="text-sm font-medium">No history yet</p>
                            <p className="text-xs">Actions on this {entityLabel} will appear here</p>
                        </div>
                    ) : (
                        <div>
                            {history.map((entry, i) => (
                                <TimelineEntry
                                    key={entry.id}
                                    entry={entry}
                                    isLast={i === history.length - 1}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
