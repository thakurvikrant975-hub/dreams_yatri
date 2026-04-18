"use client";

import { useState, useTransition } from "react";
import { Settings2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../components/ui/dialog";
import { updateRolePermissions } from "./actions";
import { FIELD_REGISTRY } from "../lib/rbac/field-registry";
import type { PermissionSet, Action, ResourcePermission } from "../lib/rbac/permissions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = {
    id:          string;
    name:        string;
    permissions: PermissionSet;
};

const RESOURCES = Object.keys(FIELD_REGISTRY) as string[];

const ACTIONS: { key: Action; label: string; color: string }[] = [
    { key: "read",   label: "Read",   color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400" },
    { key: "create", label: "Create", color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800 dark:text-green-400" },
    { key: "update", label: "Update", color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400" },
    { key: "delete", label: "Delete", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

// Resource label map for display
const RESOURCE_LABELS: Record<string, string> = {
    destinations:  "Destinations",
    hotels:        "Hotels",
    team_members:  "Team Members",
    packages:      "Packages",
    regions:       "Regions",
    activities:    "Activities",
    categories:    "Categories",
    analytics:     "Analytics",
    dashboard:     "Dashboard",
};

// ── Action Checkbox ───────────────────────────────────────────────────────────

function ActionToggle({
    action,
    checked,
    onChange,
}: {
    action: typeof ACTIONS[number];
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={[
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                checked
                    ? action.color
                    : "bg-muted/40 text-muted-foreground border-border hover:border-muted-foreground/50",
            ].join(" ")}
        >
            {checked && <Check className="h-3 w-3 shrink-0" />}
            {action.label}
        </button>
    );
}

// ── Field Multi-select ────────────────────────────────────────────────────────

function FieldSelect({
    resource,
    selected,
    onChange,
    label,
    disabled,
    constrainTo,
}: {
    resource:    string;
    selected:    string[];
    onChange:    (fields: string[]) => void;
    label:       string;
    disabled?:   boolean;
    constrainTo?: string[]; // editable must be subset of visible
}) {
    const fields = FIELD_REGISTRY[resource] ?? [];
    const available = constrainTo ? fields.filter(f => constrainTo.includes(f.key)) : fields;

    function toggle(key: string) {
        if (selected.includes(key)) {
            onChange(selected.filter(k => k !== key));
        } else {
            onChange([...selected, key]);
        }
    }

    function toggleAll() {
        if (selected.length === available.length) {
            onChange([]);
        } else {
            onChange(available.map(f => f.key));
        }
    }

    if (disabled || available.length === 0) {
        return (
            <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="text-xs text-muted-foreground italic">
                    {disabled ? "Enable Read access first" : "No fields available"}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                >
                    {selected.length === available.length ? "Clear all" : "Select all"}
                </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {available.map(field => {
                    const isSelected = selected.includes(field.key);
                    return (
                        <button
                            key={field.key}
                            type="button"
                            onClick={() => toggle(field.key)}
                            className={[
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono transition-all",
                                isSelected
                                    ? "bg-primary/10 text-primary border-primary/30"
                                    : "bg-muted/40 text-muted-foreground border-border hover:border-muted-foreground/40",
                                field.sensitive ? "italic" : "",
                            ].join(" ")}
                        >
                            {isSelected && <Check className="h-2.5 w-2.5 shrink-0" />}
                            {field.label}
                            {field.sensitive && (
                                <span className="text-[10px] text-muted-foreground">🔒</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Resource Row ──────────────────────────────────────────────────────────────

function ResourceRow({
    resource,
    permission,
    onChange,
}: {
    resource:   string;
    permission: ResourcePermission | null;
    onChange:   (perm: ResourcePermission | null) => void;
}) {
    const hasRead   = permission?.actions.includes("read") ?? false;
    const actions   = permission?.actions ?? [];
    const visible   = permission?.fields.visible ?? [];
    const editable  = permission?.fields.editable ?? [];

    function toggleAction(action: Action, checked: boolean) {
        let newActions = checked
            ? [...actions, action]
            : actions.filter(a => a !== action);

        // Enforce: if read is removed, clear everything
        if (action === "read" && !checked) {
            onChange(null);
            return;
        }

        // Enforce: non-read actions require read
        if (action !== "read" && checked && !actions.includes("read")) {
            newActions = ["read", ...newActions];
        }

        onChange({
            resource,
            actions: newActions,
            fields: {
                visible:  action === "read" && checked ? visible : checked ? visible : visible,
                editable: editable.filter(f => visible.includes(f)),
            },
        });
    }

    function handleVisibleChange(fields: string[]) {
        // If a visible field is removed, also remove from editable
        const newEditable = editable.filter(f => fields.includes(f));
        onChange({
            resource,
            actions: actions.length ? actions : ["read"],
            fields: { visible: fields, editable: newEditable },
        });
    }

    function handleEditableChange(fields: string[]) {
        onChange({
            resource,
            actions,
            fields: { visible, editable: fields },
        });
    }

    return (
        <div className={[
            "rounded-xl border bg-card overflow-hidden transition-all",
            hasRead ? "border-border" : "border-border/50 opacity-60",
        ].join(" ")}>
            {/* Resource header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                        {RESOURCE_LABELS[resource] ?? resource}
                    </span>
                    {hasRead && (
                        <Badge variant="secondary" className="text-[10px] py-0">
                            {actions.length} action{actions.length !== 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>
                {/* CRUD toggles */}
                <div className="flex items-center gap-1.5">
                    {ACTIONS.map(act => (
                        <ActionToggle
                            key={act.key}
                            action={act}
                            checked={actions.includes(act.key)}
                            onChange={(checked) => toggleAction(act.key, checked)}
                        />
                    ))}
                </div>
            </div>

            {/* Field selectors */}
            {hasRead && (
                <div className="px-4 py-3 grid grid-cols-2 gap-6">
                    <FieldSelect
                        resource={resource}
                        selected={visible}
                        onChange={handleVisibleChange}
                        label="Visible Columns"
                        disabled={!hasRead}
                    />
                    <FieldSelect
                        resource={resource}
                        selected={editable}
                        onChange={handleEditableChange}
                        label="Editable Fields"
                        disabled={!hasRead}
                        constrainTo={visible}
                    />
                </div>
            )}
        </div>
    );
}

// ── Permission Builder Dialog ─────────────────────────────────────────────────

export function PermissionBuilderDialog({ role }: { role: Role }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Local state for editing — only committed on save
    const [localPerms, setLocalPerms] = useState<PermissionSet>(role.permissions);

    function getPermission(resource: string): ResourcePermission | null {
        return localPerms.find(p => p.resource === resource) ?? null;
    }

    function handleResourceChange(resource: string, perm: ResourcePermission | null) {
        setLocalPerms(prev => {
            const filtered = prev.filter(p => p.resource !== resource);
            if (!perm) return filtered;
            return [...filtered, perm];
        });
    }

    function handleSave() {
        startTransition(async () => {
            const result = await updateRolePermissions(role.id, localPerms);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
            } else {
                toast.error(result.message);
            }
        });
    }

    function handleOpenChange(v: boolean) {
        setOpen(v);
        // Reset local state on open to pick up latest saved permissions
        if (v) setLocalPerms(role.permissions);
    }

    const activeResources = localPerms.filter(p => p.actions.includes("read")).length;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings2 className="h-3.5 w-3.5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-primary" />
                        Configure Permissions — {role.name}
                    </DialogTitle>
                    <DialogDescription>
                        Toggle CRUD access per resource, then select which columns are visible and editable.
                        Removing <span className="font-medium">Read</span> disables the entire resource.
                    </DialogDescription>
                </DialogHeader>

                {/* Active count badge */}
                <div className="flex items-center gap-2 py-1">
                    <Badge variant="outline" className="text-xs">
                        {activeResources} of {RESOURCES.length} resources enabled
                    </Badge>
                </div>

                {/* Resource matrix */}
                <div className="space-y-3">
                    {RESOURCES.map(resource => (
                        <ResourceRow
                            key={resource}
                            resource={resource}
                            permission={getPermission(resource)}
                            onChange={(perm) => handleResourceChange(resource, perm)}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t mt-2">
                    <p className="text-xs text-muted-foreground">
                        Changes take effect on next login for affected members.
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isPending}>
                            {isPending ? "Saving..." : "Save Permissions"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}