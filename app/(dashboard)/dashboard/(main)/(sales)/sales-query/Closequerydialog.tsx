"use client";

import { useRef, useState, useTransition } from "react";
import { XCircle } from "lucide-react";
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
import { closeSalesQuery } from "./actions";
import type { CloseReason } from "../../(marketing)/queries/actions";

type Props = {
    salesQueryId: string;
    leadName:     string;
    closeReasons: CloseReason[];
    children:     React.ReactNode;
    onDone?:      () => void;
};

export function CloseQueryDialog({ salesQueryId, leadName, closeReasons, children, onDone }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [selectedReason, setSelectedReason] = useState("");
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const formRef = useRef<HTMLFormElement>(null);

    const isOther = selectedReason === "OTHER";
    const requiresNote = closeReasons.find(r => r.id === selectedReason)?.requiresNote ?? false;

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedReason) {
            setErrors({ closeReasonId: ["Please select a reason for closing"] });
            return;
        }
        const formData = new FormData(e.currentTarget);
        formData.set("closeReasonId", selectedReason);

        startTransition(async () => {
            const result = await closeSalesQuery(salesQueryId, formData);
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

    function handleOpenChange(v: boolean) {
        setOpen(v);
        if (!v) {
            setErrors({});
            setSelectedReason("");
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" /> Close Query
                    </DialogTitle>
                    <DialogDescription>
                        Closing query for <span className="font-semibold">{leadName}</span>.
                        Please select the reason so your team can track outcomes accurately.
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Reason dropdown */}
                    <div className="space-y-1.5">
                        <Label>
                            Reason for Closing <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={selectedReason}
                            onValueChange={(v) => { setSelectedReason(v); setErrors({}); }}
                        >
                            <SelectTrigger className={errors.closeReasonId ? "border-destructive" : ""}>
                                <SelectValue placeholder="Select a reason..." />
                            </SelectTrigger>
                            <SelectContent>
                                {closeReasons.map(r => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.closeReasonId && (
                            <p className="text-xs text-destructive">{errors.closeReasonId[0]}</p>
                        )}
                    </div>

                    {/* Other reason textarea — shown only when "Other" is selected */}
                    {(isOther || requiresNote) && (
                        <div className="space-y-1.5">
                            <Label htmlFor="closeReasonOther">
                                Please Specify <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="closeReasonOther"
                                name="closeReasonOther"
                                placeholder="Describe the reason for closing this query..."
                                rows={3}
                                className={`resize-none text-sm ${errors.closeReasonOther ? "border-destructive" : ""}`}
                            />
                            {errors.closeReasonOther && (
                                <p className="text-xs text-destructive">{errors.closeReasonOther[0]}</p>
                            )}
                        </div>
                    )}

                    {/* Warning banner */}
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2.5">
                        <p className="text-xs text-destructive/80 leading-relaxed">
                            Closing this query will mark it as <strong>Closed</strong> and remove it from your active list.
                            You can reopen it later if needed.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={isPending || !selectedReason}
                        >
                            {isPending ? "Closing..." : "Close Query"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}