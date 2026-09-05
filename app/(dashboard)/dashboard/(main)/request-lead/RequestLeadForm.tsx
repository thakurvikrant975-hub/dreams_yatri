"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    Loader2, Send, MapPin, User, Mail, Phone, Inbox,
    Clock3, CheckCircle2, XCircle, ArrowRight, Plus,
    Search, Check, ChevronsUpDown, StickyNote, PhoneCall, MessageSquare,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/app/components/ui/popover";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { cn, capitalizeWords } from "@/app/lib/utils";
import { PhoneInput } from "../(marketing)/queries/PhoneInput";
import { createLeadRequest, type LeadRequestFormState } from "../lead-requests/actions";
import type { DestinationOption } from "../(marketing)/queries/actions";

type MyRequest = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    destination: string;
    notes: string | null;
    message: string | null;
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

/** The Input component's own shape (components/ui/input.tsx), reused by the
 * destination trigger so a button and an input sitting in the same column
 * cannot end up different heights, radii or border colours. */
const CONTROL_CLASS =
    "h-10 w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors " +
    "bg-dashboard-base-100 border border-dashboard-base-content/85 text-dashboard-base-content " +
    "focus-visible:border-dashboard-primary focus-visible:ring-1 focus-visible:ring-dashboard-primary/30";

function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * One row of the form: label, control, error. Every field goes through it, so
 * label size, icon size, spacing and error placement are decided once instead
 * of being repeated four times and drifting.
 */
function Field({
    label, icon: Icon, htmlFor, optional, error, children,
}: {
    label: string;
    icon: React.ElementType;
    htmlFor?: string;
    optional?: boolean;
    error?: string[];
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label
                htmlFor={htmlFor}
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/60"
            >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {optional && <span className="normal-case tracking-normal text-dashboard-base-content/35">optional</span>}
            </Label>
            {children}
            {error?.length ? <p className="text-xs text-dashboard-error">{error[0]}</p> : null}
        </div>
    );
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
                        CONTROL_CLASS,
                        "flex items-center justify-between gap-1.5 cursor-pointer text-left",
                        invalid && "border-dashboard-error ring-1 ring-dashboard-error/20",
                    )}
                >
                    <span className={cn("truncate", !value && "text-dashboard-base-content/35")}>
                        {value || "Search a destination"}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-dashboard-base-content/40" />
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-lg shadow-lg" align="start" sideOffset={6}>
                <div className="border-b border-dashboard-base-300 p-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dashboard-base-content/40" />
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

/**
 * The "New request" dialog — a popup rather than an always-visible form, so
 * the table of past requests gets the page and sending a new one is a
 * deliberate action, matching how Add Query works on the queries page.
 */
