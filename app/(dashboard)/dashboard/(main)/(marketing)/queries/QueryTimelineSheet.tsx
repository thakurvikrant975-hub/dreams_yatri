"use client";

import { useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "../../components/ui/button";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../../components/ui/sheet";
import { getQueryById } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type TimelineEntry = { id: string; actorName: string | null; event: string; createdAt: Date };

type Props = {
    queryId: string;
    leadName: string;
    /** Override the fetcher — sales-query passes its own richer query loader,
     * which includes the same `timeline` relation this sheet actually needs. */
    fetchQuery?: (id: string) => Promise<{ timeline: TimelineEntry[] } | null>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timelineDot(event: string) {
    if (event.includes("🤖"))                                   return "bg-fuchsia-500";
    if (event.includes("✅") || event.includes("Verified"))    return "bg-green-500";
    if (event.includes("❌") || event.includes("Rejected"))    return "bg-destructive";
    if (event.includes("📞") || event.includes("Call"))        return "bg-amber-500";
    if (event.includes("📝") || event.includes("Note"))        return "bg-blue-500";
    if (event.includes("👤") || event.includes("Assigned"))    return "bg-violet-500";
    if (event.includes("created") || event.includes("manual")) return "bg-primary";
    return "bg-muted-foreground/40";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QueryTimelineSheet({ queryId, leadName, fetchQuery = getQueryById }: Props) {
    const [open, setOpen] = useState(false);
    const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleOpen(o: boolean) {
        setOpen(o);
        if (o) {
            startTransition(async () => {
                const result = await fetchQuery(queryId);
                setTimeline(result?.timeline ?? []);
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

            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
                <SheetHeader className="shrink-0 border-b px-6 py-4 gap-1">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <History className="h-4 w-4 text-muted-foreground" />
                        Query Timeline
                    </SheetTitle>
                    <p className="text-sm font-medium text-foreground/80 truncate">{leadName}</p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {isPending || timeline === null ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">Loading timeline…</p>
                        </div>
                    ) : timeline.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No activity yet</p>
                    ) : (
                        <div className="relative pl-4 space-y-4">
                            <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                            {timeline.map((t) => (
                                <div key={t.id} className="relative flex gap-3 items-start">
                                    <div className={`absolute -left-3 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background shrink-0 ${timelineDot(t.event)}`} />
                                    <div className="min-w-0 pl-1 space-y-0.5">
                                        <p className="text-sm leading-snug">{t.event}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                                            {t.actorName && <span className="ml-1 font-medium">by {t.actorName}</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
