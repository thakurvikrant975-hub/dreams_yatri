"use client";

import { useActionState, useEffect, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../components/ui/dialog";
import { createRole, updateRole, type RoleFormState } from "./actions";
import { useRef, useState } from "react";

type Role = {
    id:          string;
    name:        string;
    description: string | null;
};

// ── Shared field error ────────────────────────────────────────────────────────

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
                    <Plus className="h-4 w-4" />
                    Add Role
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Create New Role
                    </DialogTitle>
                    <DialogDescription>
                        Define a role name. You can configure permissions after creation.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={action} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="create-name">Role Name <span className="text-destructive">*</span></Label>
                        <Input
                            id="create-name"
                            name="name"
                            placeholder="e.g. Hotel Manager"
                            autoComplete="off"
                        />
                        <FieldError errors={state.errors} field="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="create-description">Description</Label>
                        <Input
                            id="create-description"
                            name="description"
                            placeholder="Brief description of this role's responsibilities"
                        />
                        <FieldError errors={state.errors} field="description" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
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

const editInitial: RoleFormState = { success: false, message: "" };

export function EditRoleDialog({ role }: { role: Role }) {
    const [open, setOpen] = useState(false);

    const boundAction = updateRole.bind(null, role.id);
    const [state, action, isPending] = useActionState(boundAction, editInitial);

    useEffect(() => {
        if (state.success) {
            toast.success(state.message);
            setOpen(false);
        } else if (state.message && !state.errors) {
            toast.error(state.message);
        }
    }, [state]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Edit Role
                    </DialogTitle>
                    <DialogDescription>
                        Update the role name or description.
                    </DialogDescription>
                </DialogHeader>
                <form action={action} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name">Role Name <span className="text-destructive">*</span></Label>
                        <Input
                            id="edit-name"
                            name="name"
                            defaultValue={role.name}
                            autoComplete="off"
                        />
                        <FieldError errors={state.errors} field="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-description">Description</Label>
                        <Input
                            id="edit-description"
                            name="description"
                            defaultValue={role.description ?? ""}
                            placeholder="Brief description of this role's responsibilities"
                        />
                        <FieldError errors={state.errors} field="description" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}