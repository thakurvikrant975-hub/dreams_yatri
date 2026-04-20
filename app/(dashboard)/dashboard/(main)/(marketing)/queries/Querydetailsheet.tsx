"use client";

import { useState, useTransition, useRef } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
    Phone, Mail, MapPin, Users, Calendar, MessageSquare,
    Clock, CheckCircle2, XCircle, PhoneCall, StickyNote,
    ExternalLink, Globe, RefreshCw, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import {
    Sheet, SheetContent, SheetHeader,
    SheetTitle, SheetDescription,
} from "../../components/ui/sheet";
import { ScrollArea } from "../../components/ui/scroll-area";
import { QueryStatusBadge, QuerySourceBadge, CallAttemptsDots } from "./QueryBadges";
import { verifyQuery, markInProgress, logCallAttempt, addNote } from "./actions";
import { RejectQueryDialog } from "./Rejectquerydialog";
import type { PackageQuery, RejectionReason } from "./actions";

type QueryWithDetails = PackageQuery & {
    notes: Array<{ id: string; authorId: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = {
    query:           QueryWithDetails | null;
    reasons:         RejectionReason[];
    open:            boolean;
    onOpenChange:    (v: boolean) => void;
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

export function QueryDetailSheet({ query, reasons, open, onOpenChange }: Props) {
    const [isPendingVerify, startVerify]     = useTransition();
    const [isPendingProgress, startProgress] = useTransition();
    const [isPendingNote, startNote]         = useTransition();
    const formRef = useRef<HTMLFormElement>(null);

    if (!query) return null;

    const isTerminal  = query.status === "VERIFIED" || query.status === "REJECTED";
    const canVerify   = !query.verified && query.status !== "REJECTED";
    const canProgress = query.status === "SUBMITTED" || query.status === "IN_PROGRESS";

    function handleVerify() {
        startVerify(async () => {
            const r = await verifyQuery(query!.id);
            if (r.success) toast.success(r.message);
            else toast.error(r.message);
        });
    }

    function handleProgress() {
        startProgress(async () => {
            const r = await markInProgress(query!.id);
            if (r.success) toast.success(r.message);
            else toast.error(r.message);
        });
    }

    function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startNote(async () => {
            const r = await addNote(query!.id, fd);
            if (r.success) { toast.success(r.message); formRef.current?.reset(); }
            else toast.error(r.message);
        });
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
                {/* Header */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <SheetTitle className="text-lg">{query.name}</SheetTitle>
                            <SheetDescription className="flex items-center gap-2 mt-1">
                                <QuerySourceBadge source={query.source} />
                                <span className="text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}
                                </span>
                            </SheetDescription>
                        </div>
                        <QueryStatusBadge status={query.status} />
                    </div>

                    {/* Action buttons */}
                    {!isTerminal && (
                        <div className="flex gap-2 pt-3 flex-wrap">
                            {canProgress && (
                                <Button
                                    size="sm" variant="outline"
                                    onClick={handleProgress}
                                    disabled={isPendingProgress}
                                    className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950/30"
                                >
                                    <PhoneCall className="h-3.5 w-3.5" />
                                    {isPendingProgress ? "Updating..." : "Mark In Progress"}
                                </Button>
                            )}
                            {canVerify && (
                                <Button
                                    size="sm"
                                    onClick={handleVerify}
                                    disabled={isPendingVerify}
                                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {isPendingVerify ? "Verifying..." : "Verify Lead"}
                                </Button>
                            )}
                            <RejectQueryDialog queryId={query.id} leadName={query.name} reasons={reasons}>
                                <Button
                                    size="sm" variant="outline"
                                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                >
                                    <XCircle className="h-3.5 w-3.5" /> Reject
                                </Button>
                            </RejectQueryDialog>
                        </div>
                    )}

                    {/* Rejection reason pill */}
                    {query.status === "REJECTED" && query.rejectionReason && (
                        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                            <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">Rejected</p>
                            <p className="text-sm font-medium">{query.rejectionReason.label}</p>
                            {query.rejectionNote && (
                                <p className="text-xs text-muted-foreground mt-1 italic">"{query.rejectionNote}"</p>
                            )}
                        </div>
                    )}

                    {/* Verified pill */}
                    {query.verified && (
                        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 px-3 py-2">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
                                ✓ Verified Lead
                            </p>
                            {query.verifiedAt && (
                                <p className="text-xs text-muted-foreground">
                                    {format(new Date(query.verifiedAt), "dd MMM yyyy, hh:mm a")}
                                </p>
                            )}
                        </div>
                    )}
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <div className="px-6 py-4 space-y-6">

                        {/* Lead Info */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                Lead Information
                            </h3>
                            <div className="divide-y divide-border/50">
                                <InfoRow icon={Phone}    label="Phone"       value={query.phone} />
                                <InfoRow icon={Mail}     label="Email"       value={query.email} />
                                <InfoRow icon={MapPin}   label="Destination" value={query.destination} />
                                <InfoRow icon={Globe}    label="Package"     value={query.packageName} />
                                <InfoRow icon={Users}    label="Group Size"  value={query.groupSize ? `${query.groupSize} people` : null} />
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

                        {/* Call Tracking */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                Call Tracking
                            </h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">{query.callAttempts} Attempt(s)</p>
                                    {query.lastAttemptAt && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Last: {formatDistanceToNow(new Date(query.lastAttemptAt), { addSuffix: true })}
                                        </p>
                                    )}
                                </div>
                                <CallAttemptsDots count={query.callAttempts} />
                            </div>
                            {query.nextFollowUpAt && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                                    <Clock className="h-3 w-3" />
                                    Follow-up: {format(new Date(query.nextFollowUpAt), "dd MMM, hh:mm a")}
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* UTM Tracking */}
                        {(query.utmSource || query.utmCampaign || query.gclid) && (
                            <>
                                <section>
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                        Source Tracking
                                    </h3>
                                    <div className="space-y-1.5 text-xs">
                                        {query.utmSource   && <div className="flex gap-2"><span className="text-muted-foreground w-24">UTM Source</span><span className="font-mono">{query.utmSource}</span></div>}
                                        {query.utmMedium   && <div className="flex gap-2"><span className="text-muted-foreground w-24">UTM Medium</span><span className="font-mono">{query.utmMedium}</span></div>}
                                        {query.utmCampaign && <div className="flex gap-2"><span className="text-muted-foreground w-24">Campaign</span><span className="font-mono">{query.utmCampaign}</span></div>}
                                        {query.gclid       && <div className="flex gap-2"><span className="text-muted-foreground w-24">GCLID</span><span className="font-mono truncate max-w-[200px]">{query.gclid}</span></div>}
                                        {query.pageUrl     && <div className="flex gap-2"><span className="text-muted-foreground w-24">Page URL</span><a href={query.pageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">{query.pageUrl.slice(0, 40)}… <ExternalLink className="h-2.5 w-2.5" /></a></div>}
                                    </div>
                                </section>
                                <Separator />
                            </>
                        )}

                        {/* Notes */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                Internal Notes ({query.notes?.length ?? 0})
                            </h3>
                            <div className="space-y-2 mb-3">
                                {(query.notes ?? []).map(note => (
                                    <div key={note.id} className="rounded-lg border bg-card p-3">
                                        <p className="text-sm leading-relaxed">{note.content}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1.5">
                                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                ))}
                                {(query.notes ?? []).length === 0 && (
                                    <p className="text-xs text-muted-foreground italic">No notes yet</p>
                                )}
                            </div>
                            <form ref={formRef} onSubmit={handleAddNote} className="space-y-2">
                                <Textarea
                                    name="content"
                                    placeholder="Add an internal note..."
                                    rows={2}
                                    className="resize-none text-sm"
                                />
                                <Button type="submit" size="sm" variant="outline" disabled={isPendingNote} className="gap-1.5">
                                    <StickyNote className="h-3.5 w-3.5" />
                                    {isPendingNote ? "Adding..." : "Add Note"}
                                </Button>
                            </form>
                        </section>

                        <Separator />

                        {/* Timeline */}
                        <section className="pb-6">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                Activity Timeline
                            </h3>
                            <div className="relative pl-4 space-y-3">
                                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                                {(query.timeline ?? []).map((t, i) => (
                                    <div key={t.id} className="relative flex gap-3 items-start">
                                        <div className="absolute -left-3 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/40 shrink-0" />
                                        <div className="min-w-0 pl-1">
                                            <p className="text-sm">{t.event}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {t.actorName && <span className="font-medium">{t.actorName} · </span>}
                                                {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
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