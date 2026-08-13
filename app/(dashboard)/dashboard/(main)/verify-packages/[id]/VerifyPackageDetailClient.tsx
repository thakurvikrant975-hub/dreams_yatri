"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    CalendarDays, Mail, MapPin, Phone, Users, IndianRupee,
    Building2, Car, Ticket, Gift, PlaneTakeoff, TrainFront, Helicopter, Bus, Package,
    CheckCircle2, XCircle, AlertCircle, Eye, Send, ShieldCheck,
    Pencil, X, Loader2, Clock, Plus, ListChecks, ListX,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    approveCustomPackage, updatePackagePricing, updatePackageInclusionsExclusions,
    getPackagePricingHistory, type PricingEditInput,
} from "../actions";
import { RejectPricingDialog } from "./RejectPricingDialog";
import { HistorySheet } from "../../components/dashboard/HistorySheet";
import type { RejectionReason } from "../../(marketing)/queries/actions";

// Explicit lookup (falling back to TrainFront for anything unrecognized)
// rather than an if/else chain — a ticket type that isn't FLIGHT/HELICOPTER
// used to silently render with the train icon by falling through the old
// ternary's final `else`; this at least makes the fallback a deliberate,
// visible default instead of an accident of chain ordering.
const TICKET_TYPE_ICONS: Record<string, typeof PlaneTakeoff> = {
    FLIGHT: PlaneTakeoff, TRAIN: TrainFront, HELICOPTER: Helicopter, BUS: Bus, OTHER: Package,
};

// ── Locked pricing snapshot — frozen at send time, see package-builder/action.ts ──
// (extended here with addOns, which the original snapshot type omitted)
export type PricingSnapshot = {
    lockedAt: string;
    currency: string;
    hotel: { subtotal: number; nightsCounted: number; lines: { day: number; hotelName: string; roomName: string; pricePerRoom: number; roomsNeeded: number; mattresses: number; extraBedRate: number; total: number; overridden?: boolean; gap?: "no-room-price" | "no-mattress-rate" }[]; overridden?: boolean };
    cab: { subtotal: number; daysCounted: number; lines: { day: number; vehicleName: string; pricingType: string; rate: number; distanceKm: number | null; total: number; overridden?: boolean }[]; overridden?: boolean };
    tickets: { subtotal: number; lines: { type: string; provider: string; fromPlace: string; toPlace: string; fare: number | null; ticketCount: number }[] };
    addOns?: { subtotal: number; lines: { name: string; price: number; quantity: number; day: number | null }[] };
    baseCost: number;
    marginPercentage: number;
    hotelCabMarginAmount: number;
    ticketsMarginAmount: number;
    marginAmount: number;
    taxable: number;
    gstPercentage: number;
    gstAmount: number;
    finalPrice: number;
    pricePerPerson: number;
    displayedTotalPrice: number | null;
    displayedPricePerPerson: number | null;
};

type TicketRow = { id: string; type: string; provider: string | null; fromPlace: string | null; toPlace: string | null; fare: number | null; ticketCount: number };
type AddonRow = { id: string; name: string; price: number; quantity: number; day: number | null };

type PkgInfo = {
    id: string; title: string; destination: string; startingPoint: string | null;
    totalDays: number; totalNights: number; travelDate: Date | null;
    adults: number; children: number; infants: number;
    childrenAges: number[]; infantAges: number[];
    pricePerPerson: number | null; totalPrice: number | null; currency: string;
    marginPercentage: number; gstPercentage: number;
    status: string; builtByName: string | null; sentAt: Date | null;
    readyAt: Date | null; readyByName: string | null;
    viewedAt: Date | null; viewCount: number;
    verified: boolean; verifiedAt: Date | null; verifiedByName: string | null;
    rejectedAt: Date | null; rejectedByName: string | null; rejectionNote: string | null; rejectionReasonLabel: string | null;
    revisionRequestedAt: Date | null; revisionRequestedByName: string | null; revisionNote: string | null;
    flightsIncluded: boolean; flightNotes: string | null; flightFrom: string | null; flightTo: string | null;
    trainIncluded: boolean; trainNotes: string | null; trainFrom: string | null; trainTo: string | null;
};

type QueryInfo = { id: string; name: string; phone: string; countryCode: string; email: string | null; message: string | null; groupSize: number | null; assignedAt: Date | null };

