"use client";

import { useTransition, useRef, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { istDateTime } from "../../lead-report/ist";
import {
    Phone, Mail, MapPin, Users, Calendar,
    CheckCircle2, XCircle, StickyNote,
    ExternalLink, Globe, PhoneCall, UserCheck,
    MessageSquare, Save,
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
import { QueryStatusBadge, QuerySourceBadge, CallAttemptsDots } from "../../components/dashboard/CustomBadges";
import { verifyQuery, addNote, updateQueryMessage } from "./actions";
import { RejectQueryDialog } from "./Rejectquerydialog";
import { CallAttemptDialog } from "./Callattemptdialog";
import type { PackageQuery, RejectionReason } from "./actions";
import { Pencil } from "lucide-react";
import { EditQueryDialog } from "./Editquerydialog";
import { AssignQueryDropdown } from "./Assignquerydropdown";
import { DeleteQueryDialog } from "./Deletequerydialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type QueryWithDetails = PackageQuery & {
    notes:    Array<{ id: string; authorId: string; authorName?: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = {
    query:        QueryWithDetails | null;
    reasons:      RejectionReason[];
    open:         boolean;
    onOpenChange: (v: boolean) => void;
    onRefresh?:   () => void;
    onDeleted?:   (id: string) => void;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
}) {
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
    if (event.includes("✅") || event.includes("Verified"))    return "bg-green-500";
    if (event.includes("❌") || event.includes("Rejected"))    return "bg-destructive";
    if (event.includes("📞") || event.includes("Call"))        return "bg-amber-500";
    if (event.includes("📝") || event.includes("Note"))        return "bg-blue-500";
    if (event.includes("👤") || event.includes("Assigned"))    return "bg-violet-500";
    if (event.includes("created") || event.includes("manual")) return "bg-primary";
    return "bg-muted-foreground/40";
}

/**
 * The client's own words (package_queries.message — same field Add Query's
 * "Notes / Message" writes to, and a lead request's "Message" tab carries
 * over on approval). Editable in place rather than logged like Internal
 * Notes below: it's meant to read as the one current record of what the
 * client said, refined as the exec learns more, not a running history.
 */
function ClientMessageCard({
    queryId, message, onSaved,
}: {
    queryId: string;
    message: string | null;
    onSaved?: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(message ?? "");
    const [synced, setSynced] = useState(message ?? "");
    if (!editing && synced !== (message ?? "")) {
        setSynced(message ?? "");
        setDraft(message ?? "");
    }

    function save() {
        startTransition(async () => {
            const r = await updateQueryMessage(queryId, draft);
            if (r.success) {
                setEditing(false);
                onSaved?.();
            } else {
                toast.error(r.message);
            }
        });
    }

    return (
        <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 dark:border-violet-900 dark:bg-violet-950/20">
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
                    <MessageSquare className="h-3.5 w-3.5" />
                    VOC
                </p>
                {!editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        title="Edit"
                        className="text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 cursor-pointer"
                    >
                        <Pencil className="h-3 w-3" />
                    </button>
                )}
            </div>

            {editing ? (
                <div className="space-y-2">
                    <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="What did the client say?"
                        rows={3}
                        autoFocus
                        className="resize-none border-violet-200 bg-white/70 text-sm dark:border-violet-900/50 dark:bg-black/20"
                    />
                    <div className="flex items-center gap-2">
                        <Button size="sm" className="h-7 gap-1 text-xs" disabled={isPending} onClick={save}>
                            <Save className="h-3 w-3" /> {isPending ? "Saving…" : "Save"}
                        </Button>
                        <Button
                            size="sm" variant="ghost" className="h-7 text-xs"
                            disabled={isPending}
                            onClick={() => { setEditing(false); setDraft(message ?? ""); }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : message ? (
                <p className="text-sm italic leading-relaxed text-foreground/90">&quot;{message}&quot;</p>
            ) : (
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                >
                    + Add what the client said
                </button>
            )}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function QueryDetailSheet({ query, reasons, open, onOpenChange, onRefresh, onDeleted }: Props) {
    const [isPendingVerify, startVerify] = useTransition();
    const [isPendingNote, startNote]     = useTransition();
    const formRef = useRef<HTMLFormElement>(null);

    if (!query) return null;

    const isTerminal = query.status === "VERIFIED" || query.status === "REJECTED";
    const canVerify  = !query.verified && query.status !== "REJECTED";

    function handleVerify() {
        startVerify(async () => {
            const r = await verifyQuery(query!.id);
            if (r.success) { toast.success(r.message); onRefresh?.(); }
            else toast.error(r.message);
        });
    }

    function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startNote(async () => {
            const r = await addNote(query!.id, fd);
            if (r.success) { toast.success(r.message); formRef.current?.reset(); onRefresh?.(); }
            else toast.error(r.message);
        });
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col overflow-auto">

                {/* ── Header ─────────────────────────────────────────────── */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b">

                    {/* Name + Status row */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <SheetTitle className="text-lg">{query.name}</SheetTitle>
                            <SheetDescription className="flex items-center gap-2 mt-1">
                                <QuerySourceBadge source={query.source} />
                                <span className="text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                    {/* Exact, not "2 hours ago": staff match this
                                        against a call log or a WhatsApp thread,
                                        and a relative label cannot be checked. */}
                                    <span title={formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}>
                                        {istDateTime(query.createdAt)}
                                    </span>
                                </span>
                            </SheetDescription>
                        </div>
                        <QueryStatusBadge status={query.status} />
                    </div>

                    {/* Action buttons — non-terminal queries */}
                    {!isTerminal && (
                        <div className="flex gap-2 pt-3 flex-wrap">

                            {/* Assign to sales */}
                            <AssignQueryDropdown
                                queryId={query.id}
                                assignedTo={query.assignedTo}
                                assignedAt={query.assignedAt}
                                assignedToName={query.assignedToName}
                                onDone={onRefresh}
                            />

                            {/* Edit Details */}
                            <EditQueryDialog query={query} onDone={onRefresh}>
                                <Button size="sm" variant="outline" className="gap-1.5">
                                    <Pencil className="h-3.5 w-3.5" /> Edit Details
                                </Button>
                            </EditQueryDialog>

                            {/* Log Call */}
                            <CallAttemptDialog
                                queryId={query.id}
                                leadName={query.name}
                                phone={query.phone}
                                callAttempts={query.callAttempts}
                                onDone={onRefresh}
                            >
                                <Button size="sm" variant="outline"
                                    className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950/30">
                                    <PhoneCall className="h-3.5 w-3.5" />
                                    Log Call ({query.callAttempts})
                                </Button>
                            </CallAttemptDialog>

                            {/* Verify Lead */}
                            {canVerify && (
                                <Button size="sm" onClick={handleVerify} disabled={isPendingVerify}
                                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {isPendingVerify ? "Verifying..." : "Verify Lead"}
                                </Button>
                            )}

                            {/* Reject */}
                            <RejectQueryDialog queryId={query.id} leadName={query.name} reasons={reasons}>
                                <Button size="sm" variant="outline"
                                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                                    <XCircle className="h-3.5 w-3.5" /> Reject
                                </Button>
                            </RejectQueryDialog>

                            {/* Delete */}
                            <DeleteQueryDialog
                                queryId={query.id}
                                leadName={query.name}
                                compact
                                onDone={() => { onDeleted?.(query.id); onOpenChange(false); }}
                            />
                        </div>
                    )}

                    {/* Rejected banner */}
                    {query.status === "REJECTED" && query.rejectionReason && (
                        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                            <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">Rejected</p>
                            <p className="text-sm font-medium">{query.rejectionReason.label}</p>
                            {query.rejectionNote && (
                                <p className="text-xs text-muted-foreground mt-1 italic">"{query.rejectionNote}"</p>
                            )}
                        </div>
                    )}

                    {/* Verified banner */}
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

                    {/* Assigned To banner — shows always when assigned (terminal or not) */}
                    {query.assignedTo && (
                        <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                        Assigned To
                                    </p>
                                    <p className="text-sm font-medium truncate">
                                        {(query as any).assignedToName ?? query.assignedTo}
                                    </p>
                                    {query.assignedAt && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            <span title={formatDistanceToNow(new Date(query.assignedAt), { addSuffix: true })}>
                                                {istDateTime(query.assignedAt)}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            {/* Always allow reassignment */}
                            <AssignQueryDropdown
                                queryId={query.id}
                                assignedTo={query.assignedTo}
                                onDone={onRefresh}
                                compact
                            />
                        </div>
                    )}

                </SheetHeader>

                {/* ── Scrollable Body ─────────────────────────────────────── */}
                <ScrollArea className="flex-1">
                    <div className="px-6 py-4 space-y-6">

                        {/* Lead Information */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                Lead Information
                            </h3>
                            <div className="divide-y divide-border/50">
                                <InfoRow icon={Phone}    label="Phone"       value={query.phone} />
                                <InfoRow icon={Mail}     label="Email"       value={query.email} />
                                <InfoRow icon={MapPin}   label="Destination" value={query.destination} />
                                <InfoRow
                                    icon={Globe}
                                    label="Package"
                                    value={
                                        query.packageName && query.packageUrl ? (
                                            <a
                                                href={query.packageUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-primary hover:underline"
                                            >
                                                {query.packageName}
                                            </a>
                                        ) : query.packageName
                                    }
                                />
                                <InfoRow icon={Users}    label="Group Size"  value={query.groupSize ? `${query.groupSize} people` : null} />
                                <InfoRow icon={Calendar} label="Travel Date" value={query.travelDate ? format(new Date(query.travelDate), "dd MMM yyyy") : null} />
                            </div>
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
                                            Last: <span title={formatDistanceToNow(new Date(query.lastAttemptAt), { addSuffix: true })}>
                                                {istDateTime(query.lastAttemptAt)}
                                            </span>
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <CallAttemptsDots count={query.callAttempts} />
                                    {!isTerminal && (
                                        <CallAttemptDialog
                                            queryId={query.id}
                                            leadName={query.name}
                                            phone={query.phone}
                                            callAttempts={query.callAttempts}
                                            onDone={onRefresh}
                                        >
                                            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs text-amber-600 border-amber-200">
                                                <PhoneCall className="h-3 w-3" /> Log Call
                                            </Button>
                                        </CallAttemptDialog>
                                    )}
                                </div>
                            </div>
                            {query.nextFollowUpAt && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-900">
                                    <Calendar className="h-3 w-3" />
                                    Follow-up: {format(new Date(query.nextFollowUpAt), "dd MMM, hh:mm a")}
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* UTM / Source Tracking — only if data exists */}
                        {((query as any).utmSource || (query as any).utmCampaign || (query as any).gclid) && (
                            <>
                                <section>
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                        Source Tracking
                                    </h3>
                                    <div className="space-y-1.5 text-xs">
                                        {(query as any).utmSource   && <div className="flex gap-2"><span className="text-muted-foreground w-24">UTM Source</span><span className="font-mono">{(query as any).utmSource}</span></div>}
                                        {(query as any).utmMedium   && <div className="flex gap-2"><span className="text-muted-foreground w-24">UTM Medium</span><span className="font-mono">{(query as any).utmMedium}</span></div>}
                                        {(query as any).utmCampaign && <div className="flex gap-2"><span className="text-muted-foreground w-24">Campaign</span><span className="font-mono">{(query as any).utmCampaign}</span></div>}
                                        {(query as any).gclid       && <div className="flex gap-2"><span className="text-muted-foreground w-24">GCLID</span><span className="font-mono truncate max-w-[200px]">{(query as any).gclid}</span></div>}
                                        {(query as any).pageUrl     && (
                                            <div className="flex gap-2">
                                                <span className="text-muted-foreground w-24">Page URL</span>
                                                <a href={(query as any).pageUrl} target="_blank" rel="noreferrer"
                                                    className="text-primary hover:underline flex items-center gap-0.5">
                                                    {(query as any).pageUrl.slice(0, 40)}…
                                                    <ExternalLink className="h-2.5 w-2.5" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </section>
                                <Separator />
                            </>
                        )}

                        <ClientMessageCard queryId={query.id} message={query.message} onSaved={onRefresh} />

                        {/* Internal Notes */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                Internal Notes ({query.notes?.length ?? 0})
                            </h3>
                            <div className="space-y-2 mb-3">
                                {(query.notes ?? []).map((note) => (
                                    <div key={note.id} className="rounded-lg border bg-card p-3">
                                        <p className="text-sm leading-relaxed">{note.content}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1.5">
                                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                            {note.authorName && <span className="ml-1 font-medium">by {note.authorName}</span>}
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

                        {/* Activity Timeline */}
                        <section className="pb-6">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                Activity Timeline
                            </h3>
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