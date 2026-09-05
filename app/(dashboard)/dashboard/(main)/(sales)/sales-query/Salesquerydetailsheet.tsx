"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { istDateTime } from "../../lead-report/ist";
import {
    Phone, Mail, MapPin, Users, Calendar,
    CalendarClock, XCircle,
    Globe, RotateCcw, ClipboardList,
    Package, CheckCircle2, FileText, Heart, Plus, Loader2, StickyNote,
    MessageSquare, Pencil, Save,
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
import { Badge } from "../../components/ui/badge";
import {
  QueryStatusBadge, QuerySourceBadge,  type QueryStatus,} from "../../components/dashboard/CustomBadges";
import { AddFollowUpDialog } from "./Addfollowupdialog";
import { CloseQueryDialog } from "./Closequerydialog";
import { RejectQueryDialog } from "./Rejectquerydialog";
import { PackageDetailsDialog } from "./Packagedetailsdialog";
import { CreatePackageDialog } from "./CreatePackageDialog";
import { PackageVerificationBadge, PackageSentBadge, HotelRequestBadge } from "./Salesquerybadges";
import { DeletePackageDialog } from "./Deletepackagedialog";
import { reopenSalesQuery, getCallLogsForQuery, updateQueryMessage } from "./actions";
import { readRequirements } from "./requirements";
import type { SentPackageInfo, CallLogEntry, CallLogStatus } from "./actions";
import { CloseReason, RejectionReason } from "../../(marketing)/queries/actions";
import { cn } from "@/app/lib/utils";

// Same color language as CallLogDialog's status picker and the Lead
// column's call-dot row (Salesqueriestable.tsx) — kept as small local
// copies rather than a shared import since each of the three is a
// different kind of module (client dialog / table cell / this sheet).
const CALL_STATUS_LABELS: Record<CallLogStatus, string> = {
    CONNECTED:  "Connected",
    NOT_PICKED: "Not Picked",
    DECLINED:   "Declined",
};
const CALL_STATUS_DOT: Record<CallLogStatus, string> = {
    CONNECTED:  "bg-green-500",
    NOT_PICKED: "bg-yellow-500",
    DECLINED:   "bg-red-500",
};

/** Explicitly Asia/Kolkata regardless of the viewer's own browser timezone —
 * matches CallLogDialog's formatIST. */
function formatIST(d: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric", minute: "2-digit", hour12: true,
        day: "numeric", month: "short",
    }).format(d);
}

type FollowUpItem = {
    id: string;
    note: string;
    followUpAt: Date | null;
    createdAt: Date;
    createdById: string | null;
    createdByName: string | null;
};

type SalesQueryWithDetails = SalesQuery & {
    followUps: FollowUpItem[];
    notes: Array<{ id: string; content: string; createdAt: Date; authorName?: string | null }>;
};

type Props = {
    query: SalesQueryWithDetails | null;
    closeReasons: CloseReason[];
    rejectionReasons: RejectionReason[];
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onRefresh?: () => void;
    /** True when the viewer leads a SalesTeam — shows the actual assignee's
     * name instead of assuming "you". */
    isTeamLead?: boolean;
};

// Remove SalesQuery from the actions import, then add:
export type SalesQuery = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  destination: string | null;
  packageName: string | null;
  packageUrl: string | null;
  groupSize: number | null;
  travelDate: Date | null;
  message: string | null;
  status: string;
  source: string;
  createdAt: Date;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedAt: Date | null;
  nextFollowUpAt: Date | null;
  closeReasonId: string | null;
  closeReasonOther: string | null;
  closedAt: Date | null;
  requirements: unknown;
  _count: { queryFollowUps: number };
  customPackages: SentPackageInfo[];
};

// Mirrors TRIP_TYPES in Packagedetailsdialog.tsx (the "Package Requirements"
// popup where this is captured) — a local label map, same pattern used for
// other requirement-derived labels in the sales views.
const TRIP_TYPE_LABELS: Record<string, string> = {
    FAMILY: "Family Trip", HONEYMOON: "Honeymoon", HOLIDAY: "Holiday / Leisure",
    FRIENDS: "Friends / Group", SOLO: "Solo Travel", ANNIVERSARY: "Anniversary",
    ADVENTURE: "Adventure", PILGRIMAGE: "Pilgrimage / Religious",
    BUSINESS: "Business", CORPORATE: "Corporate / MICE", OTHER: "Other",
};

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