// "2h 15m", "1d 4h", "45m" — always the two most significant units, never
// more (a 3-day-old package doesn't need its minutes counted).
function fmtDuration(fromMs: number, toMs: number): string {
    const totalMin = Math.max(0, Math.round((toMs - fromMs) / 60000));
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
const inr = (n: number | null | undefined) => n != null ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—";

// Mirrors computeFinalPricing in verify-packages/actions.ts — kept in sync
// manually so the edit form can preview totals live, before saving.
const TICKET_MARGIN_PCT = 5;
function computeFinalPricing(input: { hotelSubtotal: number; cabSubtotal: number; addonsSubtotal: number; ticketsSubtotal: number; marginPercentage: number; gstPercentage: number; totalPax: number }) {
    const hotelCabBase = input.hotelSubtotal + input.cabSubtotal;
    const baseCost = hotelCabBase + input.addonsSubtotal + input.ticketsSubtotal;
    const hotelCabMarginAmount = Math.round((hotelCabBase + input.addonsSubtotal) * input.marginPercentage / 100);
    const ticketsMarginAmount = Math.round(input.ticketsSubtotal * TICKET_MARGIN_PCT / 100);
    const marginAmount = hotelCabMarginAmount + ticketsMarginAmount;
    const taxable = baseCost + marginAmount;
    const gstAmount = Math.round(taxable * input.gstPercentage / 100);
    const finalPrice = taxable + gstAmount;
    const pricePerPerson = input.totalPax > 0 ? Math.round(finalPrice / input.totalPax) : finalPrice;
    return { baseCost, hotelCabMarginAmount, ticketsMarginAmount, marginAmount, taxable, gstAmount, finalPrice, pricePerPerson };
}

// Groups same-day line items (e.g. an extra room type booked alongside the
// primary one) into one editable row — a correction is per DAY, not per
// catalog line, so editing has to operate on the day's combined total.
function groupByDay<T extends { day: number; total: number }>(lines: T[]): { day: number; lines: T[]; total: number }[] {
    const groups = new Map<number, T[]>();
    for (const l of lines) groups.set(l.day, [...(groups.get(l.day) ?? []), l]);
    return [...groups.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, dayLines]) => ({ day, lines: dayLines, total: dayLines.reduce((sum, l) => sum + l.total, 0) }));
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden shadow-lg">
            <div className="border-b border-dashboard-base-300 bg-dashboard-base-content px-4 py-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-100">{title}</h3>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-dashboard-base-200">
                <Icon className="size-3.5 text-dashboard-neutral" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-dashboard-neutral">{label}</p>
                <p className="text-sm text-dashboard-base-content">{value}</p>
            </div>
        </div>
    );
}

function BreakdownCard({ icon: Icon, title, meta, subtotal, editing, subtotalInput, children }: {
    icon: React.ElementType; title: string; meta?: string; subtotal: number;
    editing?: boolean; subtotalInput?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden shadow-lg">
            <div className="flex items-center justify-between border-b border-dashboard-base-300 bg-dashboard-base-200/60 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-dashboard-base-content">
                    <Icon className="size-4 text-dashboard-neutral" />
                    <span>{title}</span>
                    {meta && <span className="text-xs font-normal text-dashboard-neutral">· {meta}</span>}
                </span>
                {editing ? subtotalInput : <span className="text-sm font-bold text-dashboard-base-content">{inr(subtotal)}</span>}
            </div>
            <div className="divide-y divide-dashboard-base-300/60">{children}</div>
        </div>
    );
}

