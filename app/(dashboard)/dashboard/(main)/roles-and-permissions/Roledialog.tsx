"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../components/ui/dialog";
import { createRole, updateRole, type RoleFormState } from "./actions";

type Role = { id: string; name: string; description: string | null };

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
    const msgs = errors?.[field];
    if (!msgs?.length) return null;
    return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>;
}

// ── Create ────────────────────────────────────────────────────────────────────

const createInitial: RoleFormState = { success: false, message: "" };

export function CreateRoleDialog() {
    const [open, setOpen] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const [state, action, isPending] = useActionState(createRole, createInitial);

    useEffect(() => {
        if (state.success) {
            toast.success(state.message);
            setOpen(false);
            formRef.current?.reset();
        } else if (state.message && !state.errors) {
            toast.error(state.message);
        }
    }, [state]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Role
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" /> Create New Role
                    </DialogTitle>
                    <DialogDescription>
                        Define a role. Configure permissions after creation.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={action} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="c-name">Role Name <span className="text-destructive">*</span></Label>
                        <Input id="c-name" name="name" placeholder="e.g. Hotel Manager" autoComplete="off" />
                        <FieldError errors={state.errors} field="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="c-desc">Description</Label>
                        <Input id="c-desc" name="description" placeholder="Brief responsibilities" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Creating..." : "Create Role"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Edit ──────────────────────────────────────────────────────────────────────

export function EditRoleDialog({ role, children }: { role: Role; children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const formRef = useRef<HTMLFormElement>(null);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const result = await updateRole(role.id, formData);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setErrors({});
            } else if (result.errors) {
                setErrors(result.errors);
                toast.error(result.message);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" /> Edit Role
                    </DialogTitle>
                    <DialogDescription>Update the role name or description.</DialogDescription>
                </DialogHeader>
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="e-name">Role Name <span className="text-destructive">*</span></Label>
                        <Input id="e-name" name="name" defaultValue={role.name} autoComplete="off" />
                        <FieldError errors={errors} field="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="e-desc">Description</Label>
                        <Input id="e-desc" name="description" defaultValue={role.description ?? ""} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}