"use client";

import { useState, useTransition, useEffect } from "react";
import { UserCheck, UserX, ChevronsUpDown, Loader2, Search, TrendingUp, Briefcase, BarChart2, Handshake } from "lucide-react";
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

/**
 * FIX: Color badge based on active pipeline load only.
 * Previously counted SUBMITTED/IN_PROGRESS — now counts the correct active statuses
 * (ASSIGNED, IN_PROGRESS, PACKAGE_SENT, etc.) as returned by the updated action.
 */

// ── MemberAvatar ──────────────────────────────────────────────────────────────

function MemberAvatar({
    name,
    profilePicUrl,
    className,
    textClassName,
}: {
    name: string;
    profilePicUrl?: string | null;
    className?: string;
    textClassName?: string;
}) {
    if (profilePicUrl) {
        return (
            <img
                src={profilePicUrl}
                alt={name}
                className={cn("rounded-full object-cover", className)}
            />
        );
    }
    return (
        <div className={cn("rounded-full font-bold flex items-center justify-center", avatarColor(name), className)}>
            <span className={textClassName}>{memberInitials(name)}</span>
        </div>
    );
}

function loadBadge(count: number) {
    if (count === 0) return { label: "Free", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400" };
    if (count <= 5) return { label: `${count} active`, className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400" };
    if (count <= 10) return { label: `${count} active`, className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400" };
    return { label: `${count} active`, className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400" };
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

/** Derived conversion rate rounded to 1 decimal, or "—" if no history. */
function convRate(member: SalesMember): string {
    if (!member.totalQueries) return "—";
    return `${((member.convertedQueries / member.totalQueries) * 100).toFixed(1)}%`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
    queryId: string;
    assignedTo: string | null;
    assignedAt?: Date | null;
    /** Denormalized name from the query row itself — lets the trigger show
     * who a query is assigned to right away, without waiting on `members`
     * (which only loads once the popover is opened). */
    assignedToName?: string | null;
    onDone?: () => void;
    compact?: boolean;
    /** Override the roster — a Team Leader's reassign picker passes
     * getMyTeamMembers so only their own team shows up, not the whole sales
     * floor. Defaults to the unscoped getSalesMembers. */
    fetchMembers?: () => Promise<SalesMember[]>;
    /** Override the mutation to match — a Team Leader's picker passes
     * reassignToTeamMember, which re-checks server-side that the target is
     * actually on their team rather than trusting this component's list.
     * Defaults to the plain assignQuery. */
    assignFn?: (queryId: string, memberId: string | null) => Promise<{ success: boolean; message: string }>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AssignQueryDropdown({
    queryId, assignedTo, assignedAt, assignedToName, onDone, compact = false,
    fetchMembers = getSalesMembers, assignFn = assignQuery,
}: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [members, setMembers] = useState<SalesMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPending, startAssign] = useTransition();

    // Lazy-fetch when popover opens
    useEffect(() => {
        if (!open) { setSearch(""); return; }
        setLoading(true);
        fetchMembers()
            .then(setMembers)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const currentMember = members.find((m) => m.id === assignedTo);

    const filtered = members.filter((m) => {
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });

    function handleAssign(memberId: string | null) {
        startAssign(async () => {
            const r = await assignFn(queryId, memberId);
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
        <button
            type="button"
            className="group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 min-w-40 max-w-55 cursor-pointer transition-colors hover:bg-muted/60"
        >
            {assignedTo && (currentMember || assignedToName) ? (
                <>
                    <MemberAvatar
                        name={currentMember?.name ?? assignedToName!}
                        profilePicUrl={currentMember?.profilePicUrl}
                        className="h-8 w-8 shrink-0"
                        textClassName="text-[11px]"
                    />
                    <span className="truncate text-sm font-medium text-foreground">
                        {currentMember?.name ?? assignedToName}
                    </span>
                </>
            ) : (
                <>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/60">
                        <UserCheck className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                </>
            )}
            <ChevronsUpDown className="h-3 w-3 ml-auto shrink-0 opacity-0 text-muted-foreground transition-opacity group-hover:opacity-60" />
        </button>
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>

            <PopoverContent className="w-[340px] p-0 shadow-lg rounded-lg" align="start" sideOffset={6}>

                {/* Header */}
                <div className="px-3 py-2.5 border-b">
                    <p className="text-xs font-semibold text-foreground">Assign to Sales Team</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Active pipeline · total leads · conversion rate shown per member.
                        Agencies are marked.
                    </p>
                </div>

                {/* Search */}
                <div className="px-3 py-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search by name or email…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Member List */}
                <div className="max-h-[320px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Loading team…</span>
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
                                const load = loadBadge(member.activeQueries);
                                const rate = convRate(member);

                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        disabled={isPending}
                                        onClick={() => handleAssign(isSelected ? null : member.id)}
                                        className={cn(
                                            "w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors",
                                            "hover:bg-muted/60 disabled:opacity-50",
                                            isSelected && "bg-primary/5",
                                        )}
                                    >
                                        {/* Avatar */}
                                        <MemberAvatar
                                            name={member.name}
                                            profilePicUrl={member.profilePicUrl}
                                            className="h-9 w-9 shrink-0 mt-0.5"
                                            textClassName="text-xs"
                                        />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">

                                            {/* Name row */}
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className={cn(
                                                    "text-sm font-medium leading-tight truncate",
                                                    isSelected && "text-primary",
                                                )}>
                                                    {member.name}
                                                </p>
                                                {member.isPartnerAgency && (
                                                    <span
                                                        title="An outside agency — this lead leaves the building"
                                                        className="flex items-center gap-1 text-[10px] font-semibold text-dashboard-secondary bg-dashboard-secondary/10 rounded px-1.5 py-0.5 shrink-0"
                                                    >
                                                        <Handshake className="h-2.5 w-2.5" /> Agency
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded px-1 py-0.5 shrink-0">
                                                        Assigned
                                                    </span>
                                                )}
                                                {/* Active load badge — top-right */}
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "ml-auto text-[10px] shrink-0 font-medium border",
                                                        load.className,
                                                    )}
                                                >
                                                    {load.label}
                                                </Badge>
                                            </div>

                                            {/* Email */}
                                            <p className="text-[11px] text-muted-foreground truncate mb-1.5">
                                                {member.email}
                                            </p>

                                            {/* ── FIX: Richer stats row ── */}
                                            <div className="flex items-center gap-3">
                                                {/* Total leads */}
                                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <Briefcase className="h-2.5 w-2.5 shrink-0" />
                                                    <span className="font-medium text-foreground">{member.totalQueries}</span>
                                                    <span>total</span>
                                                </span>

                                                {/* Active */}
                                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <BarChart2 className="h-2.5 w-2.5 shrink-0" />
                                                    <span className="font-medium text-foreground">{member.activeQueries}</span>
                                                    <span>active</span>
                                                </span>

                                                {/* Conversion rate */}
                                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                                                    <span className={cn(
                                                        "font-medium",
                                                        rate !== "—" && parseFloat(rate) >= 20
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-foreground",
                                                    )}>
                                                        {rate}
                                                    </span>
                                                    <span>conv.</span>
                                                </span>
                                            </div>
                                        </div>
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