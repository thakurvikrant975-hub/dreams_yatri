"use client";

import { useState, useTransition } from "react";
import { Badge }    from "../components/ui/badge";
import { Button }   from "../components/ui/button";
import { Trash2, ShieldCheck, Users, ShieldOff } from "lucide-react";
import { toast }    from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EditRoleDialog } from "./Roledialog";
import { PermissionBuilderDialog } from "./Permissionbuilder";
import { deleteRole }                 from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters }               from "../components/dashboard/Tablefilters";
import { Stats }                      from "../components/dashboard/Stats";
import type { PermissionSet, ResourcePermission } from "@/app/types/rbac";

// ── Safe parser — Prisma returns Json as unknown ───────────────────────────────

function parsePermissions(raw: unknown): PermissionSet {
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is ResourcePermission =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as ResourcePermission).resource === "string" &&
        Array.isArray((p as ResourcePermission).actions)
    );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = {
    id:          string;
    name:        string;
    description: string | null;
    permissions: unknown; // Prisma Json — parsed at render time
    createdAt:   Date;
    updatedAt:   Date;
    _count:      { members: number };
};

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteRoleDialog({ id, name, memberCount }: { id: string; name: string; memberCount: number }) {
    const [isPending, startTransition] = useTransition();

    function handleDelete() {
        startTransition(async () => {
            const result = await deleteRole(id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete{" "}
                        <span className="font-semibold">{name}</span>?
                        {memberCount > 0 && (
                            <span className="block mt-2 text-destructive font-medium">
                                ⚠ {memberCount} team member(s) are assigned this role. Reassign them first.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending || memberCount > 0}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ── Permission Summary Badges ─────────────────────────────────────────────────

function PermissionSummary({ permissions: raw }: { permissions: unknown }) {
    const permissions = parsePermissions(raw);
    const activeResources = permissions.filter(p => p.actions.includes("read"));

    if (activeResources.length === 0) {
        return (
            <span className="flex items-center gap-1 text-xs text-muted-foreground italic">
                <ShieldOff className="h-3 w-3" />
                No access configured
            </span>
        );
    }

    // Show first 3, then +N
    const shown = activeResources.slice(0, 3);
    const rest  = activeResources.length - 3;

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {shown.map(p => (
                <Badge key={p.resource} variant="secondary" className="text-[10px] py-0 capitalize">
                    {p.resource.replace("_", " ")}
                </Badge>
            ))}
            {rest > 0 && (
                <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
                    +{rest} more
                </Badge>
            )}
        </div>
    );
}

// ── CRUD Action Dots ──────────────────────────────────────────────────────────

function ActionDots({ permissions: raw }: { permissions: unknown }) {
    const permissions = parsePermissions(raw);
    const allActions = new Set(permissions.flatMap(p => p.actions));

    const ACTION_CONFIG = [
        { key: "read",   label: "R", color: "bg-blue-500" },
        { key: "create", label: "C", color: "bg-green-500" },
        { key: "update", label: "U", color: "bg-amber-500" },
        { key: "delete", label: "D", color: "bg-destructive" },
    ] as const;

    return (
        <div className="flex items-center gap-1">
            {ACTION_CONFIG.map(({ key, label, color }) => (
                <span
                    key={key}
                    title={key}
                    className={[
                        "h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center text-white",
                        allActions.has(key) ? color : "bg-gray-500 text-muted-foreground",
                    ].join(" ")}
                >
                    {label}
                </span>
            ))}
        </div>
    );
}

// ── Main Table ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export function RolesTable({ roles }: { roles: Role[] }) {
    const [search,      setSearch]      = useState("");
    const [filterAccess, setFilterAccess] = useState("all");
    const [page,        setPage]        = useState(1);

    // ── Filter logic ───────────────────────────────────────────────────────────
    const filtered = roles.filter(r => {
        const matchSearch = !search
            || r.name.toLowerCase().includes(search.toLowerCase())
            || (r.description ?? "").toLowerCase().includes(search.toLowerCase());

        const matchAccess =
            filterAccess === "all"
            || (filterAccess === "configured" && parsePermissions(r.permissions).length > 0)
            || (filterAccess === "empty"      && parsePermissions(r.permissions).length === 0);

        return matchSearch && matchAccess;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterAccess !== "all";

    // ── Stats ──────────────────────────────────────────────────────────────────
    const totalMembers    = roles.reduce((acc, r) => acc + r._count.members, 0);
    const configuredRoles = roles.filter(r => parsePermissions(r.permissions).length > 0).length;

    // ── Columns ────────────────────────────────────────────────────────────────
    const columns: ColumnDef<Role>[] = [
        {
            header: "Role",
            width:  "w-[220px]",
            cell: (role) => (
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">{role.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {role.description ?? "No description"}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: "Resources",
            cell: (role) => <PermissionSummary permissions={role.permissions} />,
        },
        {
            header: "Access",
            cell: (role) => <ActionDots permissions={role.permissions} />,
        },
        {
            header: "Members",
            align:  "center",
            cell: (role) => (
                <span className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {role._count.members}
                </span>
            ),
        },
        {
            header: "Last Updated",
            cell: (role) => (
                <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(role.updatedAt), { addSuffix: true })}
                </span>
            ),
        },
        {
            header: "Actions",
            align:  "right",
            width:  "w-[120px]",
            cell: (role) => (
                <div className="flex items-center justify-end gap-1">
                    <PermissionBuilderDialog role={{ ...role, permissions: parsePermissions(role.permissions) }} />
                    <EditRoleDialog role={role} />
                    <DeleteRoleDialog
                        id={role.id}
                        name={role.name}
                        memberCount={role._count.members}
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">

            {/* Stats — always from full dataset */}
            <Stats
                rows={[
                    { label: "Total Roles",      value: roles.length },
                    { label: "Configured",        value: configuredRoles },
                    { label: "Unconfigured",      value: roles.length - configuredRoles, muted: true },
                    { label: "Total Members",     value: totalMembers },
                ]}
            />

            {/* Filters */}
            <TableFilters
                search={search}
                onSearchChange={(v) => { setSearch(v); setPage(1); }}
                searchPlaceholder="Search roles..."
                filteredCount={isFiltering ? filtered.length : undefined}
                totalCount={isFiltering ? roles.length : undefined}
                filters={[
                    {
                        value:       filterAccess,
                        onChange:    (v) => { setFilterAccess(v); setPage(1); },
                        placeholder: "All Roles",
                        width:       "w-40",
                        options: [
                            { label: "Configured",   value: "configured" },
                            { label: "Unconfigured", value: "empty" },
                        ],
                    },
                ]}
            />

            {/* Table */}
            <DataTable
                data={paginated}
                columns={columns}
                rowKey={(r) => r.id}
                emptyState={
                    <div className="flex flex-col items-center gap-2">
                        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">No roles found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters or create a new role</p>
                    </div>
                }
                pagination={{
                    currentPage:  safePage,
                    totalPages,
                    onPageChange: setPage,
                }}
            />
        </div>
    );
}