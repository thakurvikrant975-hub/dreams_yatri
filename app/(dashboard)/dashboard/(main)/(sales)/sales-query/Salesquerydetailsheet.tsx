"use client";

import { useRef, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
    Phone, Mail, MapPin, Users, Calendar,
    MessageSquare, CalendarClock, XCircle,
    StickyNote, Globe, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import {
    Sheet, SheetContent, SheetHeader,
    SheetTitle, SheetDescription,
} from "../../components/ui/sheet";
import { ScrollArea } from "../../components/ui/scroll-area";
import { SalesQueryStatusBadge } from "./Salesquerybadges";
import { QuerySourceBadge } from "../../(marketing)/queries/QueryBadges";
import { AddFollowUpDialog } from "./Addfollowupdialog";
import { CloseQueryDialog } from "./Closequerydialog";
import { reopenSalesQuery } from "./actions";
import type { SalesQuery, CloseReason } from "./actions";

type SalesQueryWithDetails = SalesQuery & {
    followUps: Array<{
        id: string;
        note: string;
        followUpAt: Date | null;
        createdAt: Date;
        createdByName: string | null;
    }>;
    notes: Array<{ id: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = {
    query: SalesQueryWithDetails | null;
    closeReasons: CloseReason[];
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onRefresh?: () => void;
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3 py-2">
            <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                <p className="text-sm font-medium mt-0.5 break-all">{value}</p>
            </div>
        </div>
    );
}

function timelineDot(event: string) {
    if (event.includes("✅") || event.includes("Verified")) return "bg-green-500";
    if (event.includes("❌") || event.includes("Closed")) return "bg-destructive";
    if (event.includes("📞") || event.includes("Follow")) return "bg-amber-500";
    if (event.includes("📝") || event.includes("Note")) return "bg-blue-500";
    if (event.includes("🔄") || event.includes("Reopen")) return "bg-primary";
    return "bg-muted-foreground/40";
}

export function SalesQueryDetailSheet({ query, closeReasons, open, onOpenChange, onRefresh }: Props) {
    const [isPendingReopen, startReopen] = useTransition();

    if (!query) return null;

    const isClosed = query.status === "CLOSED";

    function handleReopen() {
        startReopen(async () => {
            const r = await reopenSalesQuery(query!.id);
            if (r.success) { toast.success(r.message); onRefresh?.(); }
            else toast.error(r.message);
        });
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col overflow-auto">
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <SheetTitle className="text-lg">{query.name}</SheetTitle>
                            <SheetDescription className="flex items-center gap-2 mt-1">
                                <QuerySourceBadge source={query.source as any} />
                                <span className="text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}
                                </span>
                            </SheetDescription>
                        </div>
                        <SalesQueryStatusBadge status={query.status} />
                    </div>

                    {/* Action buttons */}
                    {!isClosed && (
                        <div className="flex gap-2 pt-3 flex-wrap">
                            <AddFollowUpDialog
                                salesQueryId={query.id}
                                leadName={query.name}
                                onDone={onRefresh}
                            >
                                <Button size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Add Follow-Up ({query._count.followUps})
                                </Button>
                            </AddFollowUpDialog>

                            <CloseQueryDialog
                                salesQueryId={query.id}
                                leadName={query.name}
                                closeReasons={closeReasons}
                                onDone={onRefresh}
                            >
                                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                                    <XCircle className="h-3.5 w-3.5" /> Close Query
                                </Button>
                            </CloseQueryDialog>
                        </div>
                    )}

                    {isClosed && (
                        <div className="flex gap-2 pt-3 flex-wrap">
                            <Button
                                size="sm" variant="outline"
                                className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                                onClick={handleReopen}
                                disabled={isPendingReopen}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {isPendingReopen ? "Reopening..." : "Reopen Query"}
                            </Button>
                        </div>
                    )}

                    {isClosed && query.closeReasonId && (
                        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                            <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">Closed</p>
                            <p className="text-sm font-medium">
                                {closeReasons.find(r => r.id === query.closeReasonId)?.label ?? query.closeReasonId}
                            </p>
                            {query.closeReasonOther && (
                                <p className="text-xs text-muted-foreground mt-1 italic">"{query.closeReasonOther}"</p>
                            )}
                            {query.closedAt && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {format(new Date(query.closedAt), "dd MMM yyyy, hh:mm a")}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Assigned info */}
                    {query.assignedAt && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                            <p className="text-[11px] text-primary font-semibold uppercase tracking-wide mb-0.5">Assigned to You</p>
                            <p className="text-xs text-muted-foreground">
                                {format(new Date(query.assignedAt), "dd MMM yyyy")} at {format(new Date(query.assignedAt), "hh:mm a")}
                            </p>
                        </div>
                    )}
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <div className="px-6 py-4 space-y-6">

                        {/* Lead Info */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Lead Information</h3>
                            <div className="divide-y divide-border/50">
                                <InfoRow icon={Phone} label="Phone" value={query.phone} />
                                <InfoRow icon={Mail} label="Email" value={query.email} />
                                <InfoRow icon={MapPin} label="Destination" value={query.destination} />
                                <InfoRow icon={Globe} label="Package" value={query.packageName} />
                                <InfoRow icon={Users} label="Group Size" value={query.groupSize ? `${query.groupSize} people` : null} />
                                <InfoRow icon={Calendar} label="Travel Date" value={query.travelDate ? format(new Date(query.travelDate), "dd MMM yyyy") : null} />
                            </div>
                            {query.message && (
                                <div className="mt-3 rounded-lg bg-muted/50 border p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Message</p>
                                    <p className="text-sm text-foreground/80 leading-relaxed">{query.message}</p>
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* Follow-Ups */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                Follow-Ups ({query.followUps?.length ?? 0})
                            </h3>
                            <div className="space-y-2 mb-3">
                                {(query.followUps ?? []).length === 0 && (
                                    <p className="text-xs text-muted-foreground italic">No follow-ups logged yet</p>
                                )}
                                {(query.followUps ?? []).map(fu => (
                                    <div key={fu.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                                        <p className="text-sm leading-relaxed">{fu.note}</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(new Date(fu.createdAt), { addSuffix: true })}
                                                {fu.createdByName && <span className="ml-1 font-medium">by {fu.createdByName}</span>}
                                            </p>
                                            {fu.followUpAt && (
                                                <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded px-1.5 py-0.5">
                                                    <Calendar className="h-2.5 w-2.5" />
                                                    {format(new Date(fu.followUpAt), "dd MMM, hh:mm a")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!isClosed && (
                                <AddFollowUpDialog
                                    salesQueryId={query.id}
                                    leadName={query.name}
                                    onDone={onRefresh}
                                >
                                    <Button size="sm" variant="outline" className="gap-1.5">
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        Add Follow-Up
                                    </Button>
                                </AddFollowUpDialog>
                            )}
                        </section>

                        <Separator />

                        {/* Activity Timeline */}
                        <section className="pb-6">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Activity Timeline</h3>
                            <div className="relative pl-4 space-y-4">
                                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                                {(query.timeline ?? []).map((t) => (
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
                                {(query.timeline ?? []).length === 0 && (
                                    <p className="text-xs text-muted-foreground italic pl-1">No activity yet</p>
                                )}
                            </div>
                        </section>

                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}