"use client";

import { useState, useTransition, useRef } from "react";
import { XCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { rejectQuery } from "../../(marketing)/queries/actions";
import type { RejectionReason } from "../../(marketing)/queries/actions";

type Props = {
    queryId:          string;
    leadName:         string;
    reasons:          RejectionReason[];
    children:         React.ReactNode;
    onDone?:          () => void;
};

export function RejectQueryDialog({ queryId, leadName, reasons, children, onDone }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [selectedReason, setSelectedReason] = useState("");
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const formRef = useRef<HTMLFormElement>(null);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedReason) {
            setErrors({ rejectionReasonId: ["Please select a rejection reason"] });
            return;
        }
        const formData = new FormData(e.currentTarget);
        formData.set("rejectionReasonId", selectedReason);

        startTransition(async () => {
            const result = await rejectQuery(queryId, formData);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setSelectedReason("");
                setErrors({});
                onDone?.();
            } else if (result.errors) {
                setErrors(result.errors);
            } else {
                toast.error(result.message);
            }
        });
    }

    const activeReasons = reasons.filter(r => r.isActive);

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setErrors({}); setSelectedReason(""); } }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" /> Reject Query
                    </DialogTitle>
                    <DialogDescription>
                        Rejecting enquiry from <span className="font-semibold">{leadName}</span>.
                        Select a reason so data stays actionable.
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Reason Select */}
                    <div className="space-y-1.5">
                        <Label>
                            Rejection Reason <span className="text-destructive">*</span>
                        </Label>
                        <Select value={selectedReason} onValueChange={(v) => { setSelectedReason(v); setErrors({}); }}>
                            <SelectTrigger className={errors.rejectionReasonId ? "border-destructive" : ""}>
                                <SelectValue placeholder="Select a reason..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeReasons.length === 0 && (
                                    <SelectItem value="__none__" disabled>No reasons configured</SelectItem>
                                )}
                                {activeReasons.map(r => (
                                    <SelectItem key={r.id} value={r.id}>
                                        <span className="flex flex-col">
                                            <span>{r.label}</span>
                                            {r.description && (
                                                <span className="text-[10px] text-muted-foreground">{r.description}</span>
                                            )}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.rejectionReasonId && (
                            <p className="text-xs text-destructive">{errors.rejectionReasonId[0]}</p>
                        )}
                    </div>

                    {/* Optional note */}
                    <div className="space-y-1.5">
                        <Label htmlFor="rejectionNote">
                            Additional Note{" "}
                            <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id="rejectionNote"
                            name="rejectionNote"
                            placeholder="e.g. Customer said they already booked with MakeMyTrip..."
                            rows={3}
                            className="resize-none text-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending || !selectedReason}
                            variant="destructive"
                        >
                            {isPending ? "Rejecting..." : "Confirm Rejection"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}