// Editable checklist for one section (inclusions or exclusions) — shows
// current items with a remove button while editing, plus an add-row; falls
// back to a plain bulleted list when not editing (or nothing to review yet).
function PolicyListEditor({
    icon: Icon, tone, items, editing, onRemove, draft, onDraftChange, onAdd,
}: {
    icon: React.ElementType; tone: "success" | "error"; items: string[]; editing: boolean;
    onRemove: (item: string) => void; draft: string; onDraftChange: (v: string) => void; onAdd: () => void;
}) {
    const toneCls = tone === "success" ? "text-dashboard-success" : "text-dashboard-error";
    return (
        <div className="flex flex-col gap-1.5">
            {items.length === 0 && !editing && (
                <p className="text-xs text-dashboard-neutral px-4 py-2">Nothing listed.</p>
            )}
            {items.map((item) => (
                <div key={item} className="flex items-center gap-2 px-4 py-1.5 text-sm">
                    <Icon className={`size-3.5 shrink-0 ${toneCls}`} />
                    <span className="flex-1 min-w-0 text-dashboard-base-content">{item}</span>
                    {editing && (
                        <button type="button" onClick={() => onRemove(item)} className="shrink-0 rounded p-0.5 hover:bg-dashboard-base-200" aria-label="Remove">
                            <X className="size-3.5 text-dashboard-neutral" />
                        </button>
                    )}
                </div>
            ))}
            {editing && (
                <div className="flex items-center gap-2 px-4 pt-1">
                    <Input
                        value={draft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        placeholder="Add an item…"
                        className="h-8 text-xs"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={onAdd} className="h-8 gap-1 shrink-0">
                        <Plus className="size-3.5" /> Add
                    </Button>
                </div>
            )}
        </div>
    );
}

export function VerifyPackageDetailClient({
    findingsSlot, variant = "page",
    pkg, snapshot: s, tickets, addOns, query, rejectionReasons, hotelIdByDay, inclusions, exclusions,
}: {
    pkg: PkgInfo;
    snapshot: PricingSnapshot | null;
    tickets: TicketRow[];
    addOns: AddonRow[];
    query: QueryInfo;
    rejectionReasons: RejectionReason[];
    hotelIdByDay: Record<number, number>;
    inclusions: string[];
    exclusions: string[];
    /** Costing's per-element findings, beside the client/status cards. */
    findingsSlot?: React.ReactNode;
    /** "panel" strips the page furniture — back link, title, the three-column
     * grid — for rendering inside the editor's sidebar, where the editor
     * already supplies all of that. Same logic, same numbers, one column. */
    variant?: "page" | "panel";
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [editMode, setEditMode] = useState(false);

    const [margin, setMargin] = useState(pkg.marginPercentage);
    const [gst, setGst] = useState(pkg.gstPercentage);
    // Per-day hotel/cab amounts, keyed by day — seeded from the current
    // (possibly already-overridden) line totals so the inputs always start
    // at what's actually shown. Only days the costing manager actually edits
    // get sent as a correction (see touchedHotelDays/touchedCabDays) —
    // re-saving without touching a line must NOT silently pin every day to
    // its current catalog price.
    const hotelDayTotals = (snap: PricingSnapshot | null) => {
        const totals = new Map<number, number>();
        for (const l of snap?.hotel.lines ?? []) totals.set(l.day, (totals.get(l.day) ?? 0) + l.total);
        return Object.fromEntries(totals);
    };
    const cabDayTotals = (snap: PricingSnapshot | null) => {
        const totals = new Map<number, number>();
        for (const l of snap?.cab.lines ?? []) totals.set(l.day, (totals.get(l.day) ?? 0) + l.total);
        return Object.fromEntries(totals);
    };
    const [hotelDayEdits, setHotelDayEdits] = useState<Record<number, number>>(hotelDayTotals(s));
    const [cabDayEdits, setCabDayEdits] = useState<Record<number, number>>(cabDayTotals(s));
    const [touchedHotelDays, setTouchedHotelDays] = useState<Set<number>>(new Set());
    const [touchedCabDays, setTouchedCabDays] = useState<Set<number>>(new Set());
    const [ticketFares, setTicketFares] = useState<Record<string, number>>(
        Object.fromEntries(tickets.map((t) => [t.id, t.fare ?? 0])),
    );
    const [addonEdits, setAddonEdits] = useState<Record<string, { price: number; quantity: number }>>(
        Object.fromEntries(addOns.map((a) => [a.id, { price: a.price, quantity: a.quantity }])),
    );

    // Inclusions/exclusions review — its own edit mode/save, independent of
    // the pricing correction flow above, so a reviewer can curate the
    // client-facing lists without also having to touch pricing.
    const [policyEditMode, setPolicyEditMode] = useState(false);
    const [inclusionsEdit, setInclusionsEdit] = useState<string[]>(inclusions);
    const [exclusionsEdit, setExclusionsEdit] = useState<string[]>(exclusions);
    const [newInclusion, setNewInclusion] = useState("");
    const [newExclusion, setNewExclusion] = useState("");

    function enterPolicyEditMode() {
        setInclusionsEdit(inclusions);
        setExclusionsEdit(exclusions);
        setNewInclusion("");
        setNewExclusion("");
        setPolicyEditMode(true);
    }

    function addInclusion() {
        const v = newInclusion.trim();
        if (!v || inclusionsEdit.includes(v)) { setNewInclusion(""); return; }
        setInclusionsEdit((prev) => [...prev, v]);
        setNewInclusion("");
    }
    function addExclusion() {
        const v = newExclusion.trim();
        if (!v || exclusionsEdit.includes(v)) { setNewExclusion(""); return; }
        setExclusionsEdit((prev) => [...prev, v]);
        setNewExclusion("");
    }

    function handleSavePolicy() {
        startTransition(async () => {
            const result = await updatePackageInclusionsExclusions(pkg.id, { inclusions: inclusionsEdit, exclusions: exclusionsEdit });
            if (result.success) {
                toast.success(result.message);
                setPolicyEditMode(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    }

    function enterEditMode() {
        setMargin(pkg.marginPercentage);
        setGst(pkg.gstPercentage);
        setHotelDayEdits(hotelDayTotals(s));
        setCabDayEdits(cabDayTotals(s));
        setTouchedHotelDays(new Set());
        setTouchedCabDays(new Set());
        setTicketFares(Object.fromEntries(tickets.map((t) => [t.id, t.fare ?? 0])));
        setAddonEdits(Object.fromEntries(addOns.map((a) => [a.id, { price: a.price, quantity: a.quantity }])));
        setEditMode(true);
    }

    function editHotelDay(day: number, amount: number) {
        setHotelDayEdits((prev) => ({ ...prev, [day]: amount }));
        setTouchedHotelDays((prev) => new Set(prev).add(day));
    }
    function editCabDay(day: number, amount: number) {
        setCabDayEdits((prev) => ({ ...prev, [day]: amount }));
        setTouchedCabDays((prev) => new Set(prev).add(day));
    }

    const hotelSubtotal = useMemo(() => Object.values(hotelDayEdits).reduce((sum, v) => sum + (v || 0), 0), [hotelDayEdits]);
    const cabSubtotal = useMemo(() => Object.values(cabDayEdits).reduce((sum, v) => sum + (v || 0), 0), [cabDayEdits]);
    const ticketsSubtotal = useMemo(() => Object.values(ticketFares).reduce((sum, f) => sum + (f || 0), 0), [ticketFares]);
    const addonsSubtotal = useMemo(() => Object.values(addonEdits).reduce((sum, a) => sum + (a.price || 0) * (a.quantity || 1), 0), [addonEdits]);
    const totalPax = pkg.adults + pkg.children;

    const preview = useMemo(() => computeFinalPricing({
        hotelSubtotal, cabSubtotal, addonsSubtotal, ticketsSubtotal,
        marginPercentage: margin, gstPercentage: gst, totalPax,
    }), [hotelSubtotal, cabSubtotal, addonsSubtotal, ticketsSubtotal, margin, gst, totalPax]);

    function handleApprove() {
        startTransition(async () => {
            const result = await approveCustomPackage(pkg.id);
            if (result.success) {
                toast.success(result.message);
                // revalidatePath inside the action invalidates the route's
                // cache, but this page's `pkg` prop won't actually refetch
                // without an explicit refresh — without this, the button row
                // below (gated on !pkg.verified) kept showing "Approve" as
                // though nothing had happened until a manual reload.
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    }

    function handleSave() {
        const payload: PricingEditInput = {
            marginPercentage: margin,
            gstPercentage: gst,
            hotelDayOverrides: [...touchedHotelDays].map((day) => ({ day, amount: hotelDayEdits[day] ?? null })),
            cabDayOverrides: [...touchedCabDays].map((day) => ({ day, amount: cabDayEdits[day] ?? null })),
            tickets: tickets.map((t) => ({ id: t.id, fare: ticketFares[t.id] ?? 0 })),
            addOns: addOns.map((a) => ({ id: a.id, price: addonEdits[a.id]?.price ?? 0, quantity: addonEdits[a.id]?.quantity ?? 1 })),
        };
        startTransition(async () => {
            const result = await updatePackagePricing(pkg.id, payload);
            if (result.success) {
                toast.success(result.message);
                setEditMode(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    }

    const travellersLine = [
        `${pkg.adults} Adult${pkg.adults !== 1 ? "s" : ""}`,
        pkg.children > 0 ? `${pkg.children} Child${pkg.children !== 1 ? "ren" : ""}${pkg.childrenAges.length > 0 ? ` (age ${pkg.childrenAges.join(", ")})` : ""}` : null,
        pkg.infants > 0 ? `${pkg.infants} Infant${pkg.infants !== 1 ? "s" : ""}${pkg.infantAges.length > 0 ? ` (age ${pkg.infantAges.join(", ")})` : ""}` : null,
    ].filter(Boolean).join(", ");
    const nHotels = s ? new Set(s.hotel.lines.map((l) => l.hotelName)).size : 0;
    const nCabVehicles = s ? new Set(s.cab.lines.map((l) => l.vehicleName)).size : 0;
    const addonLines = addOns; // live rows — always the current source of truth
    const hotelDrift = s?.displayedTotalPrice != null && Math.round(s.displayedTotalPrice) !== Math.round(s.finalPrice) && !editMode;

    const state: "pending" | "verified" | "rejected" = pkg.verified ? "verified" : pkg.rejectedAt ? "rejected" : "pending";
    const panel = variant === "panel";

    return (
        <div className={panel ? "flex flex-col gap-4 p-4" : "flex flex-col gap-5"}>
            {!panel && (
                <Link href="/dashboard/verify-packages" className="text-sm text-dashboard-neutral hover:text-dashboard-primary cursor-pointer transition-colors">
                    ← Back to verify packages
                </Link>
            )}

            {/* Header. In panel mode the title is the editor's, so only the
                actions survive — those are the reason costing is here. */}
            <div className={panel ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-start justify-between gap-3"}>
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{pkg.title}</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">
                        {pkg.sentAt
                            ? <>Sent {fmtDateTime(pkg.sentAt)} by {pkg.builtByName ?? "—"}</>
                            : <>Marked ready {fmtDateTime(pkg.readyAt)} by {pkg.readyByName ?? pkg.builtByName ?? "—"}</>}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={`/dashboard/verify-packages/${pkg.id}/pdf`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-md border border-dashboard-base-300 px-3 py-1.5 text-xs font-medium text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                    >
                        <Eye className="size-3.5" /> View Package
                    </Link>
                    <span className="inline-flex items-center rounded-md border border-dashboard-base-300">
                        <HistorySheet
                            id={pkg.id}
                            title={pkg.title}
                            entityLabel="package pricing"
                            fetchHistory={getPackagePricingHistory}
                        />
                    </span>
                    {state === "verified" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="size-3.5" />
                            Approved by {pkg.verifiedByName ?? "—"} · {fmtDateTime(pkg.verifiedAt)}
                            {pkg.status === "SENT" ? ` — sent to client ${fmtDateTime(pkg.sentAt)}` : " — awaiting exec to share with client"}
                        </span>
                    )}
                    {state === "rejected" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                            <XCircle className="size-3.5" /> Rejected by {pkg.rejectedByName ?? "—"} · {fmtDateTime(pkg.rejectedAt)} — awaiting rework
                        </span>
                    )}
                    {pkg.status === "READY" && !pkg.verified && !editMode && (
                        <>
                            <Button type="button" variant="outline" size="sm" onClick={enterEditMode} className="gap-1.5">
                                <Pencil className="size-3.5" /> Edit Pricing
                            </Button>
                            <RejectPricingDialog packageId={pkg.id} packageTitle={pkg.title} reasons={rejectionReasons}>
                                <Button type="button" variant="destructive" size="sm" className="gap-1.5">
                                    <XCircle className="size-3.5" /> Reject
                                </Button>
                            </RejectPricingDialog>
                            <Button type="button" size="sm" onClick={handleApprove} disabled={isPending} className="gap-1.5 bg-dashboard-primary text-white hover:opacity-90">
                                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                                {isPending ? "Approving…" : "Approve"}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {state === "rejected" && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-lg">
                    <XCircle className="size-4 mt-0.5 shrink-0 text-red-600" />
                    <div>
                        <p className="text-sm font-semibold text-red-800">Sent back for rework — {pkg.rejectionReasonLabel ?? "Unknown reason"}</p>
                        {pkg.rejectionNote && <p className="text-xs text-red-700 mt-0.5">&quot;{pkg.rejectionNote}&quot;</p>}
                    </div>
                </div>
            )}

            {pkg.status === "READY" && state === "pending" && pkg.revisionNote && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 shadow-lg">
                    <Pencil className="size-4 mt-0.5 shrink-0 text-blue-600" />
                    <div>
                        <p className="text-sm font-semibold text-blue-800">
                            {pkg.revisionRequestedByName ?? "The sales exec"} pulled this back for another look — resubmitted for review
                        </p>
                        <p className="text-xs text-blue-700 mt-0.5">&quot;{pkg.revisionNote}&quot;</p>
                    </div>
                </div>
            )}

            {pkg.status !== "READY" && pkg.revisionNote && !pkg.verified && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 shadow-lg">
                    <Pencil className="size-4 mt-0.5 shrink-0 text-blue-600" />
                    <div>
                        <p className="text-sm font-semibold text-blue-800">
                            {pkg.revisionRequestedByName ?? "The sales exec"} pulled this back for revision — still editing
                        </p>
                        <p className="text-xs text-blue-700 mt-0.5">&quot;{pkg.revisionNote}&quot;</p>
                        <p className="text-xs text-blue-700 mt-1">Nothing to review yet — this reappears here once they resubmit it with Mark Ready.</p>
                    </div>
                </div>
            )}

            {pkg.status !== "READY" ? (
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral shadow-lg">
                    {pkg.revisionNote
                        ? "Being edited by the sales exec right now — check back once it's resubmitted."
                        : "Sent back for rework — waiting for the sales exec to fix and resubmit it."}
                </div>
            ) : !s ? (
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral shadow-lg">
                    No locked pricing snapshot found for this package — nothing to verify yet.
                </div>
            ) : (
                <div className={panel ? "flex flex-col gap-4" : "grid gap-5 lg:grid-cols-3 items-start"}>
                    {/* ── Pricing breakdown ─────────────────────────────────── */}
                    <div className={panel ? "flex flex-col gap-4" : "lg:col-span-2 flex flex-col gap-4"}>
                        {/* This branch only ever renders while pkg.status === "READY"
                            (see the outer ternary above) — i.e. always mid-review, even
                            if the package was sent in an earlier cycle and pulled back
                            for revision (sentAt/pricingSnapshot are kept as history and
                            never cleared on resubmission, see requestPackageRevision).
                            So this is always a live preview, never the frozen send. */}
                        <p className="text-xs text-dashboard-neutral">
                            {editMode
                                ? "Correcting pricing before it's locked in — saving keeps this package awaiting review."
                                : "Live preview — these are the exact numbers that will be locked in the moment the exec sends this to the client."}
                        </p>

                        {hotelDrift && s.displayedTotalPrice != null && (
                            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
                                <AlertCircle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">Hand-overridden price</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        The exec sent {inr(s.displayedTotalPrice)} instead of the computed {inr(s.finalPrice)}
                                        {" "}({inr(Math.abs(s.displayedTotalPrice - s.finalPrice))} {s.displayedTotalPrice > s.finalPrice ? "higher" : "lower"}).
                                    </p>
                                </div>
                            </div>
                        )}

                        {editMode && (
                            <div className="rounded-xl border border-dashboard-primary/40 bg-dashboard-primary/5 px-4 py-3.5 shadow-lg flex flex-wrap gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs">Margin %</Label>
                                    <Input type="number" min={0} max={100} step={0.5} value={margin}
                                        onChange={(e) => setMargin(Number(e.target.value))} className="w-28" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">GST %</Label>
                                    <Input type="number" min={0} max={100} step={0.5} value={gst}
                                        onChange={(e) => setGst(Number(e.target.value))} className="w-28" />
                                </div>
                            </div>
                        )}

                        {(s.hotel.lines.length > 0 || editMode) && (
                            <BreakdownCard
                                icon={Building2}
                                title="Hotel"
                                meta={`${nHotels} hotel${nHotels !== 1 ? "s" : ""} · ${s.hotel.nightsCounted} night${s.hotel.nightsCounted !== 1 ? "s" : ""}`}
                                subtotal={hotelSubtotal}
                            >
                                {groupByDay(s.hotel.lines).map(({ day, lines, total }) => {
                                    const hotelId = hotelIdByDay[day];
                                    const overridden = lines.some((l) => l.overridden);
                                    return (
                                        <div key={day} className="flex items-center justify-between px-4 py-2.5 text-sm gap-3">
                                            <div className="min-w-0">
                                                {lines.map((l, i) => (
                                                    <div key={i} className={i > 0 ? "mt-1.5" : ""}>
                                                        <p className="text-dashboard-base-content">
                                                            Day {l.day}:{" "}
                                                            {i === 0 && hotelId != null ? (
                                                                <a
                                                                    href={`/dashboard/hotels/${hotelId}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-dashboard-primary hover:underline"
                                                                >
                                                                    {l.hotelName}
                                                                </a>
                                                            ) : l.hotelName}
                                                            {" "}— {l.roomName}
                                                            {overridden && <span className="ml-1.5 text-[10px] font-medium text-amber-600">(corrected)</span>}
                                                        </p>
                                                        {!l.overridden && (
                                                            <p className="text-xs text-dashboard-neutral mt-0.5">
                                                                {l.roomsNeeded} room{l.roomsNeeded !== 1 ? "s" : ""} × {inr(l.pricePerRoom)}
                                                                {l.mattresses > 0 && ` + ${l.mattresses} mattress${l.mattresses !== 1 ? "es" : ""} × ${inr(l.extraBedRate)}`}
                                                            </p>
                                                        )}
                                                        {/* These days used to be omitted from the breakdown entirely, so
                                                            the subtotal was quietly short and there was nothing on screen
                                                            to review. They now show, at ₹0, saying what is missing. */}
                                                        {l.gap && (
                                                            <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                                                <AlertCircle className="size-3 shrink-0" />
                                                                {l.gap === "no-room-price"
                                                                    ? "No room rate set — this day is priced at ₹0"
                                                                    : `${l.mattresses} mattress${l.mattresses !== 1 ? "es" : ""} with no rate — charging ₹0 for them`}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {editMode ? (
                                                <Input type="number" min={0} value={hotelDayEdits[day] ?? total}
                                                    onChange={(e) => editHotelDay(day, Number(e.target.value))}
                                                    className="w-28 text-right font-semibold shrink-0" />
                                            ) : (
                                                <span className="font-semibold text-dashboard-base-content shrink-0 ml-3">{inr(total)}</span>
                                            )}
                                        </div>
                                    );
                                })}
                                {s.hotel.lines.length === 0 && (
                                    <p className="px-4 py-3 text-xs text-dashboard-neutral">No per-day breakdown recorded — subtotal only.</p>
                                )}
                            </BreakdownCard>
                        )}

                        {(s.cab.lines.length > 0 || editMode) && (
                            <BreakdownCard
                                icon={Car}
                                title="Cab"
                                meta={`${nCabVehicles} vehicle type${nCabVehicles !== 1 ? "s" : ""} · ${s.cab.daysCounted} day${s.cab.daysCounted !== 1 ? "s" : ""}`}
                                subtotal={cabSubtotal}
                            >
                                {groupByDay(s.cab.lines).map(({ day, lines, total }) => {
                                    const overridden = lines.some((l) => l.overridden);
                                    return (
                                        <div key={day} className="flex items-center justify-between px-4 py-2.5 text-sm gap-3">
                                            <p className="text-dashboard-base-content min-w-0">
                                                {lines.map((l) => `${l.vehicleName} (${l.pricingType})`).join(" + ")}
                                                {" "}on Day {day}
                                                {overridden && <span className="ml-1.5 text-[10px] font-medium text-amber-600">(corrected)</span>}
                                            </p>
                                            {editMode ? (
                                                <Input type="number" min={0} value={cabDayEdits[day] ?? total}
                                                    onChange={(e) => editCabDay(day, Number(e.target.value))}
                                                    className="w-28 text-right font-semibold shrink-0" />
                                            ) : (
                                                <span className="font-semibold text-dashboard-base-content shrink-0 ml-3">{inr(total)}</span>
                                            )}
                                        </div>
                                    );
                                })}
                                {s.cab.lines.length === 0 && (
                                    <p className="px-4 py-3 text-xs text-dashboard-neutral">No per-day breakdown recorded — subtotal only.</p>
                                )}
                            </BreakdownCard>
                        )}

                        {(tickets.length > 0) && (
                            <BreakdownCard icon={Ticket} title="Flight, Train, Helicopter, Bus & Other Tickets" subtotal={ticketsSubtotal}>
                                {tickets.map((t) => {
                                    const TypeIcon = TICKET_TYPE_ICONS[t.type] ?? TrainFront;
                                    // OTHER has no fixed meaning of its own — the exec's own
                                    // description (provider) IS the label, not a suffix on it.
                                    const typeLabel = t.type === "OTHER" ? (t.provider || "Other") : t.type;
                                    return (
                                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm gap-3">
                                        <p className="text-dashboard-base-content min-w-0">
                                            <TypeIcon className="inline size-3.5 mr-1 -mt-0.5 text-dashboard-neutral" />
                                            {typeLabel} {t.type !== "OTHER" && t.provider && `(${t.provider})`}: {t.fromPlace || "—"} → {t.toPlace || "—"} × {t.ticketCount}
                                        </p>
                                        {editMode ? (
                                            <Input type="number" min={0} value={ticketFares[t.id] ?? 0}
                                                onChange={(e) => setTicketFares((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
                                                className="w-28 text-right shrink-0" />
                                        ) : (
                                            <span className="font-semibold text-dashboard-base-content shrink-0">{inr(t.fare)}</span>
                                        )}
                                    </div>
                                    );
                                })}
                            </BreakdownCard>
                        )}

                        {(addonLines.length > 0) && (
                            <BreakdownCard icon={Gift} title="Add-ons" subtotal={addonsSubtotal}>
                                {addonLines.map((a) => (
                                    <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm gap-3">
                                        <div className="min-w-0">
                                            <p className="text-dashboard-base-content">{a.name}{a.day != null && <span className="text-xs text-dashboard-neutral"> · Day {a.day}</span>}</p>
                                        </div>
                                        {editMode ? (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Input type="number" min={0} value={addonEdits[a.id]?.price ?? 0}
                                                    onChange={(e) => setAddonEdits((prev) => ({ ...prev, [a.id]: { ...prev[a.id], price: Number(e.target.value) } }))}
                                                    className="w-24 text-right" />
                                                <span className="text-xs text-dashboard-neutral">×</span>
                                                <Input type="number" min={1} value={addonEdits[a.id]?.quantity ?? 1}
                                                    onChange={(e) => setAddonEdits((prev) => ({ ...prev, [a.id]: { ...prev[a.id], quantity: Number(e.target.value) } }))}
                                                    className="w-16 text-right" />
                                            </div>
                                        ) : (
                                            <span className="font-semibold text-dashboard-base-content shrink-0">{inr(a.price * a.quantity)} <span className="text-xs font-normal text-dashboard-neutral">({a.quantity}×{inr(a.price)})</span></span>
                                        )}
                                    </div>
                                ))}
                            </BreakdownCard>
                        )}

                        {/* Inclusions & Exclusions — separate edit/save from pricing, so a
                            reviewer can veto a standard line (or a Sales Exec's own
                            addition) that doesn't apply to this package without also
                            touching pricing. Persists via updatePackageInclusionsExclusions;
                            reflected in the exec's builder, the "View Package" PDF above,
                            and the client-facing send once approved/sent. */}
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden shadow-lg">
                            <div className="flex items-center justify-between border-b border-dashboard-base-300 bg-dashboard-base-200/60 px-4 py-2.5">
                                <span className="flex items-center gap-2 text-sm font-semibold text-dashboard-base-content">
                                    <ListChecks className="size-4 text-dashboard-neutral" />
                                    <span>Inclusions & Exclusions</span>
                                </span>
                                {pkg.status === "READY" && !pkg.verified && !policyEditMode && (
                                    <Button type="button" variant="outline" size="sm" onClick={enterPolicyEditMode} className="gap-1.5 h-7 px-2.5 text-xs">
                                        <Pencil className="size-3.5" /> Edit
                                    </Button>
                                )}
                            </div>
                            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-dashboard-base-300/60">
                                <div className="py-3">
                                    <p className="px-4 pb-1.5 text-xs font-semibold text-dashboard-base-content/70 flex items-center gap-1.5">
                                        <ListChecks className="size-3.5 text-dashboard-success" /> Inclusions
                                    </p>
                                    <PolicyListEditor
                                        icon={ListChecks} tone="success"
                                        items={policyEditMode ? inclusionsEdit : inclusions}
                                        editing={policyEditMode}
                                        onRemove={(item) => setInclusionsEdit((prev) => prev.filter((i) => i !== item))}
                                        draft={newInclusion} onDraftChange={setNewInclusion} onAdd={addInclusion}
                                    />
                                </div>
                                <div className="py-3">
                                    <p className="px-4 pb-1.5 text-xs font-semibold text-dashboard-base-content/70 flex items-center gap-1.5">
                                        <ListX className="size-3.5 text-dashboard-error" /> Exclusions
                                    </p>
                                    <PolicyListEditor
                                        icon={ListX} tone="error"
                                        items={policyEditMode ? exclusionsEdit : exclusions}
                                        editing={policyEditMode}
                                        onRemove={(item) => setExclusionsEdit((prev) => prev.filter((e) => e !== item))}
                                        draft={newExclusion} onDraftChange={setNewExclusion} onAdd={addExclusion}
                                    />
                                </div>
                            </div>
                            {policyEditMode && (
                                <div className="flex justify-end gap-2 border-t border-dashboard-base-300 px-4 py-3">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setPolicyEditMode(false)} disabled={isPending} className="gap-1.5">
                                        <X className="size-3.5" /> Cancel
                                    </Button>
                                    <Button type="button" size="sm" onClick={handleSavePolicy} disabled={isPending} className="gap-1.5 bg-dashboard-primary text-white hover:opacity-90">
                                        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                                        {isPending ? "Saving…" : "Save Changes"}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Totals */}
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-3.5 shadow-lg text-sm space-y-1.5">
                            <div className="flex justify-between"><span className="text-dashboard-neutral">Base cost</span><span className="text-dashboard-base-content">{inr(editMode ? preview.baseCost : s.baseCost)}</span></div>
                            <div className="flex justify-between"><span className="text-dashboard-neutral">Margin ({editMode ? margin : s.marginPercentage}% hotel/cab + 5% tickets)</span><span className="text-dashboard-base-content">{inr(editMode ? preview.marginAmount : s.marginAmount)}</span></div>
                            <div className="flex justify-between"><span className="text-dashboard-neutral">GST ({editMode ? gst : s.gstPercentage}%)</span><span className="text-dashboard-base-content">{inr(editMode ? preview.gstAmount : s.gstAmount)}</span></div>
                            <div className="flex justify-between font-bold border-t border-dashboard-base-300 pt-1.5 mt-1.5">
                                <span className="text-dashboard-base-content">{editMode ? "New total" : "Computed total"}</span>
                                <span className="text-dashboard-base-content">{inr(editMode ? preview.finalPrice : s.finalPrice)}</span>
                            </div>
                            <p className="text-xs text-dashboard-neutral">{inr(editMode ? preview.pricePerPerson : s.pricePerPerson)} per person</p>
                            {!editMode && (s.hotel.overridden || s.cab.overridden) && (
                                <p className="text-[11px] text-dashboard-neutral pt-1 border-t border-dashboard-base-300/60 mt-1.5">
                                    {s.hotel.overridden && s.cab.overridden ? "Hotel and cab pricing" : s.hotel.overridden ? "Hotel pricing" : "Cab pricing"} manually corrected during review
                                </p>
                            )}
                        </div>

                        {editMode && (
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setEditMode(false)} disabled={isPending} className="gap-1.5">
                                    <X className="size-3.5" /> Cancel
                                </Button>
                                <Button type="button" onClick={handleSave} disabled={isPending} className="gap-1.5 bg-dashboard-primary text-white hover:opacity-90">
                                    {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                                    {isPending ? "Saving…" : "Save Corrections"}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* ── Sidebar ──────────────────────────────────────────── */}
                    <div className="flex flex-col gap-4">
                        {findingsSlot}
                        <SideCard title="Client Details">
                            <div className="flex flex-col gap-3">
                                <InfoItem icon={Users} label="Name" value={query.name} />
                                <InfoItem
                                    icon={Phone} label="Phone"
                                    value={
                                        <a href={`tel:+${query.countryCode}${query.phone}`} className="text-dashboard-primary hover:underline">
                                            +{query.countryCode} {query.phone}
                                        </a>
                                    }
                                />
                                {query.email && (
                                    <InfoItem
                                        icon={Mail} label="Email"
                                        value={<a href={`mailto:${query.email}`} className="text-dashboard-primary hover:underline">{query.email}</a>}
                                    />
                                )}
                                <InfoItem icon={MapPin} label="Destination" value={`${pkg.destination}${pkg.startingPoint ? ` (from ${pkg.startingPoint})` : ""}`} />
                                <InfoItem icon={CalendarDays} label="Travel Date" value={fmtDate(pkg.travelDate)} />
                                <InfoItem icon={Users} label="Travellers" value={`${travellersLine} · ${pkg.totalDays}D/${pkg.totalNights}N`} />
                                {query.message && (
                                    <div className="mt-1 rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 px-3 py-2">
                                        <p className="text-xs text-dashboard-base-content/60 italic">&quot;{query.message}&quot;</p>
                                    </div>
                                )}
                            </div>
                        </SideCard>

                        {(pkg.flightsIncluded || pkg.trainIncluded) && (
                            <SideCard title="Flight & Train">
                                <div className="flex flex-col gap-3">
                                    {pkg.flightsIncluded && (
                                        <InfoItem icon={PlaneTakeoff} label="Flight"
                                            value={`${pkg.flightFrom ?? "—"} → ${pkg.flightTo ?? "—"}${pkg.flightNotes ? ` · ${pkg.flightNotes}` : ""}`} />
                                    )}
                                    {pkg.trainIncluded && (
                                        <InfoItem icon={TrainFront} label="Train"
                                            value={`${pkg.trainFrom ?? "—"} → ${pkg.trainTo ?? "—"}${pkg.trainNotes ? ` · ${pkg.trainNotes}` : ""}`} />
                                    )}
                                </div>
                            </SideCard>
                        )}

                        <SideCard title="Package Status">
                            <div className="flex flex-col gap-3">
                                <InfoItem icon={Send} label={pkg.sentAt ? "Sent" : "Ready For Review"} value={fmtDateTime(pkg.sentAt ?? pkg.readyAt)} />
                                <InfoItem
                                    icon={Eye} label="Client Viewed"
                                    value={pkg.viewedAt ? `Yes — ${fmtDate(pkg.viewedAt)} (${pkg.viewCount}×)` : "Not yet"}
                                />
                                <InfoItem
                                    icon={state === "verified" ? CheckCircle2 : state === "rejected" ? XCircle : Clock}
                                    label="Verification"
                                    value={state === "verified" ? "Verified" : state === "rejected" ? "Rejected — awaiting rework" : "Pending review"}
                                />
                                <div className="mt-1 flex items-center justify-between rounded-lg bg-dashboard-base-200 px-3 py-2.5">
                                    <span className="text-xs font-medium text-dashboard-neutral flex items-center gap-1"><IndianRupee className="size-3" /> Preview Price</span>
                                    <span className="text-sm font-bold text-dashboard-base-content">{inr(pkg.totalPrice ?? s.finalPrice)}</span>
                                </div>
                            </div>
                        </SideCard>

                        <SideCard title="Turnaround Time">
                            <div className="flex flex-col gap-3">
                                <InfoItem
                                    icon={Clock} label="Assigned → Ready"
                                    value={query.assignedAt && pkg.readyAt ? fmtDuration(new Date(query.assignedAt).getTime(), new Date(pkg.readyAt).getTime()) : "—"}
                                />
                                <InfoItem
                                    icon={Clock} label="Ready → Sent"
                                    value={
                                        pkg.readyAt && pkg.sentAt
                                            ? fmtDuration(new Date(pkg.readyAt).getTime(), new Date(pkg.sentAt).getTime())
                                            : pkg.readyAt ? "Awaiting send" : "—"
                                    }
                                />
                            </div>
                        </SideCard>
                    </div>
                </div>
            )}
        </div>
    );
}
