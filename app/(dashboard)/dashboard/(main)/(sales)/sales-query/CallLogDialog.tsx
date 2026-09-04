"use client";

import { useEffect, useState, useTransition } from "react";
import { Phone, PhoneOff, PhoneMissed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import { cn } from "@/app/lib/utils";
import { logCall, getCallLogsForQuery, type CallLogStatus, type CallLogEntry } from "./actions";

type Props = {
    queryId: string;
    leadName: string;
    children: React.ReactNode;
    onDone?: () => void;
};

// Mirrors the (unexported) label map in actions.ts — a "use server" module
// can only export async functions, so this small display-only copy lives
// here instead.
const CALL_LOG_STATUS_LABELS: Record<CallLogStatus, string> = {
    CONNECTED:  "Connected",
    NOT_PICKED: "Not Picked",
    DECLINED:   "Declined",
};

// Green/yellow/red — the same color language the "Lead" column's call-dot
// row uses (Salesqueriestable.tsx's CALL_STATUS_DOT), so a status reads the
// same way whether you're picking it here or scanning it there.
const STATUS_OPTIONS: { value: CallLogStatus; icon: React.ElementType; activeClass: string }[] = [
    { value: "CONNECTED",  icon: Phone,        activeClass: "border-green-500 bg-green-500 text-white" },
    { value: "NOT_PICKED", icon: PhoneMissed,  activeClass: "border-yellow-500 bg-yellow-500 text-white" },
    { value: "DECLINED",   icon: PhoneOff,     activeClass: "border-red-500 bg-red-500 text-white" },
];

const STATUS_DOT: Record<CallLogStatus, string> = {
    CONNECTED:  "bg-green-500",
    NOT_PICKED: "bg-yellow-500",
    DECLINED:   "bg-red-500",
};

/** "3:45 PM, 3 Sep" — explicitly Asia/Kolkata regardless of the viewer's own
 * browser timezone, since a call log's whole point is a shared, unambiguous
 * "when did you call" that a team leader reads the same way an exec does. */
function formatIST(d: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric", minute: "2-digit", hour12: true,
        day: "numeric", month: "short",
    }).format(d);
}

export function CallLogDialog({ queryId, leadName, children, onDone }: Props) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<CallLogStatus | null>(null);
    const [note, setNote] = useState("");
    const [isPending, startTransition] = useTransition();
    const [history, setHistory] = useState<CallLogEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Opening the dialog doubles as reviewing what's already been tried on
    // this lead — loaded fresh every open so a call just logged (in a prior
    // visit to this dialog) always shows up.
    useEffect(() => {
        if (!open) return;
        setLoadingHistory(true);
        getCallLogsForQuery(queryId)
            .then(setHistory)
            .finally(() => setLoadingHistory(false));
    }, [open, queryId]);

    function reset() {
        setStatus(null);
        setNote("");
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!status) return;

        const formData = new FormData();
        formData.set("status", status);
        if (note.trim()) formData.set("note", note.trim());

        startTransition(async () => {
            const result = await logCall(queryId, formData);
            if (result.success) {
                toast.success(`Call logged — ${formatIST(new Date())} IST`);
                setOpen(false);
                reset();
                onDone?.();
            } else if (result.errors) {
                toast.error(Object.values(result.errors)[0]?.[0] ?? result.message);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                        <Phone className="h-4 w-4" />
                        Log Call
                    </DialogTitle>
                    <DialogDescription>
                        Record a call attempt for <span className="font-semibold">{leadName}</span>. Visible to your team leader too.
                    </DialogDescription>
                </DialogHeader>

                {/* ── Past calls ── */}
                {loadingHistory ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Loading call history…</span>
                    </div>
                ) : history.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {history.length} previous call{history.length !== 1 ? "s" : ""}
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                            {history.map((h) => (
                                <div key={h.id} className="flex items-start gap-2 text-xs">
                                    <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[h.status])} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-medium">{CALL_LOG_STATUS_LABELS[h.status]}</span>
                                            <span className="text-muted-foreground">
                                                {formatIST(new Date(h.createdAt))} IST
                                                {h.actorName ? ` · ${h.actorName}` : ""}
                                            </span>
                                        </div>
                                        {h.note && <p className="text-muted-foreground mt-0.5">{h.note}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {!loadingHistory && history.length > 0 && <Separator />}

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label>Call Status</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {STATUS_OPTIONS.map((opt) => {
                                const active = status === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setStatus(opt.value)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-colors cursor-pointer",
                                            active
                                                ? opt.activeClass
                                                : "border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
                                        )}
                                    >
                                        <opt.icon className="h-4 w-4" />
                                        {CALL_LOG_STATUS_LABELS[opt.value]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="call-note">
                            Note <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id="call-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Discussed budget, will confirm dates tomorrow..."
                            rows={3}
                            className="resize-none text-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || !status}>
                            {isPending ? "Saving..." : "Save Call Log"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
