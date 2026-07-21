"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { addFollowUp, deleteFollowUp, getMyFollowUpForQuery } from "./actions";

type FollowUpData = {
    id: string;
    note: string;
    followUpAt: Date | null;
};

type Props = {
    salesQueryId: string;
    leadName: string;
    children: React.ReactNode;
    onDone?: () => void;
};

// Formats a Date into the value a `datetime-local` input expects (local time,
// no timezone suffix) — e.g. "2026-07-07T14:45".
function toDatetimeLocalValue(d: Date): string {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const QUICK_FOLLOWUP_OPTIONS = [
    { label: "10 min", ms: 10 * 60 * 1000 },
    { label: "30 min", ms: 30 * 60 * 1000 },
    { label: "1 hr", ms: 60 * 60 * 1000 },
    { label: "6 hr", ms: 6 * 60 * 60 * 1000 },
    { label: "1 day", ms: 24 * 60 * 60 * 1000 },
];

export function AddFollowUpDialog({ salesQueryId, leadName, children, onDone }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isDeleting, startDelete] = useTransition();
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [existing, setExisting] = useState<FollowUpData | null>(null);
    const [followUpAtValue, setFollowUpAtValue] = useState("");
    const formRef = useRef<HTMLFormElement>(null);

    // Load existing follow-up when dialog opens
    useEffect(() => {
        if (!open) return;
        setIsLoading(true);
        getMyFollowUpForQuery(salesQueryId).then(fu => {
            if (fu) {
                setExisting({
                    id: fu.id,
                    note: fu.note,
                    followUpAt: fu.followUpAt ? new Date(fu.followUpAt) : null,
                });
                setFollowUpAtValue(fu.followUpAt ? toDatetimeLocalValue(new Date(fu.followUpAt)) : "");
            } else {
                setExisting(null);
                setFollowUpAtValue("");
            }
        }).finally(() => setIsLoading(false));
    }, [open, salesQueryId]);

    function setQuickFollowUp(ms: number) {
        setFollowUpAtValue(toDatetimeLocalValue(new Date(Date.now() + ms)));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        // The <input type="datetime-local"> value has no timezone info
        // ("2026-07-30T14:45") — `new Date()` parsing that string SERVER-SIDE
        // would interpret it in the server's timezone, not the user's. Convert
        // it here (in the browser, where the string genuinely means "local
        // time") into an unambiguous ISO instant before it leaves the client.
        if (followUpAtValue) {
            formData.set("followUpAt", new Date(followUpAtValue).toISOString());
        }

        startTransition(async () => {
            const result = await addFollowUp(salesQueryId, formData);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setErrors({});
                setExisting(null);
                onDone?.();
            } else if (result.errors) {
                setErrors(result.errors);
            } else {
                toast.error(result.message);
            }
        });
    }

    function handleDelete() {
        if (!existing) return;
        startDelete(async () => {
            const result = await deleteFollowUp(existing.id);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setExisting(null);
                onDone?.();
            } else {
                toast.error(result.message);
            }
        });
    }

    const isUpdate = Boolean(existing);

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                        <CalendarClock className="h-4 w-4" />
                        {isUpdate ? "Update Follow-Up" : "Add Follow-Up"}
                    </DialogTitle>
                    <DialogDescription>
                        {isUpdate
                            ? <>Updating your follow-up for <span className="font-semibold">{leadName}</span>. Only you see your own follow-ups.</>
                            : <>Log a follow-up for <span className="font-semibold">{leadName}</span>. Only you will see this.</>
                        }
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-8 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                ) : (
                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="note">
                                Follow-Up Note{" "}
                                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                            </Label>
                            <Textarea
                                id="note"
                                name="note"
                                // Pre-fill with existing note if updating
                                defaultValue={existing?.note ?? ""}
                                placeholder="e.g. Called customer — interested in Manali package. Will confirm budget by Friday..."
                                rows={4}
                                className={`resize-none text-sm ${errors.note ? "border-destructive" : ""}`}
                            />
                            {errors.note && (
                                <p className="text-xs text-destructive">{errors.note[0]}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="followUpAt">
                                Schedule Next Reminder{" "}
                                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                            </Label>
                            <Input
                                id="followUpAt"
                                name="followUpAt"
                                type="datetime-local"
                                className="text-sm"
                                value={followUpAtValue}
                                onChange={(e) => setFollowUpAtValue(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                            />
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {QUICK_FOLLOWUP_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => setQuickFollowUp(opt.ms)}
                                        className="px-2.5 py-1 rounded-full border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                                    >
                                        +{opt.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                You'll get a reminder notification when this time arrives.
                            </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                            {/* Delete button — only shown if updating existing */}
                            {isUpdate && existing && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            {isDeleting ? "Removing..." : "Remove Follow-Up"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Remove Follow-Up?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove your follow-up note for{" "}
                                                <span className="font-semibold">{leadName}</span>.
                                                This cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDelete}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                Yes, Remove
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}

                            <div className="flex gap-2 ml-auto">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isPending}>
                                    {isPending
                                        ? (isUpdate ? "Updating..." : "Saving...")
                                        : (isUpdate ? "Update Follow-Up" : "Save Follow-Up")}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}