/**
 * The client's own words (package_queries.message — same field Add Query's
 * "Notes / Message" writes to, and a lead request's "Message" tab carries
 * over on approval). Editable in place: the exec often only has the real
 * wording after actually getting the client on the phone, so this refines
 * one current value rather than logging entries like the notes list below.
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
    // Resets the draft when the saved value changes underneath us (e.g. a
    // different query opened, or a save completes and onRefresh lands new
    // props) — same "adjust state during render" pattern as the lead
    // request queue's own ReviewNote. Skipped while actively editing so a
    // save-in-flight doesn't yank the textarea out from under the exec.
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

export function SalesQueryDetailSheet({
    query,
    closeReasons,
    rejectionReasons,
    open,
    onOpenChange,
    onRefresh,
    isTeamLead = false,
}: Props) {
    const [isPendingReopen, startReopen] = useTransition();
    const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
    const [loadingCallLogs, setLoadingCallLogs] = useState(false);

    // Hooks run unconditionally (before the `!query` early return below),
    // same reason the effect keys off `query?.id` rather than assuming it.
    useEffect(() => {
        if (!open || !query?.id) { setCallLogs([]); return; }
        setLoadingCallLogs(true);
        getCallLogsForQuery(query.id)
            .then(setCallLogs)
            .finally(() => setLoadingCallLogs(false));
    }, [open, query?.id]);

    if (!query) return null;

    const isClosed = query.status === "CLOSED";

    function handleReopen() {
        startReopen(async () => {
            const r = await reopenSalesQuery(query!.id);
            if (r.success) {
                toast.success(r.message);
                onRefresh?.();
            } else {
                toast.error(r.message);
            }
        });
    }

    // Requirements summary for display.
    //
    // Read rather than cast: `requirements` is free-form JSON and a lead that
    // came in through the .com bridge holds only its own metadata there. The
    // cast this used to be said "PackageRequirements" about an object with no
    // sections in it, and the summary below then read `.travellers.tripType`
    // straight off undefined — taking the whole page down with it, for every
    // exec who happened to be handed a landing-page lead.
    const reqs = readRequirements(query.requirements);
    const travellerCount = reqs
        ? reqs.travellers.adults + reqs.travellers.children + reqs.travellers.infants
        : 0;

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
                                    {/* When the lead actually reached us, to the
                                        minute — an exec picking up a landing-page
                                        lead needs to know if it came in ten
                                        minutes ago or at 11pm last night. */}
                                    <span title={formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}>
                                        {istDateTime(query.createdAt)}
                                    </span>
                                </span>
                            </SheetDescription>
                        </div>
                        <QueryStatusBadge status={query.status as QueryStatus} />

                    </div>

                    {/* Action buttons */}
                    {!isClosed && (
                        <div className="flex gap-2 pt-3 flex-wrap">
                            {/* Package Requirements */}
                            <PackageDetailsDialog
                                query={query as any}
                                initialRequirements={reqs}
                                onDone={onRefresh}
                            >
                                <Button size="sm" variant="outline" className="gap-1.5">
                                    <ClipboardList className="h-3.5 w-3.5" />
                                    {reqs ? "Edit Requirements" : "Fill Requirements"}
                                </Button>
                            </PackageDetailsDialog>

                            <AddFollowUpDialog
                                salesQueryId={query.id}
                                leadName={query.name}
                                onDone={onRefresh}
                            >
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                                >
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Add Follow-Up ({query._count.queryFollowUps})
                                </Button>
                            </AddFollowUpDialog>

                            <CloseQueryDialog
                                salesQueryId={query.id}
                                leadName={query.name}
                                closeReasons={closeReasons}
                                onDone={onRefresh}
                            >
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                >
                                    <XCircle className="h-3.5 w-3.5" /> Close Query
                                </Button>
                            </CloseQueryDialog>

                            <RejectQueryDialog
                                queryId={query.id}
                                leadName={query.name}
                                reasons={rejectionReasons}
                                onDone={onRefresh}
                            >
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                >
                                    <XCircle className="h-3.5 w-3.5" /> Reject Query
                                </Button>
                            </RejectQueryDialog>
                        </div>
                    )}

                    {isClosed && (
                        <div className="flex gap-2 pt-3 flex-wrap">
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                                onClick={handleReopen}
                                disabled={isPendingReopen}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {isPendingReopen ? "Reopening..." : "Reopen Query"}
                            </Button>
                        </div>
                    )}

                    {/* Close reason banner */}
                    {isClosed && query.closeReasonId && (
                        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                            <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">
                                Closed
                            </p>
                            <p className="text-sm font-medium">
                                {closeReasons.find(r => r.id === query.closeReasonId)?.label ?? query.closeReasonId}
                            </p>
                            {query.closeReasonOther && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                    "{query.closeReasonOther}"
                                </p>
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
                            <p className="text-[11px] text-primary font-semibold uppercase tracking-wide mb-0.5">
                                {isTeamLead && query.assignedToName ? `Assigned to ${query.assignedToName}` : "Assigned to You"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {format(new Date(query.assignedAt), "dd MMM yyyy")} at{" "}
                                {format(new Date(query.assignedAt), "hh:mm a")}
                            </p>
                        </div>
                    )}

                    <ClientMessageCard queryId={query.id} message={query.message} onSaved={onRefresh} />

                    {/* Notes — e.g. context the lead manager left when assigning
                        this query. Shown right here, before the fold, rather
                        than buried further down the sheet: this is exactly what
                        the notes-count badge on the row promises when clicked,
                        so it needs to be the first thing the exec sees, not
                        something they have to scroll to find. Hidden entirely
                        when there's nothing to show, so most queries don't
                        carry an empty section. */}
                    {query.notes.length > 0 && (
                        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-900 dark:bg-blue-950/20">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                                <StickyNote className="h-3.5 w-3.5" />
                                Notes ({query.notes.length})
                            </p>
                            <div className="space-y-2">
                                {query.notes.map((note) => (
                                    <div
                                        key={note.id}
                                        className="rounded-md border border-blue-100 bg-white/70 px-2.5 py-2 dark:border-blue-900/50 dark:bg-black/20"
                                    >
                                        <p className="text-sm leading-relaxed text-foreground/90">{note.content}</p>
                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                            {note.authorName && <span className="ml-1 font-medium">· {note.authorName}</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom package(s) — a query can now have more than one built for
                        it (e.g. two different budget options sent to the same client) */}
                    {query.customPackages.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {query.customPackages.map((pkg) => (
                                <div
                                    key={pkg.id}
                                    className={`rounded-lg border px-3 py-2.5 ${
                                        pkg.verified
                                            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                                            : pkg.rejectedAt
                                                ? "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20"
                                                : "border-border bg-muted/40"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium min-w-0 truncate">{pkg.title}</p>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <a
                                                href={`/dashboard/package-builder/${pkg.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] text-primary hover:underline"
                                            >
                                                Open Builder
                                            </a>
                                            <DeletePackageDialog
                                                packageId={pkg.id}
                                                packageTitle={pkg.title}
                                                onDone={onRefresh}
                                            />
                                        </div>
                                    </div>
                                    <p className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                                        <CalendarClock className="h-3 w-3 shrink-0" />
                                        Created {format(new Date(pkg.createdAt), "dd MMM yyyy")} at{" "}
                                        {format(new Date(pkg.createdAt), "hh:mm a")}
                                    </p>

                                    {/* Every package on a lead gets its own status here — five
                                        drafts on one query used to all read the same generic
                                        "Package Draft" label with no way to tell which one had
                                        actually cleared costing, so this reuses the same badges
                                        the sales-query table already shows per-row. */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        {pkg.readyAt ? (
                                            <>
                                                <PackageVerificationBadge pkg={pkg} />
                                                <PackageSentBadge pkg={pkg} />
                                            </>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className="gap-1 text-[11px] font-medium py-0.5 rounded-md text-muted-foreground"
                                            >
                                                <Package className="h-3 w-3" /> Draft
                                            </Badge>
                                        )}
                                        <HotelRequestBadge pkg={pkg} />
                                    </div>

                                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                                        {pkg.totalPrice != null && (
                                            <span>₹{Number(pkg.totalPrice).toLocaleString("en-IN")}</span>
                                        )}
                                        {pkg.sentAt && (
                                            <span>· Sent {formatDistanceToNow(new Date(pkg.sentAt), { addSuffix: true })}</span>
                                        )}
                                        {pkg.pdfUrl && (
                                            <a
                                                href={pkg.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-0.5 text-primary hover:underline"
                                            >
                                                <FileText className="h-3 w-3" /> PDF
                                            </a>
                                        )}
                                    </div>

                                    {pkg.verified && pkg.verifiedAt && (
                                        <p className="flex items-center gap-1 mt-1.5 text-[11px] text-green-700 dark:text-green-400">
                                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                                            Approved {format(new Date(pkg.verifiedAt), "dd MMM yyyy")} at{" "}
                                            {format(new Date(pkg.verifiedAt), "hh:mm a")}
                                            {pkg.verifiedByName && ` · ${pkg.verifiedByName}`}
                                        </p>
                                    )}
                                    {!pkg.verified && pkg.rejectedAt && (
                                        <p className="flex items-center gap-1 mt-1.5 text-[11px] text-red-700 dark:text-red-400">
                                            <XCircle className="h-3 w-3 shrink-0" />
                                            Rejected {format(new Date(pkg.rejectedAt), "dd MMM yyyy")} at{" "}
                                            {format(new Date(pkg.rejectedAt), "hh:mm a")}
                                            {pkg.rejectedByName && ` · ${pkg.rejectedByName}`}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <CreatePackageDialog
                        queryId={query.id}
                        existingPackages={query.customPackages}
                        destination={query.destination}
                        packageUrl={query.packageUrl}
                        travelDate={query.travelDate ? query.travelDate.toISOString().slice(0, 10) : reqs?.journey?.travelDate ?? null}
                        travellers={reqs?.travellers ? {
                            adults: reqs.travellers.adults,
                            children: reqs.travellers.children,
                            infants: reqs.travellers.infants,
                        } : null}
                        budget={reqs?.budget && (reqs.budget.min != null || reqs.budget.max != null) ? {
                            min: reqs.budget.min,
                            max: reqs.budget.max,
                            type: reqs.budget.type,
                        } : null}
                        duration={reqs?.journey?.noOfDays ? {
                            days: reqs.journey.noOfDays,
                            nights: reqs.journey.noOfNights,
                        } : null}
                        queryReceivedAt={query.createdAt}
                    >
                        <button
                            type="button"
                            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                        >
                            <Plus className="h-3 w-3" />
                            {query.customPackages.length > 0 ? "New Package" : "Create Package"}
                        </button>
                    </CreatePackageDialog>
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <div className="px-6 py-4 space-y-6">

                        {/* Lead Info */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                Lead Information
                            </h3>
                            <div className="divide-y divide-border/50">
                                <InfoRow icon={Phone} label="Phone" value={query.phone} />
                                <InfoRow icon={Mail} label="Email" value={query.email} />
                                <InfoRow icon={MapPin} label="Destination" value={query.destination} />
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
                                <InfoRow
                                    icon={Users}
                                    label="Group Size"
                                    value={query.groupSize ? `${query.groupSize} people` : null}
                                />
                                <InfoRow
                                    icon={Calendar}
                                    label="Travel Date"
                                    value={
                                        query.travelDate
                                            ? format(new Date(query.travelDate), "dd MMM yyyy")
                                            : null
                                    }
                                />
                            </div>
                        </section>

                        {/* Package Requirements Summary */}
                        {reqs && (
                            <>
                                <Separator />
                                <section>
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                        Package Requirements
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex flex-wrap gap-1.5">
                                            {reqs.travellers.tripType && (
                                                <Badge variant="secondary" className="text-xs gap-1">
                                                    <Heart className="h-2.5 w-2.5" />
                                                    {reqs.travellers.tripType === "OTHER"
                                                        ? (reqs.travellers.tripTypeCustom || "Other")
                                                        : (TRIP_TYPE_LABELS[reqs.travellers.tripType] ?? reqs.travellers.tripType)}
                                                </Badge>
                                            )}
                                            {travellerCount > 0 && (
                                                <Badge variant="secondary" className="text-xs gap-1">
                                                    <Users className="h-2.5 w-2.5" />
                                                    {reqs.travellers.adults}A
                                                    {reqs.travellers.children > 0 && ` + ${reqs.travellers.children}C`}
                                                    {reqs.travellers.infants > 0 && ` + ${reqs.travellers.infants}I`}
                                                </Badge>
                                            )}
                                            {reqs.journey.noOfDays > 0 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {reqs.journey.noOfDays}D / {reqs.journey.noOfNights}N
                                                </Badge>
                                            )}
                                            {reqs.budget.min && (
                                                <Badge variant="secondary" className="text-xs">
                                                    ₹{reqs.budget.min.toLocaleString("en-IN")}
                                                    {reqs.budget.max ? ` – ₹${reqs.budget.max.toLocaleString("en-IN")}` : "+"}
                                                    {" "}{reqs.budget.type === "PER_PERSON" ? "/pp" : "total"}
                                                </Badge>
                                            )}
                                            {reqs.stay.types.length > 0 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {reqs.stay.types.join(", ")}
                                                </Badge>
                                            )}
                                            {reqs.transport.includeFlights && (
                                                <Badge variant="secondary" className="text-xs">✈ Flights</Badge>
                                            )}
                                            {reqs.transport.includeTrain && (
                                                <Badge variant="secondary" className="text-xs">🚆 Train</Badge>
                                            )}
                                        </div>
                                        {reqs.journey.destinations.length > 0 && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                {reqs.journey.destinations.join(" → ")}
                                            </div>
                                        )}
                                        {reqs.activities.selected.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Activities: {reqs.activities.selected.join(", ")}
                                            </p>
                                        )}
                                    </div>
                                </section>
                            </>
                        )}

                        <Separator />

                        {/* Next Follow-Up */}
                        {query.nextFollowUpAt && (
                            <>
                                <div className="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                                    <Calendar className="h-4 w-4 text-amber-600" />
                                    <div>
                                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                                            Follow ups:{" "}
                                        </span>
                                        <span className="text-amber-600 text-xs">
                                            {format(new Date(query.nextFollowUpAt), "dd MMM yyyy, hh:mm a")}
                                        </span>
                                    </div>
                                </div>
                                <Separator />
                            </>
                        )}

                        {/* Follow-Ups — each person sees their own (filtered server-side) */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                My Follow-Ups ({query.followUps?.length ?? 0})
                            </h3>
                            <div className="space-y-2 mb-3">
                                {(query.followUps ?? []).length === 0 && (
                                    <p className="text-xs text-muted-foreground italic">
                                        No follow-ups logged yet. Add one to track your progress.
                                    </p>
                                )}
                                {(query.followUps ?? []).map((fu) => (
                                    <div key={fu.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                                        <p className="text-sm leading-relaxed">{fu.note}</p>
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(new Date(fu.createdAt), { addSuffix: true })}
                                                {fu.createdByName && (
                                                    <span className="ml-1 font-medium">by {fu.createdByName}</span>
                                                )}
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

                        {/* Call Logs — status + note per call, newest first. */}
                        <section>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                My Call Logs ({callLogs.length})
                            </h3>
                            {loadingCallLogs ? (
                                <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Loading call logs…
                                </div>
                            ) : callLogs.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                    No calls logged yet.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {callLogs.map((c) => (
                                        <div key={c.id} className="rounded-lg border bg-card p-3 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("h-2 w-2 rounded-full shrink-0", CALL_STATUS_DOT[c.status])} />
                                                <span className="text-sm font-medium">{CALL_STATUS_LABELS[c.status]}</span>
                                                <span className="text-[10px] text-muted-foreground ml-auto">
                                                    {formatIST(new Date(c.createdAt))} IST
                                                </span>
                                            </div>
                                            {c.note && (
                                                <p className="text-xs text-muted-foreground pl-4">{c.note}</p>
                                            )}
                                            {c.actorName && (
                                                <p className="text-[10px] text-muted-foreground pl-4">by {c.actorName}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}