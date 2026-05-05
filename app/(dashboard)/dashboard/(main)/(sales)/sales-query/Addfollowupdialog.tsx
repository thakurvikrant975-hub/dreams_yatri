"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import { addFollowUp } from "./actions";

type Props = {
    salesQueryId: string;
    leadName: string;
    children: React.ReactNode;
    onDone?: () => void;
    // Pass existing follow-up data to pre-fill when updating
    existingNote?: string;
    existingFollowUpAt?: string; // ISO datetime string
};

export function AddFollowUpDialog({
    salesQueryId,
    leadName,
    children,
    onDone,
    existingNote,
    existingFollowUpAt,
}: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const formRef = useRef<HTMLFormElement>(null);

    const isUpdate = Boolean(existingNote);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            const result = await addFollowUp(salesQueryId, formData);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setErrors({});
                formRef.current?.reset();
                onDone?.();
            } else if (result.errors) {
                setErrors(result.errors);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) setErrors({});
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                        <CalendarClock className="h-4 w-4" />
                        {isUpdate ? "Update Follow-Up" : "Add Follow-Up"}
                    </DialogTitle>
                    <DialogDescription>
                        {isUpdate
                            ? <>Updating your existing follow-up for <span className="font-semibold">{leadName}</span>. Your previous note will be replaced.</>
                            : <>Log a follow-up note for <span className="font-semibold">{leadName}</span>. Only you will see your follow-ups.</>
                        }
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="note">
                            Follow-Up Note <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="note"
                            name="note"
                            defaultValue={existingNote}
                            placeholder="e.g. Called customer — they are interested in Manali package. Will confirm budget by Friday..."
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
                            defaultValue={existingFollowUpAt?.slice(0, 16)}
                            min={new Date().toISOString().slice(0, 16)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Appears as a reminder on your My Follow-Ups page.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending
                                ? (isUpdate ? "Updating..." : "Saving...")
                                : (isUpdate ? "Update Follow-Up" : "Save Follow-Up")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}