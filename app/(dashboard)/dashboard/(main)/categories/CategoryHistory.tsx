"use client";

import { useState, useTransition } from "react";
import { History, Check, Pencil, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../components/ui/sheet";
import { Badge } from "../components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { getCategoryHistory } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryEntry = Awaited<ReturnType<typeof getCategoryHistory>>[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ActionIcon({ action }: { action: string }) {
    if (action === "CREATE") return <Check className="h-3.5 w-3.5 text-emerald-600" />;
    if (action === "DELETE") return <Trash2 className="h-3.5 w-3.5 text-destructive" />;
    return <Pencil className="h-3.5 w-3.5 text-blue-500" />;
}

function actionColor(action: string, meta?: Record<string, unknown> | null) {
    if (action === "CREATE") return "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20";
    if (action === "DELETE") return "border-destructive/20 bg-destructive/5";
    if ((meta as Record<string, unknown> | null)?.operation === "toggle_active") {
        const nd = (meta as Record<string, unknown> | null)?.newData as { is_active?: boolean } | undefined;
        return nd?.is_active
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20"
            : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20";
    }
    return "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20";
}

function actionLabel(action: string, meta?: Record<string, unknown> | null) {
    if (action === "CREATE") return "Created";
    if (action === "DELETE") return "Deleted";
    if ((meta as Record<string, unknown> | null)?.operation === "toggle_active") {
        const nd = ((meta as Record<string, unknown> | null)?.newData) as { is_active?: boolean } | undefined;
        return nd?.is_active ? "Activated" : "Deactivated";
    }
    return "Updated";
}

function ChangeSummary({ entry }: { entry: HistoryEntry }) {
    const prev = entry.previousData as Record<string, unknown> | null;
    const next = entry.newData     as Record<string, unknown> | null;

    if (!prev && !next) return null;

    const changed = Object.keys({ ...prev, ...next }).filter(
        (k) => k !== "is_active" && JSON.stringify(prev?.[k]) !== JSON.stringify(next?.[k])
    );

    if (changed.length === 0) return null;

    return (
        <div className="mt-2 space-y-1">
            {changed.map((k) => (
                <div key={k} className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium capitalize text-foreground/70">{k.replace(/_/g, " ")}</span>
                    {prev?.[k] !== undefined && (
                        <span className="line-through opacity-60">{String(prev[k])}</span>
                    )}
                    {next?.[k] !== undefined && (
                        <span className="text-foreground/80">→ {String(next[k])}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

// ── Timeline entry ────────────────────────────────────────────────────────────

function TimelineEntry({ entry, isLast }: { entry: HistoryEntry; isLast: boolean }) {
    const meta = entry.metadata as Record<string, unknown> | null;

    return (
        <div className="flex gap-3">
            {/* Connector line */}
            <div className="flex flex-col items-center">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${actionColor(entry.action, meta)}`}>
                    <ActionIcon action={entry.action} />
                </div>
                {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
            </div>

            {/* Content */}
            <div className="pb-5 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                        <span className="text-sm font-medium">
                            {actionLabel(entry.action, meta)}
                        </span>
                        {entry.status === "FAILED" && (
                            <Badge variant="destructive" className="ml-2 text-[10px] py-0">Failed</Badge>
                        )}
                    </div>
                    <time
                        title={format(new Date(entry.actionAt), "PPpp")}
                        className="text-xs text-muted-foreground shrink-0"
                    >
                        {formatDistanceToNow(new Date(entry.actionAt), { addSuffix: true })}
                    </time>
                </div>

                {entry.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {entry.description}
                    </p>
                )}

                <ChangeSummary entry={entry} />

                <p className="text-xs text-muted-foreground mt-1">
                    by <span className="font-medium text-foreground/70">
                        {entry.userName ?? entry.userEmail ?? "Unknown"}
                    </span>
                </p>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CategoryHistorySheet({
    id,
    name,
}: {
    id:   number;
    name: string;
}) {
    const [open, setOpen]             = useState(false);
    const [history, setHistory]       = useState<HistoryEntry[]>([]);
    const [loaded, setLoaded]         = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleOpen(o: boolean) {
        setOpen(o);
        if (o && !loaded) {
            startTransition(async () => {
                const result = await getCategoryHistory(id);
                setHistory(result);
                setLoaded(true);
            });
        }
    }

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

            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
                <SheetHeader className="shrink-0">
                    <SheetTitle className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        Timeline — {name}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground">
                        Full audit trail of changes made to this category
                    </p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto mt-4">
                    {isPending ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">Loading timeline…</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <AlertCircle className="h-8 w-8" />
                            <p className="text-sm font-medium">No history yet</p>
                            <p className="text-xs">Actions on this category will appear here</p>
                        </div>
                    ) : (
                        <div className="px-1">
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
