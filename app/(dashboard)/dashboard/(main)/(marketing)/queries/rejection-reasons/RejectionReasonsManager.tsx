"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck, X, Check } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import {
    createRejectionReason, updateRejectionReason, deleteRejectionReason, toggleRejectionReason,
    type RejectionReason, type RejectionReasonFormState,
} from "../actions";

const EMPTY_STATE: RejectionReasonFormState = { success: false, message: "" };

// Both create/update actions are typed for useActionState's (prevState,
// formData) shape, but nothing requires actually using useActionState —
// calling them directly from a submit handler inside a transition avoids
// the "setState in an effect reacting to action state" pattern (cascading
// renders) that the useActionState+useEffect combo would need here to
// close the form / clear it / notify the parent on success.
function AddReasonForm() {
    const formRef = useRef<HTMLFormElement>(null);
    const [open, setOpen] = useState(false);
    const [errors, setErrors] = useState<RejectionReasonFormState["errors"]>();
    const [isPending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const result = await createRejectionReason(EMPTY_STATE, formData);
            if (result.success) {
                toast.success(result.message);
                formRef.current?.reset();
                setErrors(undefined);
                setOpen(false);
            } else {
                toast.error(result.message);
                setErrors(result.errors);
            }
        });
    }

    if (!open) {
        return (
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
                <Plus className="size-3.5" /> Add Reason
            </Button>
        );
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="rounded-lg border border-border p-3 space-y-2.5 bg-muted/30">
            <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                    <Label htmlFor="new-label" className="text-xs mb-1 block">Label</Label>
                    <Input id="new-label" name="label" placeholder="e.g. Wrong Hotel Selected" className="h-9 text-sm" required />
                    {errors?.label && <p className="text-[11px] text-destructive mt-1">{errors.label[0]}</p>}
                </div>
                <div>
                    <Label htmlFor="new-description" className="text-xs mb-1 block">Description (optional)</Label>
                    <Input id="new-description" name="description" placeholder="Shown as a tooltip" className="h-9 text-sm" />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                    <Check className="size-3.5" /> {isPending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function EditReasonForm({ reason, onDone }: { reason: RejectionReason; onDone: () => void }) {
    const [errors, setErrors] = useState<RejectionReasonFormState["errors"]>();
    const [isPending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const result = await updateRejectionReason(reason.id, EMPTY_STATE, formData);
            if (result.success) {
                toast.success(result.message);
                onDone();
            } else {
                toast.error(result.message);
                setErrors(result.errors);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="flex-1 grid sm:grid-cols-2 gap-2.5">
            <div>
                <Input name="label" defaultValue={reason.label} className="h-9 text-sm" required />
                {errors?.label && <p className="text-[11px] text-destructive mt-1">{errors.label[0]}</p>}
            </div>
            <div className="flex items-center gap-2">
                <Textarea name="description" defaultValue={reason.description ?? ""} rows={1} className="text-sm min-h-9 resize-none flex-1" placeholder="Description (optional)" />
                <Button type="submit" size="icon" variant="outline" className="size-9 shrink-0" disabled={isPending} title="Save">
                    <Check className="size-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" onClick={onDone} title="Cancel">
                    <X className="size-3.5" />
                </Button>
            </div>
        </form>
    );
}

function ReasonRow({ reason }: { reason: RejectionReason }) {
    const [editing, setEditing] = useState(false);
    const [isToggling, startToggle] = useTransition();
    const [isDeleting, startDelete] = useTransition();

    function handleToggle() {
        startToggle(async () => {
            const result = await toggleRejectionReason(reason.id, !reason.isActive);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    function handleDelete() {
        if (!confirm(`Delete "${reason.label}"? This can't be undone.`)) return;
        startDelete(async () => {
            const result = await deleteRejectionReason(reason.id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    if (editing) {
        return (
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <EditReasonForm reason={reason} onDone={() => setEditing(false)} />
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 rounded-lg border p-3 ${reason.isActive ? "border-border" : "border-border bg-muted/40 opacity-60"}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{reason.label}</span>
                    {reason.isSystem && (
                        <Badge variant="outline" className="gap-1 text-[10px] py-0">
                            <ShieldCheck className="size-2.5" /> System
                        </Badge>
                    )}
                    {!reason.isActive && (
                        <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">Disabled</Badge>
                    )}
                    {reason._count.queries > 0 && (
                        <span className="text-[11px] text-muted-foreground">used {reason._count.queries}×</span>
                    )}
                </div>
                {reason.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{reason.description}</p>
                )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={handleToggle} disabled={isToggling}>
                    {reason.isActive ? "Disable" : "Enable"}
                </Button>
                <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setEditing(true)} title="Edit">
                    <Pencil className="size-3.5" />
                </Button>
                {!reason.isSystem && (
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={handleDelete} disabled={isDeleting} title="Delete">
                        <Trash2 className="size-3.5" />
                    </Button>
                )}
            </div>
        </div>
    );
}

export function RejectionReasonsManager({ reasons }: { reasons: RejectionReason[] }) {
    return (
        <div className="space-y-4 max-w-3xl">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    These show up in the reject dialog on Queries and in costing&apos;s pricing review. Disabled reasons stay attached to past records but won&apos;t be offered for new rejections.
                </p>
            </div>

            <AddReasonForm />

            {reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-6 text-center">No rejection reasons yet.</p>
            ) : (
                <div className="space-y-2">
                    {reasons.map((r) => <ReasonRow key={r.id} reason={r} />)}
                </div>
            )}
        </div>
    );
}
