"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    Loader2, Send, MapPin, User, Mail, Phone, Inbox,
    Clock3, CheckCircle2, XCircle, ArrowRight,
    Search, Check, ChevronsUpDown,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/app/lib/utils";
import { PhoneInput } from "../(marketing)/queries/PhoneInput";
import { createLeadRequest, type LeadRequestFormState } from "../lead-requests/actions";
import type { DestinationOption } from "../(marketing)/queries/actions";

type MyRequest = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    destination: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    rejectionReason: string | null;
    createdAt: Date;
};

type StatusFilter = "ALL" | MyRequest["status"];

/**
 * One place per status for its icon, wording and colour, so the filter chip,
 * the row badge and the outcome line can never drift apart — an exec reading
 * "Accepted" in one place and amber in another would not trust either.
 */
const STATUS = {
    PENDING: {
        label: "Pending", icon: Clock3,
        chip: "bg-dashboard-warning/10 text-dashboard-warning border-dashboard-warning/25",
        dot: "bg-dashboard-warning",
        outcome: "Waiting for the lead manager",
    },
    ACCEPTED: {
        label: "Accepted", icon: CheckCircle2,
        chip: "bg-dashboard-success/10 text-dashboard-success border-dashboard-success/25",
        dot: "bg-dashboard-success",
        outcome: "Added to your queue in Sales Queries",
    },
    REJECTED: {
        label: "Rejected", icon: XCircle,
        chip: "bg-dashboard-error/10 text-dashboard-error border-dashboard-error/25",
        dot: "bg-dashboard-error",
        outcome: "Not added",
    },
} as const;

const initial: LeadRequestFormState = { success: false, message: "" };

function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Field-level error, in the one place a field's messages appear. */
function FieldError({ messages }: { messages?: string[] }) {
    if (!messages?.length) return null;
    return <p className="text-xs text-dashboard-error">{messages[0]}</p>;
}

/**
 * Type-to-filter picker over our own destinations.
 *
 * Deliberately the active destinations catalogue rather than the dashboard's
 * LocationSearchSelect, which searches the whole locations table: a requested
 * lead's destination has to be one the package builder and the reports can
 * actually match, and there are 66 of ours against ~96k of those. Search
 * rather than a plain <Select> because 66 is well past the point of scrolling
 * a list to find "Ladakh".
 *
 * Mirrors the assign-to-sales picker's shape (popover, search box, list) so
 * it behaves like the pickers an exec already uses elsewhere.
 */
