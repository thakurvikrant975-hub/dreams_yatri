"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Trash2, ShieldCheck, Users, ShieldOff, Settings2, Pencil, UserRoundKey, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EditRoleDialog } from "./Roledialog";
import { deleteRole } from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import type { PermissionSet, ResourcePermission } from "@/app/types/rbac";


// ── Types ─────────────────────────────────────────────────────────────────────

type Role = {
    id: string;
    name: string;
    description: string | null;
    permissions: unknown;
    createdAt: Date;
    updatedAt: Date;
    _count: { members: number };
};

// ── Safe parser ───────────────────────────────────────────────────────────────

function parsePermissions(raw: unknown): PermissionSet {
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is ResourcePermission =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as ResourcePermission).resource === "string" &&
        Array.isArray((p as ResourcePermission).actions)
    );
}

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
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-dashboard-error hover:text-dashboard-error hover:bg-dashboard-error/10"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete <span className="font-semibold">{name}</span>?
                        {memberCount > 0 && (
                            <span className="block mt-2 text-dashboard-error font-medium">
                                ⚠ {memberCount} team member(s) assigned. Reassign them first.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending || memberCount > 0}
                        className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ── Permission Summary ────────────────────────────────────────────────────────

function PermissionSummary({ permissions: raw }: { permissions: unknown }) {
    const permissions = parsePermissions(raw);
    const active = permissions.filter(p => p.actions.includes("read"));

    if (active.length === 0) {
        return (
            <span className="flex items-center gap-1 text-xs text-dashboard-base-content/50 italic">
                <ShieldOff className="h-3 w-3" /> No access configured
            </span>
        );
    }

    const shown = active.slice(0, 3);
    const rest  = active.length - 3;

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {shown.map(p => (
                <span
                    key={p.resource}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full
                               bg-dashboard-primary/10 text-dashboard-primary border border-dashboard-primary/20 capitalize"
                >
                    {p.resource.replace("_", " ")}
                </span>
            ))}
            {rest > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full
                                 bg-dashboard-base-200 text-dashboard-base-content/50 border border-dashboard-base-300">
                    +{rest} more
                </span>
            )}
        </div>
    );
}

// ── CRUD Dots ─────────────────────────────────────────────────────────────────

function ActionDots({ permissions: raw }: { permissions: unknown }) {
    const permissions = parsePermissions(raw);
    const allActions  = new Set(permissions.flatMap(p => p.actions));

    const DOT_CONFIG = [
        { key: "read",   label: "R", active: "bg-dashboard-secondary text-dashboard-secondary-content" },
        { key: "create", label: "C", active: "bg-dashboard-accent    text-dashboard-accent-content"    },
        { key: "update", label: "U", active: "bg-dashboard-warning   text-dashboard-warning-content"   },
        { key: "delete", label: "D", active: "bg-dashboard-error     text-dashboard-error-content"     },
    ] as const;

    return (
        <div className="flex items-center gap-1">
            {DOT_CONFIG.map(({ key, label, active }) => (
                <span
                    key={key}
                    title={key}
                    className={[
                        "h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center",
                        allActions.has(key)
                            ? active
                            : "bg-dashboard-base-200 text-dashboard-base-content/60",
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
    const [search,       setSearch]       = useState("");
    const [filterAccess, setFilterAccess] = useState("all");
    const [page,         setPage]         = useState(1);

    const filtered = roles.filter(r => {
        const matchSearch =
            !search
            || r.name.toLowerCase().includes(search.toLowerCase())
            || (r.description ?? "").toLowerCase().includes(search.toLowerCase());

        const matchAccess =
            filterAccess === "all"
            || (filterAccess === "configured" && parsePermissions(r.permissions).length > 0)
            || (filterAccess === "empty"      && parsePermissions(r.permissions).length === 0);

        return matchSearch && matchAccess;
    });

    const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage    = Math.min(page, totalPages);
    const paginated   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterAccess !== "all";

    const totalMembers    = roles.reduce((acc, r) => acc + r._count.members, 0);
    const configuredRoles = roles.filter(r => parsePermissions(r.permissions).length > 0).length;

    const columns: ColumnDef<Role>[] = [
        {
            header: "Role",
            width: "w-[240px]",
            cell: (role) => (
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-dashboard-primary/10 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-4 w-4 text-dashboard-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm text-dashboard-base-content">{role.name}</p>
                        <p className="text-xs text-dashboard-base-content/60 truncate max-w-[170px]">
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
            align: "center",
            cell: (role) => (
                <span className="flex items-center justify-center gap-1.5 text-sm text-dashboard-base-content/75">
                    <Users className="h-3.5 w-3.5" /> {role._count.members}
                </span>
            ),
        },
        {
            header: "Last Updated",
            cell: (role) => (
                <span className="text-xs text-dashboard-base-content/75">
                    {formatDistanceToNow(new Date(role.updatedAt), { addSuffix: true })}
                </span>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[130px]",
            cell: (role) => (
                <div className="flex items-center justify-end gap-1">
                    <Link href={`/dashboard/roles-and-permissions/${role.id}/permissions`}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-200"
                            title="Configure permissions"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                    </Link>

                    <EditRoleDialog role={role}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-200"
                            title="Edit role"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    </EditRoleDialog>

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
            <StatGrid cols={3}>
                <StatCard
                    label="Total Roles"
                    value={roles.length}
                    icon={UserRoundKey}
                />
                <StatCard
                    label="Configured"
                    value={configuredRoles}
                    icon={SlidersHorizontal}
                />
                <StatCard
                    label="Total Members"
                    value={totalMembers}
                    icon={Users}
                />
            </StatGrid>

            <TableFilters
                search={search}
                onSearchChange={(v) => { setSearch(v); setPage(1); }}
                searchPlaceholder="Search roles..."
                filteredCount={isFiltering ? filtered.length : undefined}
                totalCount={isFiltering ? roles.length : undefined}
                filters={[
                    {
                        value: filterAccess,
                        onChange: (v) => { setFilterAccess(v); setPage(1); },
                        placeholder: "All Roles",
                        width: "w-40",
                        options: [
                            { label: "Configured",   value: "configured" },
                            { label: "Unconfigured", value: "empty"      },
                        ],
                    },
                ]}
            />

            <DataTable
                data={paginated}
                columns={columns}
                rowKey={(r) => r.id}
                emptyState={
                    <div className="flex flex-col items-center gap-2">
                        <ShieldCheck className="h-10 w-10 text-dashboard-base-content/30" />
                        <p className="text-sm font-medium text-dashboard-base-content/60">No roles found</p>
                        <p className="text-xs text-dashboard-base-content/40">
                            Try adjusting your filters or create a new role
                        </p>
                    </div>
                }
                pagination={{ currentPage: safePage, totalPages, onPageChange: setPage }}
            />
        </div>
    );
}