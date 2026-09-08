"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import { requestQueryReopen } from "../../reopen-requests/actions";

type Props = {
    queryId: string;
    leadName: string;
    children: React.ReactNode;
    onDone?: () => void;
};

export function RequestReopenDialog({ queryId, leadName, children, onDone }: Props) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [isPending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!reason.trim()) return;

        startTransition(async () => {
            const result = await requestQueryReopen(queryId, reason);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setReason("");
                onDone?.();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setReason(""); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                        <RotateCcw className="h-4 w-4" />
                        Request Reopen
                    </DialogTitle>
                    <DialogDescription>
                        Reopening <span className="font-semibold">{leadName}</span> now needs review — explain
                        why, and a reviewer will approve or reject the request.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Client got back in touch and wants to restart the conversation..."
                            rows={4}
                            className="resize-none text-sm"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || !reason.trim()}>
                            {isPending ? "Sending..." : "Send Request"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