function NewRequestDialog({
    open, onOpenChange, destinations,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    destinations: DestinationOption[];
}) {
    const router = useRouter();
    const [state, action, isPending] = useActionState(createLeadRequest, initial);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [notes, setNotes] = useState("");
    const [message, setMessage] = useState("");
    const [destination, setDestination] = useState("");
    const [source, setSource] = useState<"" | "PHONE_CALL" | "OTHER">("");
    const [sourceOther, setSourceOther] = useState("");
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (!state.message) return;
        if (state.success) {
            toast.success(state.message);
            formRef.current?.reset();
            setName(""); setEmail(""); setDestination(""); setNotes(""); setMessage(""); setSource(""); setSourceOther("");
            router.refresh();
            onOpenChange(false);
        } else {
            toast.error(state.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                <form ref={formRef} action={action}>
                    <DialogHeader className="px-5 pt-5 pb-4 border-b border-dashboard-base-300">
                        <DialogTitle>New request</DialogTitle>
                        <DialogDescription asChild>
                            {/* Each step keeps its own leading arrow on one line, so a
                                wrap never strands an arrow at the end of a line. */}
                            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span>You send</span>
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    <ArrowRight className="h-3 w-3 shrink-0" />the manager reviews
                                </span>
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    <ArrowRight className="h-3 w-3 shrink-0" />it lands in your queue
                                </span>
                            </p>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                        <Field label="Client name" icon={User} htmlFor="name" error={state.errors?.name}>
                            <Input
                                id="name" name="name" value={name}
                                onChange={(e) => setName(capitalizeWords(e.target.value))}
                                placeholder="Full name" required autoComplete="off"
                                aria-invalid={!!state.errors?.name}
                            />
                        </Field>

                        <Field label="Phone number" icon={Phone} error={state.errors?.phone}>
                            <PhoneInput name="phone" defaultValue="" />
                        </Field>

                        <Field label="Destination" icon={MapPin} error={state.errors?.destination}>
                            <input type="hidden" name="destination" value={destination} />
                            <DestinationPicker
                                value={destination}
                                onChange={setDestination}
                                destinations={destinations}
                                invalid={!!state.errors?.destination}
                            />
                        </Field>

                        <Field label="Email" icon={Mail} htmlFor="email" optional error={state.errors?.email}>
                            <Input
                                id="email" name="email" type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="client@example.com" autoComplete="off"
                                aria-invalid={!!state.errors?.email}
                            />
                        </Field>

                        <Field label="Source" icon={PhoneCall} error={state.errors?.source}>
                            <input type="hidden" name="source" value={source} />
                            <Select value={source} onValueChange={(v) => setSource(v as "PHONE_CALL" | "OTHER")}>
                                <SelectTrigger
                                    className={cn(
                                        CONTROL_CLASS,
                                        "h-10",
                                        !!state.errors?.source && "border-dashboard-error ring-1 ring-dashboard-error/20",
                                    )}
                                >
                                    <SelectValue placeholder="How did this lead come in?" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PHONE_CALL">Call</SelectItem>
                                    <SelectItem value="OTHER">Others</SelectItem>
                                </SelectContent>
                            </Select>
                            {source === "OTHER" && (
                                <Input
                                    name="sourceOther" value={sourceOther}
                                    onChange={(e) => setSourceOther(e.target.value)}
                                    placeholder="Specify the source" required autoComplete="off"
                                    aria-invalid={!!state.errors?.sourceOther}
                                    className="mt-1.5"
                                />
                            )}
                        </Field>

                        {/* Two distinct, optional fields sharing one control: "Notes"
                            is context for the lead manager, "Message" is the
                            client's own words (VOC) — kept as tabs rather than two
                            stacked textareas so the dialog doesn't grow taller, and
                            because they're rarely both filled in at once. Both stay
                            mounted (forceMount) so switching tabs never drops
                            whatever was typed in the other one. */}
                        <div className="space-y-1.5">
                            <Tabs defaultValue="notes">
                                <TabsList variant="line" className="w-full">
                                    <TabsTrigger value="notes" className="gap-1.5">
                                        <StickyNote className="h-3.5 w-3.5" /> Notes
                                        {notes.trim() && <span className="h-1 w-1 rounded-full bg-dashboard-primary" />}
                                    </TabsTrigger>
                                    <TabsTrigger value="message" className="gap-1.5">
                                        <MessageSquare className="h-3.5 w-3.5" /> Message
                                        {message.trim() && <span className="h-1 w-1 rounded-full bg-dashboard-primary" />}
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="notes" forceMount className="mt-2 space-y-1 data-[state=inactive]:hidden">
                                    <Textarea
                                        id="notes" name="notes" value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Anything the lead manager should know before deciding…"
                                        rows={3}
                                        className="resize-none text-sm"
                                        aria-invalid={!!state.errors?.notes}
                                    />
                                    <p className="text-[11px] text-dashboard-base-content/40">Optional — context for the lead manager, not shown to the client.</p>
                                </TabsContent>
                                <TabsContent value="message" forceMount className="mt-2 space-y-1 data-[state=inactive]:hidden">
                                    <Textarea
                                        id="message" name="message" value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="What did the client actually say? e.g. “Looking for a 5N Bali honeymoon in December, budget around 1.5L”"
                                        rows={3}
                                        className="resize-none text-sm"
                                        aria-invalid={!!state.errors?.message}
                                    />
                                    <p className="text-[11px] text-dashboard-base-content/40">Optional — in the client&apos;s own words. Shown on the query once approved.</p>
                                </TabsContent>
                            </Tabs>
                            {state.errors?.notes?.length ? <p className="text-xs text-dashboard-error">{state.errors.notes[0]}</p> : null}
                            {state.errors?.message?.length ? <p className="text-xs text-dashboard-error">{state.errors.message[0]}</p> : null}
                        </div>
                    </div>

                    <div className="border-t border-dashboard-base-300 bg-dashboard-base-200/30 px-5 py-4">
                        <Button type="submit" disabled={isPending} className="w-full gap-1.5">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {isPending ? "Sending…" : "Send request"}
                        </Button>
                        <p className="mt-2 text-center text-[11px] text-dashboard-base-content/45">
                            You will be notified when the lead manager decides.
                        </p>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function RequestLeadForm({
    requests, destinations,
}: {
    requests: MyRequest[];
    destinations: DestinationOption[];
}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [filter, setFilter] = useState<StatusFilter>("ALL");

    const counts = useMemo(() => ({
        ALL: requests.length,
        PENDING: requests.filter((r) => r.status === "PENDING").length,
        ACCEPTED: requests.filter((r) => r.status === "ACCEPTED").length,
        REJECTED: requests.filter((r) => r.status === "REJECTED").length,
    }), [requests]);

    const visible = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);

    const columns: ColumnDef<MyRequest>[] = useMemo(() => [
        {
            header: "Client",
            width: "w-[22%]",
            cell: (r) => (
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-[11px] font-semibold text-dashboard-primary">
                        {initials(r.name)}
                    </span>
                    <span className="min-w-0 truncate font-medium">{r.name}</span>
                </div>
            ),
            sortKey: (r) => r.name,
        },
        {
            header: "Contact",
            cell: (r) => (
                <div className="space-y-0.5 text-xs text-dashboard-base-content/70">
                    <p className="flex items-center gap-1 tabular-nums"><Phone className="h-3 w-3" />{r.phone}</p>
                    {r.email && <p className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{r.email}</p>}
                </div>
            ),
        },
        {
            header: "Destination",
            cell: (r) => (
                <span className="inline-flex items-center gap-1 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-dashboard-base-content/40" />{r.destination}
                </span>
            ),
            sortKey: (r) => r.destination,
        },
        {
            header: "Notes",
            width: "w-[16%]",
            cell: (r) => r.notes ? (
                <p className="line-clamp-2 max-w-xs text-xs text-dashboard-base-content/65" title={r.notes}>
                    {r.notes}
                </p>
            ) : (
                <span className="text-xs text-dashboard-base-content/30">—</span>
            ),
        },
        {
            header: "Message",
            width: "w-[16%]",
            cell: (r) => r.message ? (
                <p className="line-clamp-2 max-w-xs text-xs italic text-dashboard-base-content/65" title={r.message}>
                    &quot;{r.message}&quot;
                </p>
            ) : (
                <span className="text-xs text-dashboard-base-content/30">—</span>
            ),
        },
        {
            header: "Status",
            align: "center",
            cell: (r) => {
                const s = STATUS[r.status];
                const Icon = s.icon;
                return (
                    <span className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        s.chip,
                    )}>
                        <Icon className="h-3 w-3" />
                        {s.label}
                    </span>
                );
            },
            sortKey: (r) => r.status,
        },
        {
            header: "Sent",
            cell: (r) => (
                <span className="text-xs text-dashboard-base-content/55">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                </span>
            ),
            sortKey: (r) => r.createdAt,
        },
        {
            header: "Outcome",
            width: "w-[20%]",
            cell: (r) => (
                <div className="space-y-1">
                    <p className="text-xs text-dashboard-base-content/55">{STATUS[r.status].outcome}</p>
                    {r.status === "REJECTED" && r.rejectionReason && (
                        <p className="rounded-md border-l-2 border-dashboard-error/40 bg-dashboard-error/5 px-2 py-1 text-[11px] text-dashboard-base-content/70">
                            {r.rejectionReason}
                        </p>
                    )}
                </div>
            ),
        },
    ], []);

    return (
        <div className="space-y-5">
            <NewRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} destinations={destinations} />

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-sm font-semibold text-dashboard-base-content">Your requests</h2>
                    <p className="mt-1 text-[11px] text-dashboard-base-content/50">
                        {counts.PENDING > 0
                            ? `${counts.PENDING} waiting on the lead manager`
                            : "Nothing waiting on the lead manager"}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
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

                    <Button type="button" size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4" /> New request
                    </Button>
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-16 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-dashboard-base-200">
                        <Inbox className="h-5 w-5 text-dashboard-base-content/40" />
                    </div>
                    <p className="text-sm font-medium text-dashboard-base-content">No requests yet</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-dashboard-base-content/50">
                        Send your first client across using “New request”. You will see the lead
                        manager&apos;s decision here.
                    </p>
                </div>
            ) : (
                <DataTable
                    data={visible}
                    columns={columns}
                    rowKey={(r) => r.id}
                    emptyState={
                        <p className="text-sm text-dashboard-base-content/50">
                            No {STATUS[filter as MyRequest["status"]]?.label.toLowerCase() ?? ""} requests.
                        </p>
                    }
                />
            )}
        </div>
    );
}
