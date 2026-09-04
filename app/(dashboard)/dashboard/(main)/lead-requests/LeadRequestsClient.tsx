"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Ban, Check, CheckCheck, Clock, MapPin, Phone, Mail, StickyNote, Save } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
    acceptAllLeadRequests, acceptLeadRequest, rejectLeadRequest,
    updateLeadRequestReviewNote, type LeadRequestRow,
} from "./actions";

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

function DuplicateBanner({ duplicate }: { duplicate: LeadRequestRow["duplicate"] }) {
    if (!duplicate) return null;
    return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-xs leading-relaxed">
                This number is already on file as{" "}
                <span className="font-semibold">{duplicate.name}</span> —{" "}
                {duplicate.assignedToName
                    ? <>assigned to <span className="font-semibold">{duplicate.assignedToName}</span>{" "}</>
                    : "not yet assigned "}
                {formatDistanceToNow(new Date(duplicate.createdAt), { addSuffix: true })}.
                Check it&apos;s not a duplicate before accepting.
            </p>
        </div>
    );
}

/**
 * A note either the lead manager or the costing manager can leave on a
 * request while it's still in the queue — saved independently of
 * accept/reject so it isn't lost, and carried onto the resulting query as a
 * QueryNote the moment the request is accepted.
 */
function ReviewNote({ request }: { request: LeadRequestRow }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [note, setNote] = useState(request.reviewNote ?? "");
    // Resets the draft when the saved note changes underneath us (e.g. this
    // row's router.refresh() after Save) without an effect — set during
    // render, per React's "adjusting state when a prop changes" pattern.
    const [syncedNote, setSyncedNote] = useState(request.reviewNote ?? "");
    if (syncedNote !== (request.reviewNote ?? "")) {
        setSyncedNote(request.reviewNote ?? "");
        setNote(request.reviewNote ?? "");
    }

    const dirty = note.trim() !== (request.reviewNote ?? "").trim();

    function save() {
        startTransition(async () => {
            const result = await updateLeadRequestReviewNote(request.id, note);
            if (result.success) {
                toast.success("Note saved");
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to save note");
            }
        });
    }

    return (
        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/30 p-2.5 space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">
                <StickyNote className="h-3 w-3" /> Reviewer note
            </p>
            <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note for whoever picks this up after approval…"
                rows={2}
                className="text-sm resize-none bg-dashboard-base-100"
            />
            {dirty && (
                <div className="flex justify-end">
                    <Button
                        type="button" size="sm" variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={isPending}
                        onClick={save}
                    >
                        <Save className="h-3 w-3" /> {isPending ? "Saving…" : "Save note"}
                    </Button>
                </div>
            )}
        </div>
    );
}

function RequestRow({ request }: { request: LeadRequestRow }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState("");

    function accept() {
        startTransition(async () => {
            const result = await acceptLeadRequest(request.id);
            if (result.success) {
                toast.success(`${request.name} added as a query`);
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to accept");
            }
        });
    }

    function reject() {
        if (!reason.trim()) { toast.error("A reason is required to reject this request."); return; }
        startTransition(async () => {
            const result = await rejectLeadRequest(request.id, reason);
            if (result.success) {
                toast.success(`Request for ${request.name} rejected`);
                setRejecting(false);
                setReason("");
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to reject");
            }
        });
    }

    return (
        <div className="px-4 py-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{request.name}</p>
                        <Badge className={STATUS_STYLES[request.status]}>{request.status}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-dashboard-base-content/60">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {request.phone}</span>
                        {request.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {request.email}</span>}
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {request.destination}</span>
                    </div>
                    <p className="text-[11px] text-dashboard-base-content/45 mt-1">
                        Requested by {request.requestedByName} · {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                    </p>
                    {request.notes && (
                        <p className="mt-1.5 flex items-start gap-1.5 rounded-md border-l-2 border-dashboard-primary/30 bg-dashboard-primary/5 px-2.5 py-1.5 text-xs text-dashboard-base-content/70">
                            <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-dashboard-base-content/40" />
                            <span>{request.notes}</span>
                        </p>
                    )}
                    {request.status === "REJECTED" && request.rejectionReason && (
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1.5">
                            Rejected by {request.decidedByName}: &quot;{request.rejectionReason}&quot;
                        </p>
                    )}
                    {request.status === "ACCEPTED" && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Accepted by {request.decidedByName}
                        </p>
                    )}
                    {request.status !== "PENDING" && request.reviewNote && (
                        <p className="mt-1.5 flex items-start gap-1.5 rounded-md border-l-2 border-dashboard-base-content/20 bg-dashboard-base-200/40 px-2.5 py-1.5 text-xs text-dashboard-base-content/70">
                            <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-dashboard-base-content/40" />
                            <span>{request.reviewNote}</span>
                        </p>
                    )}
                </div>

                {request.status === "PENDING" && !rejecting && (
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button" size="sm" variant="outline"
                            className="h-8 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            disabled={isPending}
                            onClick={() => setRejecting(true)}
                        >
                            <Ban className="h-3.5 w-3.5" /> Reject
                        </Button>
                        <Button
                            type="button" size="sm"
                            className="h-8 text-xs gap-1"
                            disabled={isPending}
                            onClick={accept}
                        >
                            <Check className="h-3.5 w-3.5" /> Accept
                        </Button>
                    </div>
                )}
            </div>

            <DuplicateBanner duplicate={request.duplicate} />

            {request.status === "PENDING" && <ReviewNote request={request} />}

            {rejecting && (
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is this request being rejected?"
                        rows={2}
                        className="text-sm resize-none bg-white dark:bg-transparent"
                        autoFocus
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            type="button" size="sm"
                            className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                            disabled={isPending || !reason.trim()}
                            onClick={reject}
                        >
                            {isPending ? "Rejecting…" : "Confirm Reject"}
                        </Button>
                        <Button
                            type="button" size="sm" variant="ghost" className="h-8 text-xs"
                            onClick={() => { setRejecting(false); setReason(""); }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function LeadRequestsClient({ requests }: { requests: LeadRequestRow[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const pending = requests.filter((r) => r.status === "PENDING");

    function acceptAll() {
        startTransition(async () => {
            const result = await acceptAllLeadRequests();
            if (result.success) {
                const parts = [`${result.accepted} accepted`];
                if (result.skipped > 0) parts.push(`${result.skipped} skipped (already duplicate/decided)`);
                toast.success(parts.join(", "));
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to accept all");
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm text-dashboard-base-content/60">
                    <Clock className="h-4 w-4" /> {pending.length} pending
                </p>
                {pending.length > 0 && (
                    <Button
                        type="button" size="sm" className="h-8 text-xs gap-1.5"
                        disabled={isPending}
                        onClick={acceptAll}
                    >
                        <CheckCheck className="h-3.5 w-3.5" /> Accept All {pending.length}
                    </Button>
                )}
            </div>

            <div className="rounded-xl border bg-card overflow-hidden divide-y">
                {requests.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-dashboard-base-content/50">
                        No lead requests yet.
                    </p>
                ) : (
                    requests.map((r) => <RequestRow key={r.id} request={r} />)
                )}
            </div>
        </div>
    );
}