function DestinationPicker({
    value, onChange, destinations, invalid,
}: {
    value: string;
    onChange: (name: string) => void;
    destinations: DestinationOption[];
    invalid?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return destinations;
        return destinations.filter((d) => d.name.toLowerCase().includes(q));
    }, [destinations, search]);

    return (
        <Popover
            open={open}
            onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={cn(
                        "flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-xs transition-colors outline-none",
                        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 cursor-pointer",
                        invalid ? "border-destructive" : "border-input",
                    )}
                >
                    <span className={cn("truncate", !value && "text-muted-foreground")}>
                        {value || "Search a destination"}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-lg shadow-lg" align="start" sideOffset={6}>
                <div className="border-b border-dashboard-base-300 p-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Type to filter…"
                            className="h-8 pl-8 text-sm"
                        />
                    </div>
                </div>

                <div className="max-h-[260px] overflow-y-auto py-1" role="listbox">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-6 text-center text-xs text-dashboard-base-content/50">
                            No destination matches “{search}”
                        </p>
                    ) : filtered.map((d) => {
                        const selected = d.name === value;
                        return (
                            <button
                                key={d.id}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => { onChange(d.name); setOpen(false); setSearch(""); }}
                                className={cn(
                                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                                    "hover:bg-dashboard-base-200/60",
                                    selected && "text-dashboard-primary",
                                )}
                            >
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40" />
                                <span className="flex-1 truncate">{d.name}</span>
                                {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function RequestLeadForm({
    requests, destinations,
}: {
    requests: MyRequest[];
    destinations: DestinationOption[];
}) {
    const router = useRouter();
    const [state, action, isPending] = useActionState(createLeadRequest, initial);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [destination, setDestination] = useState("");
    const [filter, setFilter] = useState<StatusFilter>("ALL");
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (!state.message) return;
        if (state.success) {
            toast.success(state.message);
            formRef.current?.reset();
            setName(""); setEmail(""); setDestination("");
            router.refresh();
        } else {
            toast.error(state.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    const counts = useMemo(() => ({
        ALL: requests.length,
        PENDING: requests.filter((r) => r.status === "PENDING").length,
        ACCEPTED: requests.filter((r) => r.status === "ACCEPTED").length,
        REJECTED: requests.filter((r) => r.status === "REJECTED").length,
    }), [requests]);

    const visible = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(340px,400px)_1fr] items-start">

            {/* ── Send a request ────────────────────────────────────────── */}
            <form
                ref={formRef}
                action={action}
                className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden"
            >
                <div className="px-5 pt-5 pb-4 border-b border-dashboard-base-300">
                    <h2 className="text-sm font-semibold text-dashboard-base-content">New request</h2>
                    {/* The whole flow in one line — an exec should not have to
                        ask anyone what happens after they press Send. */}
                    {/* Each step keeps its own leading arrow on one line, so a
                        wrap never strands an arrow at the end of a line. */}
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-dashboard-base-content/50">
                        <span>You send</span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <ArrowRight className="h-3 w-3 shrink-0" />the manager reviews
                        </span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <ArrowRight className="h-3 w-3 shrink-0" />it lands in your queue
                        </span>
                    </p>
                </div>

                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="flex items-center gap-1.5 text-xs font-medium text-dashboard-base-content/70">
                            <User className="h-3.5 w-3.5" /> Client name
                        </Label>
                        <Input
                            id="name" name="name" value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name" required autoComplete="off"
                        />
                        <FieldError messages={state.errors?.name} />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs font-medium text-dashboard-base-content/70">
                            <Phone className="h-3.5 w-3.5" /> Phone number
                        </Label>
                        <PhoneInput name="phone" defaultValue="" />
                        <FieldError messages={state.errors?.phone} />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs font-medium text-dashboard-base-content/70">
                            <MapPin className="h-3.5 w-3.5" /> Destination
                        </Label>
                        <input type="hidden" name="destination" value={destination} />
                        <DestinationPicker
                            value={destination}
                            onChange={setDestination}
                            destinations={destinations}
                            invalid={!!state.errors?.destination}
                        />
                        <FieldError messages={state.errors?.destination} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-medium text-dashboard-base-content/70">
                            <Mail className="h-3.5 w-3.5" /> Email
                            <span className="font-normal text-dashboard-base-content/40">optional</span>
                        </Label>
                        <Input
                            id="email" name="email" type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="client@example.com" autoComplete="off"
                        />
                        <FieldError messages={state.errors?.email} />
                    </div>
                </div>

                <div className="px-5 pb-5">
                    <Button type="submit" disabled={isPending} className="w-full gap-1.5">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {isPending ? "Sending…" : "Send request"}
                    </Button>
                </div>
            </form>

            {/* ── What you have sent ────────────────────────────────────── */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-dashboard-base-300 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-sm font-semibold text-dashboard-base-content">Your requests</h2>
                        <p className="mt-1 text-[11px] text-dashboard-base-content/50">
                            {counts.PENDING > 0
                                ? `${counts.PENDING} waiting on the lead manager`
                                : "Nothing waiting on the lead manager"}
                        </p>
                    </div>

                    {/* Counts double as the filter — the number an exec wants is
                        also the way to see just those. */}
                    {requests.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            {(["ALL", "PENDING", "ACCEPTED", "REJECTED"] as const).map((key) => {
                                const active = filter === key;
                                const n = counts[key];
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setFilter(key)}
                                        aria-pressed={active}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                                            active
                                                ? "border-dashboard-primary/30 bg-dashboard-primary/10 text-dashboard-primary"
                                                : "border-dashboard-base-300 text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-200/60",
                                        )}
                                    >
                                        {key !== "ALL" && <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[key].dot)} />}
                                        {key === "ALL" ? "All" : STATUS[key].label}
                                        <span className="tabular-nums opacity-70">{n}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {requests.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-dashboard-base-200">
                            <Inbox className="h-5 w-5 text-dashboard-base-content/40" />
                        </div>
                        <p className="text-sm font-medium text-dashboard-base-content">No requests yet</p>
                        <p className="mx-auto mt-1 max-w-xs text-xs text-dashboard-base-content/50">
                            Send your first client across using the form. You will see the lead
                            manager&apos;s decision here.
                        </p>
                    </div>
                ) : visible.length === 0 ? (
                    <p className="px-5 py-16 text-center text-sm text-dashboard-base-content/50">
                        No {STATUS[filter as MyRequest["status"]].label.toLowerCase()} requests.
                    </p>
                ) : (
                    <ul className="divide-y divide-dashboard-base-300">
                        {visible.map((r) => {
                            const s = STATUS[r.status];
                            const Icon = s.icon;
                            return (
                                <li key={r.id} className="flex items-start gap-3 px-5 py-4">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-[11px] font-semibold text-dashboard-primary">
                                        {initials(r.name)}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-dashboard-base-content">{r.name}</p>
                                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dashboard-base-content/55">
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />{r.destination}
                                                    </span>
                                                    <span className="text-dashboard-base-content/25">·</span>
                                                    <span className="tabular-nums">{r.phone}</span>
                                                </p>
                                            </div>

                                            <span className={cn(
                                                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                                s.chip,
                                            )}>
                                                <Icon className="h-3 w-3" />
                                                {s.label}
                                            </span>
                                        </div>

                                        {/* What actually happened to it, in words —
                                            a status alone left execs asking where
                                            an accepted lead had gone. */}
                                        <p className="mt-1.5 text-[11px] text-dashboard-base-content/45">
                                            {s.outcome}
                                            <span className="text-dashboard-base-content/25"> · </span>
                                            sent {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                                        </p>

                                        {r.status === "REJECTED" && r.rejectionReason && (
                                            <p className="mt-2 rounded-md border-l-2 border-dashboard-error/40 bg-dashboard-error/5 px-2.5 py-1.5 text-xs text-dashboard-base-content/70">
                                                {r.rejectionReason}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
