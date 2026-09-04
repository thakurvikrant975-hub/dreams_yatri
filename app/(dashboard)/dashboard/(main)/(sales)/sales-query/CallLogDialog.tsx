"use client";

import { useState, useTransition } from "react";
import { Phone, PhoneOff, PhoneMissed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import { cn } from "@/app/lib/utils";
import { logCall, type CallLogStatus } from "./actions";

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

const STATUS_OPTIONS: { value: CallLogStatus; icon: React.ElementType; activeClass: string }[] = [
    { value: "CONNECTED",  icon: Phone,        activeClass: "border-green-500 bg-green-500 text-white" },
    { value: "NOT_PICKED", icon: PhoneMissed,  activeClass: "border-amber-500 bg-amber-500 text-white" },
    { value: "DECLINED",   icon: PhoneOff,     activeClass: "border-destructive bg-destructive text-white" },
];

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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                        <Phone className="h-4 w-4" />
                        Log Call
                    </DialogTitle>
                    <DialogDescription>
                        Record a call attempt for <span className="font-semibold">{leadName}</span>. Visible to your team leader too.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
