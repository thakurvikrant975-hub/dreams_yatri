"use client";

import { useState, useTransition } from "react";
import { Phone, PhoneCall, PhoneMissed, PhoneOff, PhoneIncoming, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import { logCallAttempt } from "./actions";

// ── Call Status Options ───────────────────────────────────────────────────────

export type CallOutcome =
    | "RECEIVED"
    | "NOT_RECEIVED"
    | "INVALID_NUMBER"
    | "REJECTED"
    | "BUSY"
    | "VOICEMAIL"
    | "CALL_BACK_LATER";

const CALL_OUTCOMES: {
    value:     CallOutcome;
    label:     string;
    icon:      React.ElementType;
    color:     string;
    bgActive:  string;
    border:    string;
}[] = [
    {
        value:    "RECEIVED",
        label:    "Received",
        icon:     PhoneIncoming,
        color:    "text-green-600",
        bgActive: "bg-green-50 dark:bg-green-950/30",
        border:   "border-green-300 dark:border-green-800",
    },
    {
        value:    "NOT_RECEIVED",
        label:    "Not Received",
        icon:     PhoneMissed,
        color:    "text-amber-600",
        bgActive: "bg-amber-50 dark:bg-amber-950/30",
        border:   "border-amber-300 dark:border-amber-800",
    },
    {
        value:    "REJECTED",
        label:    "Call Rejected",
        icon:     PhoneOff,
        color:    "text-red-600",
        bgActive: "bg-red-50 dark:bg-red-950/30",
        border:   "border-red-300 dark:border-red-800",
    },
    {
        value:    "INVALID_NUMBER",
        label:    "Invalid Number",
        icon:     PhoneOff,
        color:    "text-destructive",
        bgActive: "bg-destructive/5",
        border:   "border-destructive/30",
    },
    {
        value:    "BUSY",
        label:    "Busy",
        icon:     Phone,
        color:    "text-orange-600",
        bgActive: "bg-orange-50 dark:bg-orange-950/30",
        border:   "border-orange-300 dark:border-orange-800",
    },
    {
        value:    "CALL_BACK_LATER",
        label:    "Call Back Later",
        icon:     Clock,
        color:    "text-blue-600",
        bgActive: "bg-blue-50 dark:bg-blue-950/30",
        border:   "border-blue-300 dark:border-blue-800",
    },
];

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
    queryId:      string;
    leadName:     string;
    phone:        string;
    callAttempts: number;
    children:     React.ReactNode;
    onDone?:      () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CallAttemptDialog({ queryId, leadName, phone, callAttempts, children, onDone }: Props) {
    const [open, setOpen]             = useState(false);
    const [outcome, setOutcome]       = useState<CallOutcome | "">("");
    const [response, setResponse]     = useState("");
    const [followUpDate, setFollowUp] = useState("");
    const [isPending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!outcome) { toast.error("Please select a call outcome"); return; }

        startTransition(async () => {
            const result = await logCallAttempt(
                queryId,
                followUpDate ? new Date(followUpDate) : undefined,
                outcome as CallOutcome,
                response,
            );
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setOutcome("");
                setResponse("");
                setFollowUp("");
                onDone?.();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setOutcome(""); setResponse(""); setFollowUp(""); } }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <PhoneCall className="h-4 w-4" />
                        Log Call Attempt
                    </DialogTitle>
                    <DialogDescription>
                        <span className="font-semibold text-foreground">{leadName}</span>
                        {" · "}{phone}
                        {" · "}
                        <span className="text-muted-foreground">
                            Attempt #{callAttempts + 1}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 pt-1">

                    {/* Call Outcome */}
                    <div className="space-y-2">
                        <Label>Call Outcome <span className="text-destructive">*</span></Label>
                        <div className="grid grid-cols-2 gap-2">
                            {CALL_OUTCOMES.map(opt => {
                                const Icon = opt.icon;
                                const isActive = outcome === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setOutcome(opt.value)}
                                        className={[
                                            "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                                            isActive
                                                ? `${opt.bgActive} ${opt.border} ${opt.color}`
                                                : "border-border bg-background text-muted-foreground hover:bg-muted",
                                        ].join(" ")}
                                    >
                                        <Icon className={`h-3.5 w-3.5 ${isActive ? opt.color : ""}`} />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Response / Notes */}
                    <div className="space-y-1.5">
                        <Label htmlFor="response">
                            Response / Notes
                            <span className="text-muted-foreground text-xs font-normal ml-1">(optional)</span>
                        </Label>
                        <Textarea
                            id="response"
                            value={response}
                            onChange={e => setResponse(e.target.value)}
                            placeholder={
                                outcome === "RECEIVED"
                                    ? "e.g. Customer is interested, wants a quote for 6N Kashmir..."
                                    : outcome === "NOT_RECEIVED"
                                    ? "e.g. Phone rang but no answer, will try again tomorrow..."
                                    : outcome === "CALL_BACK_LATER"
                                    ? "e.g. Customer asked to call back after 5pm..."
                                    : "Add any notes about this call attempt..."
                            }
                            rows={3}
                            className="resize-none text-sm"
                        />
                    </div>

                    {/* Follow-up date — shown for relevant outcomes */}
                    {(outcome === "NOT_RECEIVED" || outcome === "BUSY" || outcome === "CALL_BACK_LATER") && (
                        <div className="space-y-1.5">
                            <Label htmlFor="followUp">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Schedule Follow-up
                                </span>
                            </Label>
                            <Input
                                id="followUp"
                                type="datetime-local"
                                value={followUpDate}
                                onChange={e => setFollowUp(e.target.value)}
                                className="text-sm"
                            />
                        </div>
                    )}

                    {/* Previous attempts indicator */}
                    {callAttempts > 0 && (
                        <div className="rounded-lg bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-medium">{callAttempts}</span> previous attempt(s) logged for this lead.
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending || !outcome}
                            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            <PhoneCall className="h-3.5 w-3.5" />
                            {isPending ? "Saving..." : "Save Call Log"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}