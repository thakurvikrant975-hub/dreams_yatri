"use client";

import { useState, useTransition, useEffect } from "react";
import { UserCheck, UserX, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/app/components/ui/popover";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import { cn } from "@/app/lib/utils";
import { assignQuery, getSalesMembers } from "./actions";
import type { SalesMember } from "./actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function memberInitials(name: string) {
    return name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? "")
        .join("");
}

function loadBadge(count: number) {
    if (count === 0)  return { label: "Free",         className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400" };
    if (count <= 5)   return { label: `${count} active`, className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400" };
    if (count <= 10)  return { label: `${count} active`, className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400" };
    return             { label: `${count} active`, className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400" };
}

function avatarColor(name: string) {
    const colors = [
        "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
        "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
        "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400",
        "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
        "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400",
    ];
    return colors[name.charCodeAt(0) % colors.length];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
    queryId:    string;
    assignedTo: string | null;
    assignedAt?: Date | null;
    onDone?:    () => void;
    compact?:   boolean; // icon-only trigger for table rows
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AssignQueryDropdown({ queryId, assignedTo, assignedAt, onDone, compact = false }: Props) {
    const [open, setOpen]         = useState(false);
    const [search, setSearch]     = useState("");
    const [members, setMembers]   = useState<SalesMember[]>([]);
    const [loading, setLoading]   = useState(false);
    const [isPending, startAssign] = useTransition();

    // Lazy-fetch when popover opens
    useEffect(() => {
        if (!open) { setSearch(""); return; }
        setLoading(true);
        getSalesMembers()
            .then(setMembers)
            .finally(() => setLoading(false));
    }, [open]);

    const currentMember = members.find((m) => m.id === assignedTo);

    const filtered = members.filter((m) => {
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });

    function handleAssign(memberId: string | null) {
        startAssign(async () => {
            const r = await assignQuery(queryId, memberId);
            if (r.success) { toast.success(r.message); setOpen(false); onDone?.(); }
            else toast.error(r.message);
        });
    }

    // ── Trigger ───────────────────────────────────────────────────────────────

    const trigger = compact ? (
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "h-8 w-8",
                assignedTo
                    ? "text-primary hover:text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:text-foreground",
            )}
        >
            <UserCheck className="h-3.5 w-3.5" />
        </Button>
    ) : (
        <Button
            variant="outline"
            size="sm"
            className={cn(
                "gap-2 justify-between min-w-[160px] max-w-[220px]",
                assignedTo && "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/60",
            )}
        >
            <span className="flex items-center gap-2 min-w-0">
                {assignedTo && currentMember ? (
                    <>
                        <span className={cn("h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0", avatarColor(currentMember.name))}>
                            {memberInitials(currentMember.name)}
                        </span>
                        <span className="truncate text-xs font-medium">{currentMember.name}</span>
                    </>
                ) : (
                    <>
                        <UserCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">Assign to Sales</span>
                    </>
                )}
            </span>
            <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>

            <PopoverContent className="w-80 p-0 shadow-lg" align="start" sideOffset={6}>

                {/* Header */}
                <div className="px-3 py-2.5 border-b">
                    <p className="text-xs font-semibold text-foreground">Assign to Sales Team</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Active queries shown per member</p>
                </div>

                {/* Search */}
                <div className="px-3 py-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Member List */}
                <div className="max-h-64 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Loading team...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-xs text-muted-foreground">
                                {search ? "No members match your search" : "No active sales members found"}
                            </p>
                        </div>
                    ) : (
                        <div className="py-1">
                            {filtered.map((member) => {
                                const isSelected = member.id === assignedTo;
                                const load       = loadBadge(member.activeQueries);

                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        disabled={isPending}
                                        onClick={() => handleAssign(isSelected ? null : member.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                                            "hover:bg-muted/60 disabled:opacity-50",
                                            isSelected && "bg-primary/5",
                                        )}
                                    >
                                        {/* Avatar */}
                                        <div className={cn("h-8 w-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0", avatarColor(member.name))}>
                                            {memberInitials(member.name)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={cn("text-sm font-medium leading-tight truncate", isSelected && "text-primary")}>
                                                    {member.name}
                                                </p>
                                                {isSelected && (
                                                    <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded px-1 py-0.5 shrink-0">
                                                        Assigned
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{member.email}</p>
                                        </div>

                                        {/* Load Badge */}
                                        <Badge variant="outline" className={cn("text-[10px] shrink-0 font-medium border", load.className)}>
                                            {load.label}
                                        </Badge>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Unassign footer */}
                {assignedTo && (
                    <>
                        <Separator />
                        <div className="p-2">
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleAssign(null)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            >
                                <UserX className="h-3.5 w-3.5" />
                                Remove assignment
                            </button>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}