"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Check, ChevronDown, ChevronUp,
    ShieldCheck, Save, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { updateRoleAccess } from "./actions";
import { FIELD_REGISTRY } from "../lib/rbac/field-registry";
import { SidebarAccessEditor } from "./SidebarAccessEditor";
import type { PermissionSet, Action, ResourcePermission } from "@/app/types/rbac";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = {
    id: string;
    name: string;
    description: string | null;
    permissions: unknown;
    pageAccess: unknown;
    _count: { members: number };
};

// ── Safe parsers ──────────────────────────────────────────────────────────────

function parsePermissions(raw: unknown): PermissionSet {
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is ResourcePermission =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as ResourcePermission).resource === "string" &&
        Array.isArray((p as ResourcePermission).actions)
    );
}

function parsePageAccess(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((href): href is string => typeof href === "string");
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RESOURCES = Object.keys(FIELD_REGISTRY);

const RESOURCE_LABELS: Record<string, string> = {
    destinations: "Destinations",
    hotels: "Hotels",
    team_members: "Team Members",
    packages: "Packages",
    regions: "Regions",
    activities: "Activities",
    categories: "Categories",
    analytics: "Analytics",
    dashboard: "Dashboard",
};

const ACTIONS: { key: Action; label: string; shortLabel: string; activeClass: string }[] = [
    { key: "read", label: "Read", shortLabel: "R", activeClass: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400" },
    { key: "create", label: "Create", shortLabel: "C", activeClass: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800 dark:text-green-400" },
    { key: "update", label: "Update", shortLabel: "U", activeClass: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400" },
    { key: "delete", label: "Delete", shortLabel: "D", activeClass: "bg-destructive/10 text-destructive border-destructive/20" },
];

// ── Resource Block ────────────────────────────────────────────────────────────

function ResourceBlock({
    resource,
    permission,
    onChange,
}: {
    resource: string;
    permission: ResourcePermission | null;
    onChange: (p: ResourcePermission | null) => void;
}) {
    const [expanded, setExpanded] = useState(!!permission);

    const fields = FIELD_REGISTRY[resource] ?? [];
    const actions = permission?.actions ?? [];
    const visible = permission?.fields?.visible ?? [];
    const editable = permission?.fields?.editable ?? [];
    const hasRead = actions.includes("read");

    // ── Action select-all ──────────────────────────────────────────────────────
    const allActionsSelected = ACTIONS.every(a => actions.includes(a.key));
    const someActionsSelected = ACTIONS.some(a => actions.includes(a.key));

    function toggleAllActions() {
        if (allActionsSelected) {
            onChange(null); // clear resource entirely
        } else {
            onChange({
                resource,
                actions: ACTIONS.map(a => a.key),
                fields: { visible: fields.map(f => f.key), editable: fields.map(f => f.key) },
            });
            setExpanded(true);
        }
    }

    function toggleAction(action: Action, on: boolean) {
        if (action === "read" && !on) { onChange(null); return; }

        let newActions = on
            ? (actions.includes("read") ? [...actions, action] : ["read", ...actions, action])
            : actions.filter(a => a !== action);

        onChange({
            resource,
            actions: newActions as Action[],
            fields: {
                visible,
                editable: editable.filter(f => visible.includes(f)),
            },
        });
        if (on) setExpanded(true);
    }

    // ── Visible select-all ─────────────────────────────────────────────────────
    const allVisible = fields.every(f => visible.includes(f.key));
    const someVisible = fields.some(f => visible.includes(f.key));

    function toggleAllVisible() {
        const newVisible = allVisible ? [] : fields.map(f => f.key);
        onChange({
            resource,
            actions: actions.length ? actions : ["read"],
            fields: { visible: newVisible, editable: editable.filter(f => newVisible.includes(f)) },
        });
    }

    function toggleVisible(key: string) {
        const newVisible = visible.includes(key) ? visible.filter(k => k !== key) : [...visible, key];
        onChange({
            resource,
            actions: actions.length ? actions : ["read"],
            fields: { visible: newVisible, editable: editable.filter(f => newVisible.includes(f)) },
        });
    }

    // ── Editable select-all (subset of visible) ────────────────────────────────
    const visibleFields = fields.filter(f => visible.includes(f.key));
    const allEditable = visibleFields.length > 0 && visibleFields.every(f => editable.includes(f.key));
    const someEditable = visibleFields.some(f => editable.includes(f.key));

    function toggleAllEditable() {
        const newEditable = allEditable ? [] : visibleFields.map(f => f.key);
        onChange({ resource, actions, fields: { visible, editable: newEditable } });
    }

    function toggleEditable(key: string) {
        const newEditable = editable.includes(key) ? editable.filter(k => k !== key) : [...editable, key];
        onChange({ resource, actions, fields: { visible, editable: newEditable } });
    }

    return (
        <div className={[
            "rounded-xl border bg-card overflow-hidden transition-all",
            hasRead ? "" : "opacity-60",
        ].join(" ")}>

            {/* ── Header row ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 bg-dashboard-base-100">

                {/* Select-all actions checkbox */}
                <Checkbox
                    checked={allActionsSelected}
                    indeterminate={someActionsSelected && !allActionsSelected}
                    onChange={toggleAllActions}
                />

                {/* Resource name */}
                <span className="text-sm font-medium flex-1">
                    {RESOURCE_LABELS[resource] ?? resource}
                </span>

                {/* Per-action toggles */}
                <div className="flex items-center gap-1.5">
                    {ACTIONS.map(act => {
                        const on = actions.includes(act.key);
                        return (
                            <button
                                key={act.key}
                                type="button"
                                title={act.label}
                                onClick={() => toggleAction(act.key, !on)}
                                className={[
                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                                    on
                                        ? act.activeClass
                                        : "bg-muted/40 text-muted-foreground border-border hover:border-muted-foreground/40",
                                ].join(" ")}
                            >
                                {on && <Check className="h-3 w-3 shrink-0" />}
                                {act.label}
                            </button>
                        );
                    })}
                </div>

                {/* Expand/collapse field section */}
                {hasRead && (
                    <button
                        type="button"
                        onClick={() => setExpanded(v => !v)}
                        className="ml-1 p-1 rounded hover:bg-muted text-muted-foreground"
                    >
                        {expanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                    </button>
                )}
            </div>

            {/* ── Field section ──────────────────────────────────────────────── */}
            {hasRead && expanded && (
                <div className="px-4 py-4 border-t grid grid-cols-2 gap-8">

                    {/* Visible columns */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Visible Columns
                            </p>
                            <Checkbox
                                checked={allVisible}
                                indeterminate={someVisible && !allVisible}
                                onChange={toggleAllVisible}
                                label={allVisible ? "Deselect all" : "Select all"}
                            />
                        </div>
                        <div className="space-y-2">
                            {fields.map(field => (
                                <div key={field.key} className="flex items-center justify-between">
                                    <Checkbox
                                        checked={visible.includes(field.key)}
                                        onChange={() => toggleVisible(field.key)}
                                        label={field.label}
                                    />
                                    {field.sensitive && (
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                            sensitive
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Editable fields */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Editable Fields
                            </p>
                            <Checkbox
                                checked={allEditable}
                                indeterminate={someEditable && !allEditable}
                                onChange={toggleAllEditable}
                                label={allEditable ? "Deselect all" : "Select all"}
                                disabled={visibleFields.length === 0}
                            />
                        </div>
                        {visibleFields.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                                Select visible columns first
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {visibleFields.map(field => (
                                    <Checkbox
                                        key={field.key}
                                        checked={editable.includes(field.key)}
                                        onChange={() => toggleEditable(field.key)}
                                        label={field.label}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export function PermissionPage({ role }: { role: Role }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [localPerms, setLocalPerms] = useState<PermissionSet>(
        parsePermissions(role.permissions)
    );
    const [localPageAccess, setLocalPageAccess] = useState<string[]>(
        parsePageAccess(role.pageAccess)
    );

    // Select-all resources
    const allEnabled = RESOURCES.every(r => localPerms.some(p => p.resource === r && p.actions.includes("read")));
    const someEnabled = RESOURCES.some(r => localPerms.some(p => p.resource === r && p.actions.includes("read")));

    function toggleAllResources() {
        if (allEnabled) {
            setLocalPerms([]);
        } else {
            setLocalPerms(RESOURCES.map(resource => ({
                resource,
                actions: ["read", "create", "update", "delete"] as Action[],
                fields: {
                    visible: (FIELD_REGISTRY[resource] ?? []).map(f => f.key),
                    editable: (FIELD_REGISTRY[resource] ?? []).map(f => f.key),
                },
            })));
        }
    }

    function getPermission(resource: string): ResourcePermission | null {
        return localPerms.find(p => p.resource === resource) ?? null;
    }

    function handleResourceChange(resource: string, perm: ResourcePermission | null) {
        setLocalPerms(prev => {
            const filtered = prev.filter(p => p.resource !== resource);
            return perm ? [...filtered, perm] : filtered;
        });
    }

    function handleSave() {
        startTransition(async () => {
            const result = await updateRoleAccess(role.id, {
                permissions: localPerms,
                pageAccess: localPageAccess,
            });
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    const activeCount = localPerms.filter(p => p.actions.includes("read")).length;

    return (
        <div className="space-y-6">

            {/* ── Sticky save bar ──────────────────────────────────────────── */}
            <div className="sticky top-0 z-10 rounded-lg px-6 py-3 bg-dashboard-base-100 backdrop-blur border-b flex items-center justify-between ">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-none">{role.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {role.description ?? "No description"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {role._count.members} member{role._count.members !== 1 ? "s" : ""}
                    </div>
                    <Badge variant="outline" className="text-xs text-dashboard-warning border rounded-md border-dashboard-warning">
                        {activeCount}/{RESOURCES.length} resources
                    </Badge>
                    <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-2 bg-dashboard-primary rounded-md">
                        <Save className="h-3.5 w-3.5" />
                        {isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            <Tabs defaultValue="permissions">
                <TabsList variant="line">
                    <TabsTrigger value="permissions">Data Permissions</TabsTrigger>
                    <TabsTrigger value="sidebar">Sidebar Access</TabsTrigger>
                </TabsList>

                {/* ── Data Permissions tab ────────────────────────────────── */}
                <TabsContent value="permissions" className="space-y-3 pt-4">

                    {/* Select-all header */}
                    <div className="flex items-center justify-between rounded-xl border bg-dashboard-base-100 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                checked={allEnabled}
                                indeterminate={someEnabled && !allEnabled}
                                onChange={toggleAllResources}
                            />
                            <div>
                                <p className="text-sm font-medium">All Resources</p>
                                <p className="text-xs text-muted-foreground">
                                    Toggle full access across every module
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {ACTIONS.map(act => (
                                <span key={act.key} className={[
                                    "px-2 py-0.5 rounded text-xs font-medium border",
                                    act.activeClass,
                                ].join(" ")}>
                                    {act.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Per-resource rows */}
                    <div className="space-y-3">
                        {RESOURCES.map(resource => (
                            <ResourceBlock
                                key={resource}
                                resource={resource}
                                permission={getPermission(resource)}
                                onChange={(perm) => handleResourceChange(resource, perm)}
                            />
                        ))}
                    </div>
                </TabsContent>

                {/* ── Sidebar Access tab ───────────────────────────────────── */}
                <TabsContent value="sidebar" className="pt-4">
                    <SidebarAccessEditor value={localPageAccess} onChange={setLocalPageAccess} />
                </TabsContent>
            </Tabs>

            {/* ── Bottom save ───────────────────────────────────────────────── */}
            <div className="flex justify-end pt-2 border-t">
                <Button onClick={handleSave} disabled={isPending} className="gap-2 bg-dashboard-primary rounded-md">
                    <Save className="h-3.5 w-3.5" />
                    {isPending ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </div>
    );
}