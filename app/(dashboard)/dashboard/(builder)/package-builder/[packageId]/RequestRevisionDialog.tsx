"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "./builder-icons";
import { toast } from "sonner";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Label } from "@/app/(dashboard)/dashboard/(main)/components/ui/label";
import { Textarea } from "@/app/(dashboard)/dashboard/(main)/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { requestPackageRevision } from "../action";

type Props = {
    packageId: string;
    packageTitle: string;
    /** Re-fetches the package so the builder unlocks immediately — this
     * page's data lives in local state (loaded once on mount), not React
     * Query/RSC, so nothing else would pick up the DRAFT flip on its own. */
    onSuccess: () => void;
    children: React.ReactNode;
};

export function RequestRevisionDialog({ packageId, packageTitle, onSuccess, children }: Props) {
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [isPending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const trimmed = note.trim();
        if (!trimmed) return;
        startTransition(async () => {
            const result = await requestPackageRevision(packageId, trimmed);
            if (result.success) {
                toast.success("Pulled back for revision — you can edit it again now");
                setOpen(false);
                setNote("");
                onSuccess();
            } else {
                toast.error(result.error ?? "Failed to request a revision");
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNote(""); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" /> Request Revision
                    </DialogTitle>
                    <DialogDescription>
                        Unlocks <span className="font-semibold">{packageTitle}</span> for editing again. Costing will
                        see your note once you resubmit it with Mark Ready.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="revisionNote">
                            What needs another look? <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="revisionNote"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Client asked to swap the Day 2 hotel — updating pricing before it goes out."
                            rows={3}
                            className="resize-none text-sm"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || !note.trim()}>
                            {isPending ? "Submitting..." : "Pull Back for Revision"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
