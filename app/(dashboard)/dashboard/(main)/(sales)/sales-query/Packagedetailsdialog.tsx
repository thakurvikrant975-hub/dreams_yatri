"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { ScrollArea } from "../../components/ui/scroll-area";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
    Users, MapPin, Hotel, Car, Zap, Wallet,
    Plus, X, AlertCircle, ChevronRight, ChevronLeft,
    CheckCircle2, CalendarDays, Loader2, Pencil, Heart,
    Ticket, Plane, TrainFront, Check,
} from "lucide-react";
import { savePackageRequirements, updateTicketDetails } from "./actions";
import type { PackageQueryType, PackageRequirements, TravellerMember } from "../../(marketing)/queries/actions";
import { getVehiclesWithRates, type VehicleFull } from "../../(cabs)/vehicles/actions";
import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import { ROUTE_STOP_TYPES, TRANSFER_TYPES, type LocationValue } from "../../components/location/location.types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STAY_TYPES = [
    { value: "STAR_3", label: "3 Star" },
    { value: "STAR_4", label: "4 Star" },
    { value: "STAR_5", label: "5 Star" },
    { value: "BOUTIQUE", label: "Boutique" },
    { value: "HOMESTAY", label: "Homestay" },
    { value: "RESORT", label: "Resort" },
    { value: "CAMP", label: "Camp / Tent" },
    { value: "BUDGET", label: "Budget" },
];

const MEAL_TYPES = [
    { value: "VEG", label: "Veg" },
    { value: "NON_VEG", label: "Non-Veg" },
    { value: "JAIN", label: "Jain" },
    { value: "HALAL", label: "Halal" },
    { value: "VEGAN", label: "Vegan" },
];

// Matches the `VehicleType` enum in schema.prisma — human-readable labels for
// the vehicle *types* fetched from `/dashboard/vehicles` (grouped, not one
// chip per individual vehicle).
const VEHICLE_TYPE_LABELS: Record<string, string> = {
    HATCHBACK: "Hatchback", SEDAN: "Sedan", SUV: "SUV",
    LUXURY_SEDAN: "Luxury Sedan", LUXURY_SUV: "Luxury SUV",
    TEMPO_TRAVELLER: "Tempo Traveller", MINI_BUS: "Mini Bus", BUS: "Bus",
    Rikshaw: "Rickshaw",
};

// Fallback for cabTypes values saved before this list came from the fleet —
// keeps old selections visible instead of showing a raw string.
const LEGACY_CAB_LABELS: Record<string, string> = {
    SEDAN: "Sedan", SUV: "SUV", BOLERO: "Bolero", INNOVA: "Innova/Crysta",
    TEMPO: "Tempo Traveller", VOLVO: "Volvo Bus", MINI_BUS: "Mini Bus", BIKE: "Bike Rental",
};

const TRIP_TYPES = [
    { value: "FAMILY", label: "Family Trip" },
    { value: "HONEYMOON", label: "Honeymoon" },
    { value: "HOLIDAY", label: "Holiday / Leisure" },
    { value: "FRIENDS", label: "Friends / Group" },
    { value: "SOLO", label: "Solo Travel" },
    { value: "ANNIVERSARY", label: "Anniversary" },
    { value: "ADVENTURE", label: "Adventure" },
    { value: "PILGRIMAGE", label: "Pilgrimage / Religious" },
    { value: "BUSINESS", label: "Business" },
    { value: "CORPORATE", label: "Corporate / MICE" },
    { value: "OTHER", label: "Other" },
] as const;

const PRESET_ACTIVITIES = [
    { value: "PARAGLIDING", label: "Paragliding" },
    { value: "RIVER_RAFTING", label: "River Rafting" },
    { value: "TREKKING", label: "Trekking" },
    { value: "SKIING", label: "Skiing/Snowboard" },
    { value: "BUNGEE", label: "Bungee Jumping" },
    { value: "ZIP_LINE", label: "Zip Line" },
    { value: "CAMPING", label: "Camping" },
    { value: "SNORKELING", label: "Snorkeling" },
    { value: "SCUBA", label: "Scuba Diving" },
    { value: "SAFARI", label: "Wildlife Safari" },
    { value: "BOAT_RIDE", label: "Boat/Shikara Ride" },
    { value: "ATV", label: "ATV/Quad Biking" },
    { value: "HOT_AIR", label: "Hot Air Balloon" },
    { value: "SIGHTSEEING", label: "Sightseeing Tour" },
    { value: "PHOTOGRAPHY", label: "Photography Tour" },
    { value: "COOKING", label: "Cooking Class" },
    { value: "YOGA", label: "Yoga/Wellness" },
    { value: "HORSE_RIDE", label: "Horse Riding" },
    { value: "CABLE_CAR", label: "Cable Car" },
    { value: "ICE_SKATING", label: "Ice Skating" },
];

// `bg`/`bgLight`/`ring` are spelled out in full (not built from `color` at
// render time) — Tailwind's scanner needs the literal class strings to
// appear somewhere in this file's source text to generate the CSS for them;
// a runtime-interpolated `` `bg-${accent}` `` would compile to nothing.
const TABS = [
    { id: "travellers", label: "Travellers", desc: "Who's coming on this trip", icon: Users,
      color: "text-dashboard-primary", bg: "bg-dashboard-primary", content: "text-dashboard-primary-content", bgLight: "bg-dashboard-primary/12", ring: "ring-dashboard-primary/30" },
    { id: "journey", label: "Journey", desc: "Route, dates & destinations", icon: MapPin,
      color: "text-dashboard-success", bg: "bg-dashboard-success", content: "text-dashboard-success-content", bgLight: "bg-dashboard-success/12", ring: "ring-dashboard-success/30" },
    { id: "booking", label: "Ticket Booking", desc: "Flight or train, already booked?", icon: Ticket,
      color: "text-dashboard-info", bg: "bg-dashboard-info", content: "text-dashboard-info-content", bgLight: "bg-dashboard-info/12", ring: "ring-dashboard-info/30" },
    { id: "stay", label: "Stay", desc: "Accommodation & meals", icon: Hotel,
      color: "text-dashboard-secondary", bg: "bg-dashboard-secondary", content: "text-dashboard-secondary-content", bgLight: "bg-dashboard-secondary/12", ring: "ring-dashboard-secondary/30" },
    { id: "transport", label: "Transport", desc: "Local cabs & transfers", icon: Car,
      color: "text-dashboard-warning", bg: "bg-dashboard-warning", content: "text-dashboard-warning-content", bgLight: "bg-dashboard-warning/12", ring: "ring-dashboard-warning/30" },
    { id: "activities", label: "Activities", desc: "Experiences to include", icon: Zap,
      color: "text-dashboard-accent", bg: "bg-dashboard-accent", content: "text-dashboard-accent-content", bgLight: "bg-dashboard-accent/12", ring: "ring-dashboard-accent/30" },
    { id: "budget", label: "Budget", desc: "Customer's price range", icon: Wallet,
      color: "text-dashboard-error", bg: "bg-dashboard-error", content: "text-dashboard-error-content", bgLight: "bg-dashboard-error/12", ring: "ring-dashboard-error/30" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normalizes to Title Case as the exec types — lowercases everything first
// so "JOHN SMITH" / "john Smith" / "john smith" all converge on "John Smith"
// instead of preserving whatever casing was typed or pasted. Same pattern
// Addquerydialog's own capitalizeWords uses.
function capitalizeWords(s: string): string {
    return s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/** Rebuilds the per-traveller name/age list when adult/child/infant counts
 * change — preserves existing entries (matched by type, in order) so editing
 * a count doesn't wipe out names already typed in for the other travellers. */
function rebuildMembers(
    prevMembers: TravellerMember[],
    adults: number, children: number, infants: number,
): TravellerMember[] {
    const queues: Record<TravellerMember["type"], TravellerMember[]> = { ADULT: [], CHILD: [], INFANT: [] };
    for (const m of prevMembers) queues[m.type].push(m);
    const take = (type: TravellerMember["type"], defaultAge: number): TravellerMember =>
        queues[type].shift() ?? { type, name: "", age: defaultAge };

    const members: TravellerMember[] = [];
    for (let i = 0; i < adults; i++) members.push(take("ADULT", 30));
    for (let i = 0; i < children; i++) members.push(take("CHILD", 8));
    for (let i = 0; i < infants; i++) members.push(take("INFANT", 1));
    return members;
}

/** Ensures `travellers.members` exists and matches the current pax counts,
 * and that `journey.departurePoints`/`journey.pickupPoints` exist — needed
 * both for a brand-new form and for requirements saved before either field
 * existed in its current shape. Two older generations are migrated here:
 *   1. the original single `journey.startingPoint` string
 *   2. a single `journey.pickupPoints: string[]` that conflated departure
 *      and pickup before the two were split into separate fields — treated
 *      as departure points on upgrade, since that's what it represented. */
function normalizeRequirements(
    reqs: PackageRequirements,
    fallback: PackageRequirements,
): PackageRequirements {
    /*
     * `requirements` is free-form JSON on the query, so a stored object is not
     * guaranteed to carry any particular section — a lead created by something
     * other than this form (the .com landing-page bridge writes its own
     * metadata there) has none of them. The caller's `??` only covers a null
     * column, not a non-null object of a different shape, which destructured
     * straight to undefined and took the whole sales queue down server-side.
     *
     * Sections are merged onto the defaults rather than trusted wholesale, so
     * a partially-filled one from an older format is completed rather than
     * left with missing keys for the fields below to trip over.
     */
    const travellersSrc = { ...fallback.travellers, ...(reqs.travellers ?? {}) };
    const journeySrc = { ...fallback.journey, ...(reqs.journey ?? {}) };
    // The remaining sections get the same treatment for the same reason — the
    // fields below reach into them (`.types.length`, `.selected.map`) and a
    // half-filled one from an older format would throw just as readily.
    const restSrc = {
        stay: { ...fallback.stay, ...(reqs.stay ?? {}) },
        transport: { ...fallback.transport, ...(reqs.transport ?? {}) },
        activities: { ...fallback.activities, ...(reqs.activities ?? {}) },
        budget: { ...fallback.budget, ...(reqs.budget ?? {}) },
    };

    const { adults, children, infants, members } = travellersSrc;
    const rawJourney = journeySrc as unknown as {
        startingPoint?: string;
        pickupPoints?: string[];
        departurePoints?: string[];
    };
    const isPreSplitFormat = rawJourney.departurePoints === undefined;
    const departurePoints = isPreSplitFormat
        ? (rawJourney.pickupPoints ?? (rawJourney.startingPoint ? [rawJourney.startingPoint] : []))
        : (rawJourney.departurePoints ?? []);
    const pickupPoints = isPreSplitFormat ? [] : (rawJourney.pickupPoints ?? []);

    return {
        ...fallback,
        ...reqs,
        ...restSrc,
        travellers: {
            ...travellersSrc,
            members: members && members.length === adults + children + infants
                ? members
                : rebuildMembers(members ?? [], adults, children, infants),
        },
        journey: {
            ...journeySrc,
            departurePoints,
            pickupPoints,
        },
    };
}

function defaultRequirements(query: PackageQueryType): PackageRequirements {
    return {
        travellers: {
            leadName: query.name,
            adults: query.groupSize ?? 1,
            children: 0,
            infants: 0,
            members: rebuildMembers([], query.groupSize ?? 1, 0, 0),
            tripType: "",
            tripTypeCustom: "",
            specialDemands: "",
        },
        journey: {
            departurePoints: [],
            pickupPoints: [],
            dateType: "FIXED",
            travelDate: query.travelDate
                ? new Date(query.travelDate).toISOString().split("T")[0]
                : "",
            flexibleFrom: "",
            flexibleTo: "",
            noOfDays: 3,
            noOfNights: 2,
            destinations: query.destination ? [query.destination] : [],
            specialDemands: "",
        },
        stay: {
            types: [],
            mealTypes: [],
            customMeal: "",
            specialDemands: "",
        },
        transport: {
            required: true,
            cabTypes: [],
            includeFlights: false,
            includeTrain: false,
            specialDemands: "",
        },
        activities: {
            selected: [],
            custom: [],
            specialDemands: "",
        },
        budget: {
            type: "PER_PERSON",
            min: undefined,
            max: undefined,
            currency: "INR",
            specialDemands: "",
        },
    };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleChip({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all select-none cursor-pointer",
                selected
                    ? "bg-dashboard-primary/10 text-dashboard-primary border-dashboard-primary shadow-sm"
                    : "bg-dashboard-base-100 text-dashboard-base-content border-dashboard-base-300 hover:border-dashboard-primary/60 hover:bg-dashboard-primary/5",
            ].join(" ")}
        >
            {label}
        </button>
    );
}

function MultiToggle({
    options,
    selected,
    onChange,
}: {
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (v: string[]) => void;
}) {
    function toggle(v: string) {
        onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
    }
    return (
        <div className="flex flex-wrap gap-2">
            {options.map(opt => (
                <ToggleChip
                    key={opt.value}
                    label={opt.label}
                    selected={selected.includes(opt.value)}
                    onClick={() => toggle(opt.value)}
                />
            ))}
        </div>
    );
}

function SpecialDemands({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-1.5 pt-4 mt-2 border-t border-dashed border-dashboard-base-300/60">
            <Label className="text-xs text-dashboard-base-content/70 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Special Demands <span className="text-dashboard-base-content/60 font-normal">(optional)</span>
            </Label>
            <Textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="Any special requirements for this section..."
                rows={2}
                className="resize-none text-sm bg-dashboard-base-200/30 border-dashboard-base-300 focus-visible:ring-dashboard-primary/30 placeholder:text-dashboard-base-content/40"
            />
        </div>
    );
}

function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    color,
    bg,
}: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    color: string;
    /** Light tint of `color` for the icon's own circle — same "colored
     * tint behind a full-strength icon" pairing StatCard uses elsewhere in
     * the dashboard, rather than a neutral gray disc. */
    bg: string;
}) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
                <h3 className="font-semibold text-base leading-tight text-dashboard-base-content">{title}</h3>
                <p className="text-xs text-dashboard-base-content/60 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

function ToggleButton({
    selected,
    onClick,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer",
                selected
                    ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary shadow-sm"
                    : "bg-dashboard-base-100 text-dashboard-base-content/60 border-dashboard-base-300 hover:border-dashboard-primary/40 hover:text-dashboard-base-content",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

/** Fixes three classic controlled-`<input type="number">` bugs seen on
 * every count field in this form (adults/children/infants/ages/days/nights):
 * (1) clamping to min/max on every keystroke means the field can never
 * actually go blank, so typing "7" over a shown "1" appends into "17"
 * instead of replacing it — this keeps its own draft string and only
 * clamps on blur; (2) selects existing text on focus so a direct
 * click-and-type replaces the value like users expect; (3) blurs on wheel
 * so scrolling over the field doesn't silently bump the number. */
function NumberField({
    id, value, min, max, step, placeholder, className, onCommit, onBlurCommit,
}: {
    id?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    className?: string;
    /** Fires with a best-effort parsed number on every valid keystroke (so
     * live summaries like "Total Pax" stay in sync while typing), and again
     * with the clamped final value on blur (unless onBlurCommit is given). */
    onCommit: (n: number) => void;
    /** Overrides what fires on blur — e.g. Number of Days also needs to
     * cascade into Number of Nights (= days - 1) once the exec is done
     * typing, not on every keystroke. */
    onBlurCommit?: (n: number) => void;
}) {
    const [draft, setDraft] = useState(String(value));

    useEffect(() => {
        setDraft(String(value));
    }, [value]);

    return (
        <Input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            className={className}
            value={draft}
            onFocus={(e) => e.target.select()}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                if (raw === "") return; // let the field go visibly blank while typing
                const parsed = parseInt(raw, 10);
                if (!Number.isNaN(parsed)) onCommit(parsed);
            }}
            onBlur={(e) => {
                let n = parseInt(e.target.value, 10);
                if (Number.isNaN(n)) n = min ?? 0;
                if (min !== undefined) n = Math.max(min, n);
                if (max !== undefined) n = Math.min(max, n);
                setDraft(String(n));
                (onBlurCommit ?? onCommit)(n);
            }}
        />
    );
}

// Formats a Date into the value a `datetime-local` input expects (local
// time, no timezone suffix) — same helper as Addfollowupdialog's /
// Salesquerydetailsheet's.
function toDatetimeLocalValue(d: Date): string {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const TICKET_TYPES = [
    { label: "Train", value: "TRAIN", icon: TrainFront },
    { label: "Flight", value: "FLIGHT", icon: Plane },
];

type TicketDraft = {
    ticketBooked: boolean;
    ticketType: string;
    ticketFrom: string;
    ticketTo: string;
    ticketDateTimeValue: string;
};

function defaultTicketDraft(query: PackageQueryType): TicketDraft {
    return {
        ticketBooked: query.ticketBooked,
        ticketType: query.ticketType ?? "TRAIN",
        ticketFrom: query.ticketFrom ?? "",
        ticketTo: query.ticketTo ?? "",
        ticketDateTimeValue: query.ticketDateTime ? toDatetimeLocalValue(new Date(query.ticketDateTime)) : "",
    };
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Props = {
    query: PackageQueryType;
    children: React.ReactNode;
    onDone?: () => void;
    initialRequirements?: PackageRequirements | null;
    /** Optional controlled open state — e.g. for deep-opening from the
     * follow-up reminder popup. Falls back to internal state when omitted. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export function PackageDetailsDialog({
    query,
    children,
    onDone,
    initialRequirements,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
}: Props) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = setControlledOpen ?? setInternalOpen;
    const [activeTab, setActiveTab] = useState<TabId>("travellers");
    const [isPending, startTransition] = useTransition();
    const [reqs, setReqs] = useState<PackageRequirements>(() =>
        normalizeRequirements(initialRequirements ?? defaultRequirements(query), defaultRequirements(query)),
    );
    // Ticket booking lives on the query itself (package_queries.ticketBooked
    // etc — same columns the sales sheet's TicketDetailsCard and the list's
    // train/flight icon read), not inside the `requirements` JSON blob like
    // every other tab here. Kept as its own draft so this dialog can still
    // fill it in as part of the same wizard and commit it alongside
    // savePackageRequirements on one Save, without a second source of truth.
    const [ticketDraft, setTicketDraft] = useState<TicketDraft>(() => defaultTicketDraft(query));
    // Shows the inline error under Trip Type once the exec has actually
    // tried to move past it without picking one — not on first render, so
    // an untouched form doesn't open already flagged as invalid.
    const [tripTypeError, setTripTypeError] = useState(false);

    // Vehicle catalog for the Transport tab — fetched from `/dashboard/vehicles`
    // so the sales exec picks from what the fleet actually has, not a hardcoded list.
    const [vehicles, setVehicles] = useState<VehicleFull[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(true);

    // Inline input states (not stored in reqs until "Add" is clicked)
    const [destInput, setDestInput] = useState("");
    const [customActivityInput, setCustomActivityInput] = useState("");
    const [customMealInput, setCustomMealInput] = useState("");

    // Departure/Pickup points each toggle between a real-location picker and
    // a plain free-text fallback (e.g. "Mumbai Airport") that's stored as-is
    // and never written to the Location table — see the toggle buttons below.
    const [departureInput, setDepartureInput] = useState("");
    const [departureManual, setDepartureManual] = useState(false);
    const [pickupInput, setPickupInput] = useState("");
    const [pickupManual, setPickupManual] = useState(false);

    function update<K extends keyof PackageRequirements>(
        section: K,
        patch: Partial<PackageRequirements[K]>,
    ) {
        setReqs(prev => ({
            ...prev,
            [section]: { ...prev[section], ...patch },
        }));
    }

    /** Updates adult/child/infant counts and keeps the name/age list in sync. */
    function updateTravellerCounts(patch: Partial<Pick<PackageRequirements["travellers"], "adults" | "children" | "infants">>) {
        setReqs(prev => {
            const travellers = { ...prev.travellers, ...patch };
            const members = rebuildMembers(
                prev.travellers.members ?? [],
                travellers.adults, travellers.children, travellers.infants,
            );
            return { ...prev, travellers: { ...travellers, members } };
        });
    }

    function addDestination() {
        const val = destInput.trim();
        if (!val || reqs.journey.destinations.includes(val)) return;
        update("journey", { destinations: [...reqs.journey.destinations, val] });
        setDestInput("");
    }

    function removeDestination(i: number) {
        update("journey", { destinations: reqs.journey.destinations.filter((_, idx) => idx !== i) });
    }

    /** `directValue` comes from picking a real location (auto-adds on
     * selection); with no argument, falls back to the manual-mode text
     * input, which requires an explicit Enter/+ to add. */
    function addDeparturePoint(directValue?: string) {
        const val = (directValue ?? departureInput).trim();
        if (!val || reqs.journey.departurePoints.includes(val)) return;
        update("journey", { departurePoints: [...reqs.journey.departurePoints, val] });
        setDepartureInput("");
    }

    function removeDeparturePoint(i: number) {
        update("journey", { departurePoints: reqs.journey.departurePoints.filter((_, idx) => idx !== i) });
    }

    function addPickupPoint(directValue?: string) {
        const val = (directValue ?? pickupInput).trim();
        if (!val || reqs.journey.pickupPoints.includes(val)) return;
        update("journey", { pickupPoints: [...reqs.journey.pickupPoints, val] });
        setPickupInput("");
    }

    function removePickupPoint(i: number) {
        update("journey", { pickupPoints: reqs.journey.pickupPoints.filter((_, idx) => idx !== i) });
    }

    function addCustomActivity() {
        const val = customActivityInput.trim();
        if (!val) return;
        update("activities", { custom: [...reqs.activities.custom, val] });
        setCustomActivityInput("");
    }

    function removeCustomActivity(i: number) {
        update("activities", { custom: reqs.activities.custom.filter((_, idx) => idx !== i) });
    }

    useEffect(() => {
        if (!open || vehicles.length > 0) return;
        getVehiclesWithRates()
            .then(setVehicles)
            .finally(() => setLoadingVehicles(false));
    }, [open, vehicles.length]);

    function goToTab(id: TabId) {
        setActiveTab(id);
    }

    /** Trip Type is the one required field in this form — checked here
     * rather than blocking every tab, since Save can be triggered from any
     * of them (the "Save" button next to Next) and Next only guards the one
     * tab it actually gates. */
    function validateRequired(): boolean {
        if (!reqs.travellers.tripType) {
            setTripTypeError(true);
            setActiveTab("travellers");
            toast.error("Trip type is required before saving");
            return false;
        }
        return true;
    }

    function nextTab() {
        const idx = TABS.findIndex(t => t.id === activeTab);
        if (activeTab === "travellers" && !validateRequired()) return;
        if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
    }

    function prevTab() {
        const idx = TABS.findIndex(t => t.id === activeTab);
        if (idx > 0) setActiveTab(TABS[idx - 1].id);
    }

    function handleSave() {
        if (!validateRequired()) return;
        startTransition(async () => {
            const [reqResult, ticketResult] = await Promise.all([
                savePackageRequirements(query.id, reqs),
                updateTicketDetails(query.id, {
                    ticketBooked: ticketDraft.ticketBooked,
                    ticketType: ticketDraft.ticketBooked ? (ticketDraft.ticketType as "TRAIN" | "FLIGHT") : null,
                    ticketFrom: ticketDraft.ticketBooked ? (ticketDraft.ticketFrom || null) : null,
                    ticketTo: ticketDraft.ticketBooked ? (ticketDraft.ticketTo || null) : null,
                    ticketDateTime: ticketDraft.ticketBooked && ticketDraft.ticketDateTimeValue
                        ? new Date(ticketDraft.ticketDateTimeValue).toISOString()
                        : null,
                }),
            ]);
            if (reqResult.success && ticketResult.success) {
                toast.success(reqResult.message);
                setOpen(false);
                onDone?.();
            } else {
                toast.error(!reqResult.success ? reqResult.message : "Failed to save ticket details");
            }
        });
    }

    const activeTabIdx = TABS.findIndex(t => t.id === activeTab);
    const isLastTab = activeTabIdx === TABS.length - 1;
    const totalPax = reqs.travellers.adults + reqs.travellers.children + reqs.travellers.infants;

    // Whether each step already has something filled in — drives the check
    // mark in the left-hand step list so an exec can see what's left at a
    // glance instead of clicking through every tab.
    const sectionFilled: Record<TabId, boolean> = {
        travellers: Boolean(reqs.travellers.tripType) || (reqs.travellers.members ?? []).some(m => m.name.trim().length > 0),
        journey: reqs.journey.departurePoints.length > 0 || reqs.journey.destinations.length > 0 || Boolean(reqs.journey.travelDate),
        booking: ticketDraft.ticketBooked,
        stay: reqs.stay.types.length > 0 || reqs.stay.mealTypes.length > 0 || Boolean(reqs.stay.customMeal),
        transport: reqs.transport.required === false || reqs.transport.cabTypes.length > 0 || reqs.transport.includeFlights || reqs.transport.includeTrain,
        activities: reqs.activities.selected.length > 0 || reqs.activities.custom.length > 0,
        budget: Boolean(reqs.budget.min) || Boolean(reqs.budget.max),
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (v) {
                    setReqs(normalizeRequirements(initialRequirements ?? defaultRequirements(query), defaultRequirements(query)));
                    setTicketDraft(defaultTicketDraft(query));
                    setActiveTab("travellers");
                }
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-310! w-[95vw] h-[88vh] p-0 flex flex-col gap-0 overflow-hidden">

                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-dashboard-base-300 bg-dashboard-base-100 shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <DialogTitle className="text-base">Package Requirements</DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">
                                {query.name} · {query.phone}
                                {query.destination && ` · ${query.destination}`}
                            </DialogDescription>
                        </div>
                        {totalPax > 0 && (
                            <Badge variant="secondary" className="shrink-0 text-xs bg-dashboard-primary/15 text-dashboard-primary font-medium">
                                <Users className="h-3 w-3 mr-1" />
                                {totalPax} Pax
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                {/* Body: step list on the left, active step's form on the right */}
                <div className="flex flex-1 min-h-0">

                    {/* Left: step navigation — each row carries its own accent
                        color (matching the icon in its content header), and
                        fills solid green with a check once that section has
                        something in it, so an exec can see what's left
                        without clicking through every tab. */}
                    <div className="w-64 shrink-0 border-r border-dashboard-base-300 bg-dashboard-base-200/40 overflow-y-auto scrollbar-none py-3 px-2.5 space-y-1">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const isFilled = sectionFilled[tab.id];
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => goToTab(tab.id)}
                                    className={[
                                        "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-all cursor-pointer",
                                        isActive
                                            ? `${tab.bgLight} ring-1 ${tab.ring}`
                                            : "hover:bg-dashboard-base-200/60",
                                    ].join(" ")}
                                >
                                    <span className={[
                                        "flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-colors",
                                        isFilled
                                            ? "bg-dashboard-success text-dashboard-success-content"
                                            : isActive
                                                ? `${tab.bg} ${tab.content}`
                                                : `${tab.bgLight} ${tab.color}`,
                                    ].join(" ")}>
                                        {isFilled ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <p className={[
                                            "text-sm font-medium leading-tight truncate",
                                            isActive ? tab.color : "text-dashboard-base-content",
                                        ].join(" ")}>
                                            {tab.label}
                                        </p>
                                        <p className="text-[11px] text-dashboard-base-content/60 leading-tight truncate mt-0.5">
                                            {tab.desc}
                                        </p>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right: header meta + the active step's form */}
                    <div className="flex-1 min-w-0 min-h-0 flex flex-col">

                {/* Scrollable content */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-8 py-6 max-w-2xl">

                        {/* ── 1. TRAVELLERS ──────────────────────────────────── */}
                        {activeTab === "travellers" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Users}
                                    title="Traveller Details"
                                    color="text-dashboard-primary"
                                    bg="bg-dashboard-primary/12"
                                    subtitle="Who's coming on this trip?"
                                />

                                <div className="space-y-1.5">
                                    <Label htmlFor="leadName">Lead / Primary Traveller Name</Label>
                                    <Input
                                        id="leadName"
                                        value={reqs.travellers.leadName}
                                        onChange={e => update("travellers", { leadName: capitalizeWords(e.target.value) })}
                                        placeholder="Full name of primary traveller"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="tripType" className="flex items-center gap-1.5">
                                        <Heart className="h-3 w-3" /> Trip Type / Purpose of Travel
                                        <span className="text-dashboard-error">*</span>
                                    </Label>
                                    <Select
                                        value={reqs.travellers.tripType || undefined}
                                        onValueChange={v => {
                                            setTripTypeError(false);
                                            update("travellers", {
                                                tripType: v,
                                                ...(v !== "OTHER" ? { tripTypeCustom: "" } : {}),
                                            });
                                        }}
                                    >
                                        <SelectTrigger
                                            id="tripType"
                                            className={tripTypeError && !reqs.travellers.tripType
                                                ? "w-full border-dashboard-error ring-1 ring-dashboard-error/30"
                                                : "w-full"}
                                        >
                                            <SelectValue placeholder="Select the purpose of this trip" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRIP_TYPES.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {tripTypeError && !reqs.travellers.tripType && (
                                        <p className="text-xs text-dashboard-error flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> Trip type is required
                                        </p>
                                    )}
                                    {reqs.travellers.tripType === "OTHER" && (
                                        <Input
                                            value={reqs.travellers.tripTypeCustom ?? ""}
                                            onChange={e => update("travellers", { tripTypeCustom: e.target.value })}
                                            placeholder="Describe the trip purpose"
                                            className="mt-1.5"
                                            autoFocus
                                        />
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="adults">
                                            Adults
                                            <span className="text-dashboard-base-content/60 text-[10px] ml-1">12+ yrs</span>
                                        </Label>
                                        <NumberField
                                            id="adults"
                                            min={1}
                                            value={reqs.travellers.adults}
                                            onCommit={n => updateTravellerCounts({ adults: n })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="children">
                                            Children
                                            <span className="text-dashboard-base-content/60 text-[10px] ml-1">2–12 yrs</span>
                                        </Label>
                                        <NumberField
                                            id="children"
                                            min={0}
                                            value={reqs.travellers.children}
                                            onCommit={n => updateTravellerCounts({ children: n })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="infants">
                                            Infants
                                            <span className="text-dashboard-base-content/60 text-[10px] ml-1">&lt;2 yrs</span>
                                        </Label>
                                        <NumberField
                                            id="infants"
                                            min={0}
                                            value={reqs.travellers.infants}
                                            onCommit={n => updateTravellerCounts({ infants: n })}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-lg bg-dashboard-primary/8 border border-dashboard-primary/20 px-3 py-2.5">
                                    <p className="text-xs text-dashboard-primary">
                                        Total Pax:{" "}
                                        <span className="font-semibold text-sm">
                                            {totalPax}
                                        </span>
                                        <span className="text-dashboard-primary/70 ml-1.5">
                                            ({reqs.travellers.adults}A
                                            {reqs.travellers.children > 0 && ` + ${reqs.travellers.children}C`}
                                            {reqs.travellers.infants > 0 && ` + ${reqs.travellers.infants}I`})
                                        </span>
                                    </p>
                                </div>

                                {(reqs.travellers.members ?? []).length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <Label>Traveller Names &amp; Ages</Label>
                                        <div className="space-y-2">
                                            {(reqs.travellers.members ?? []).map((m, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className="w-16 justify-center shrink-0 text-[10px] font-normal"
                                                    >
                                                        {m.type === "ADULT" ? "Adult" : m.type === "CHILD" ? "Child" : "Infant"}
                                                    </Badge>
                                                    <Input
                                                        value={m.name}
                                                        onChange={e => {
                                                            const members = [...(reqs.travellers.members ?? [])];
                                                            members[i] = { ...members[i], name: capitalizeWords(e.target.value) };
                                                            update("travellers", { members });
                                                        }}
                                                        placeholder={`Traveller ${i + 1} name`}
                                                        className="flex-1"
                                                    />
                                                    <NumberField
                                                        min={0}
                                                        max={120}
                                                        value={m.age}
                                                        onCommit={n => {
                                                            const members = [...(reqs.travellers.members ?? [])];
                                                            members[i] = { ...members[i], age: n };
                                                            update("travellers", { members });
                                                        }}
                                                        placeholder="Age"
                                                        className="w-20 shrink-0"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <SpecialDemands
                                    value={reqs.travellers.specialDemands ?? ""}
                                    onChange={v => update("travellers", { specialDemands: v })}
                                />
                            </div>
                        )}

                        {/* ── 2. JOURNEY ─────────────────────────────────────── */}
                        {activeTab === "journey" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={MapPin}
                                    title="Journey Details"
                                    color="text-dashboard-success"
                                    bg="bg-dashboard-success/12"
                                    subtitle="Where are they going and when?"
                                />

                                <div className="space-y-1.5">
                                    <Label>
                                        Departure Point(s)
                                        <span className="text-dashboard-base-content/60 text-xs font-normal ml-1.5">the city/cities they're travelling from — add one or more</span>
                                    </Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            {departureManual ? (
                                                <Input
                                                    value={departureInput}
                                                    onChange={e => setDepartureInput(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") { e.preventDefault(); addDeparturePoint(); }
                                                    }}
                                                    placeholder='Type manually, e.g. "Mumbai"'
                                                />
                                            ) : (
                                                <LocationSearchSelect
                                                    value={null}
                                                    onChange={(loc: LocationValue | null) => { if (loc) addDeparturePoint(loc.name); }}
                                                    types={ROUTE_STOP_TYPES}
                                                    disableExternalSearch
                                                    placeholder="Search a location…"
                                                />
                                            )}
                                        </div>
                                        <Button
                                            type="button" variant="outline" size="icon" className="shrink-0"
                                            title={departureManual ? "Choose from locations" : "Can't find it? Type it instead"}
                                            onClick={() => setDepartureManual(v => !v)}
                                        >
                                            {departureManual ? <MapPin className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                                        </Button>
                                        {departureManual && (
                                            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => addDeparturePoint()}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {reqs.journey.departurePoints.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {reqs.journey.departurePoints.map((p, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
                                                    <MapPin className="h-2.5 w-2.5 text-dashboard-success" />
                                                    {p}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDeparturePoint(i)}
                                                        className="ml-0.5 rounded-full hover:text-dashboard-error transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label>
                                        Pickup Point(s)
                                        <span className="text-dashboard-base-content/60 text-xs font-normal ml-1.5">specific pickup spot — airport, hotel, landmark</span>
                                    </Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            {pickupManual ? (
                                                <Input
                                                    value={pickupInput}
                                                    onChange={e => setPickupInput(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") { e.preventDefault(); addPickupPoint(); }
                                                    }}
                                                    placeholder='Type manually, e.g. "Mumbai Airport"'
                                                />
                                            ) : (
                                                <LocationSearchSelect
                                                    value={null}
                                                    onChange={(loc: LocationValue | null) => { if (loc) addPickupPoint(loc.name); }}
                                                    types={TRANSFER_TYPES}
                                                    disableExternalSearch
                                                    placeholder="Search a location…"
                                                />
                                            )}
                                        </div>
                                        <Button
                                            type="button" variant="outline" size="icon" className="shrink-0"
                                            title={pickupManual ? "Choose from locations" : "Can't find it? Type it instead"}
                                            onClick={() => setPickupManual(v => !v)}
                                        >
                                            {pickupManual ? <MapPin className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                                        </Button>
                                        {pickupManual && (
                                            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => addPickupPoint()}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {reqs.journey.pickupPoints.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {reqs.journey.pickupPoints.map((p, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
                                                    <MapPin className="h-2.5 w-2.5 text-dashboard-success" />
                                                    {p}
                                                    <button
                                                        type="button"
                                                        onClick={() => removePickupPoint(i)}
                                                        className="ml-0.5 rounded-full hover:text-dashboard-error transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Travel Date Type</Label>
                                    <div className="flex gap-2">
                                        <ToggleButton
                                            selected={reqs.journey.dateType === "FIXED"}
                                            onClick={() => update("journey", { dateType: "FIXED" })}
                                        >
                                            Fixed Date
                                        </ToggleButton>
                                        <ToggleButton
                                            selected={reqs.journey.dateType === "FLEXIBLE"}
                                            onClick={() => update("journey", { dateType: "FLEXIBLE" })}
                                        >
                                            Flexible
                                        </ToggleButton>
                                    </div>
                                </div>

                                {reqs.journey.dateType === "FIXED" ? (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="travelDate">Travel Date</Label>
                                        <Input
                                            id="travelDate"
                                            type="date"
                                            value={reqs.journey.travelDate ?? ""}
                                            min={new Date().toISOString().split("T")[0]}
                                            onChange={e => update("journey", { travelDate: e.target.value })}
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="flexFrom">Flexible From</Label>
                                            <Input
                                                id="flexFrom"
                                                type="date"
                                                value={reqs.journey.flexibleFrom ?? ""}
                                                min={new Date().toISOString().split("T")[0]}
                                                onChange={e => update("journey", { flexibleFrom: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="flexTo">Flexible To</Label>
                                            <Input
                                                id="flexTo"
                                                type="date"
                                                value={reqs.journey.flexibleTo ?? ""}
                                                min={reqs.journey.flexibleFrom || new Date().toISOString().split("T")[0]}
                                                onChange={e => update("journey", { flexibleTo: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="days">Number of Days</Label>
                                        <NumberField
                                            id="days"
                                            min={1}
                                            value={reqs.journey.noOfDays}
                                            onCommit={n => update("journey", { noOfDays: n })}
                                            onBlurCommit={n => update("journey", {
                                                noOfDays: n,
                                                noOfNights: Math.max(0, n - 1),
                                            })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="nights">Number of Nights</Label>
                                        <NumberField
                                            id="nights"
                                            min={0}
                                            value={reqs.journey.noOfNights}
                                            onCommit={n => update("journey", { noOfNights: n })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Destinations</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={destInput}
                                            onChange={e => setDestInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") { e.preventDefault(); addDestination(); }
                                            }}
                                            placeholder="Type and press Enter to add..."
                                        />
                                        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={addDestination}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {reqs.journey.destinations.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {reqs.journey.destinations.map((d, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
                                                    <MapPin className="h-2.5 w-2.5 text-dashboard-success" />
                                                    {d}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDestination(i)}
                                                        className="ml-0.5 rounded-full hover:text-dashboard-error transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <SpecialDemands
                                    value={reqs.journey.specialDemands ?? ""}
                                    onChange={v => update("journey", { specialDemands: v })}
                                />
                            </div>
                        )}

                        {/* ── 2b. TICKET BOOKING ──────────────────────────────── */}
                        {activeTab === "booking" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Ticket}
                                    title="Ticket Booking"
                                    color="text-dashboard-info"
                                    bg="bg-dashboard-info/12"
                                    subtitle="Has the client already booked their own travel ticket?"
                                />

                                <div className="flex items-center justify-between rounded-xl border border-dashboard-base-300 bg-dashboard-base-200/20 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium">Ticket confirmed</p>
                                        <p className="text-xs text-dashboard-base-content/60 mt-0.5">
                                            Toggle on once the client shares their booking
                                        </p>
                                    </div>
                                    <Switch
                                        checked={ticketDraft.ticketBooked}
                                        onCheckedChange={v => setTicketDraft(d => ({ ...d, ticketBooked: v }))}
                                    />
                                </div>

                                {ticketDraft.ticketBooked ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Ticket Type</Label>
                                            <div className="flex gap-2">
                                                {TICKET_TYPES.map(t => (
                                                    <button
                                                        key={t.value}
                                                        type="button"
                                                        onClick={() => setTicketDraft(d => ({ ...d, ticketType: t.value }))}
                                                        className={[
                                                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all",
                                                            ticketDraft.ticketType === t.value
                                                                ? "bg-dashboard-info text-dashboard-info-content border-dashboard-info shadow-sm"
                                                                : "bg-dashboard-base-100 text-dashboard-base-content/60 border-dashboard-base-300 hover:border-dashboard-info/60 hover:text-dashboard-base-content",
                                                        ].join(" ")}
                                                    >
                                                        <t.icon className="h-4 w-4" /> {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="ticketFrom">From</Label>
                                                <Input
                                                    id="ticketFrom"
                                                    value={ticketDraft.ticketFrom}
                                                    onChange={e => setTicketDraft(d => ({ ...d, ticketFrom: e.target.value }))}
                                                    placeholder="e.g. Delhi"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="ticketTo">To</Label>
                                                <Input
                                                    id="ticketTo"
                                                    value={ticketDraft.ticketTo}
                                                    onChange={e => setTicketDraft(d => ({ ...d, ticketTo: e.target.value }))}
                                                    placeholder="e.g. Srinagar"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="ticketDateTime" className="flex items-center gap-1.5">
                                                <CalendarDays className="h-3 w-3" /> Departure Date &amp; Time
                                            </Label>
                                            <Input
                                                id="ticketDateTime"
                                                type="datetime-local"
                                                value={ticketDraft.ticketDateTimeValue}
                                                onChange={e => setTicketDraft(d => ({ ...d, ticketDateTimeValue: e.target.value }))}
                                            />
                                        </div>

                                        {(ticketDraft.ticketFrom || ticketDraft.ticketTo) && (
                                            <div className="rounded-lg bg-dashboard-info/8 border border-dashboard-info/20 px-3 py-2.5">
                                                <p className="text-xs text-dashboard-info flex items-center gap-1.5">
                                                    {ticketDraft.ticketType === "FLIGHT"
                                                        ? <Plane className="h-3.5 w-3.5" />
                                                        : <TrainFront className="h-3.5 w-3.5" />}
                                                    <span className="font-medium">{ticketDraft.ticketFrom || "—"} → {ticketDraft.ticketTo || "—"}</span>
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="rounded-lg bg-dashboard-base-200/50 border border-dashboard-base-300 px-3 py-2.5">
                                        <p className="text-xs text-dashboard-base-content/60">
                                            No ticket booked yet — the assigned exec can fill this in once the client shares it.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── 3. STAY ─────────────────────────────────────────── */}
                        {activeTab === "stay" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Hotel}
                                    title="Stay & Accommodation"
                                    color="text-dashboard-secondary"
                                    bg="bg-dashboard-secondary/12"
                                    subtitle="What kind of accommodation do they prefer?"
                                />

                                <div className="space-y-2">
                                    <Label>
                                        Stay Type
                                        <span className="text-dashboard-base-content/60 text-xs font-normal ml-1.5">select all that apply</span>
                                    </Label>
                                    <MultiToggle
                                        options={STAY_TYPES}
                                        selected={reqs.stay.types}
                                        onChange={v => update("stay", { types: v })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        Meal Preference
                                        <span className="text-dashboard-base-content/60 text-xs font-normal ml-1.5">select all that apply</span>
                                    </Label>
                                    <MultiToggle
                                        options={MEAL_TYPES}
                                        selected={reqs.stay.mealTypes}
                                        onChange={v => update("stay", { mealTypes: v })}
                                    />

                                    {/* Custom meal */}
                                    <div className="flex gap-2 pt-1">
                                        <Input
                                            value={customMealInput}
                                            onChange={e => setCustomMealInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const val = customMealInput.trim();
                                                    if (val) {
                                                        update("stay", { customMeal: val });
                                                        setCustomMealInput("");
                                                    }
                                                }
                                            }}
                                            placeholder="Add custom meal preference (e.g. South Indian only)..."
                                            className="text-sm"
                                        />
                                        <Button
                                            type="button" variant="outline" size="sm"
                                            onClick={() => {
                                                const val = customMealInput.trim();
                                                if (val) {
                                                    update("stay", { customMeal: val });
                                                    setCustomMealInput("");
                                                }
                                            }}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                    {reqs.stay.customMeal && (
                                        <Badge variant="secondary" className="gap-1.5 pr-1 text-xs">
                                            🍽️ {reqs.stay.customMeal}
                                            <button
                                                type="button"
                                                onClick={() => update("stay", { customMeal: "" })}
                                                className="hover:text-dashboard-error"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    )}
                                </div>

                                <SpecialDemands
                                    value={reqs.stay.specialDemands ?? ""}
                                    onChange={v => update("stay", { specialDemands: v })}
                                />
                            </div>
                        )}

                        {/* ── 4. TRANSPORT ────────────────────────────────────── */}
                        {activeTab === "transport" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Car}
                                    title="Transport"
                                    color="text-dashboard-warning"
                                    bg="bg-dashboard-warning/12"
                                    subtitle="How are they getting around?"
                                />

                                <div className="space-y-2">
                                    <Label>Transport Required?</Label>
                                    <div className="flex gap-2">
                                        <ToggleButton
                                            selected={reqs.transport.required === true}
                                            onClick={() => update("transport", { required: true })}
                                        >
                                            Yes, Include Transport
                                        </ToggleButton>
                                        <ToggleButton
                                            selected={reqs.transport.required === false}
                                            onClick={() => update("transport", { required: false })}
                                        >
                                            Not Required
                                        </ToggleButton>
                                    </div>
                                </div>

                                {reqs.transport.required && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>
                                                Vehicle Type
                                                <span className="text-dashboard-base-content/60 text-xs font-normal ml-1.5">from the fleet — select all that apply</span>
                                            </Label>
                                            {loadingVehicles ? (
                                                <div className="flex items-center gap-2 text-xs text-dashboard-base-content/60 py-2">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading vehicle types…
                                                </div>
                                            ) : (
                                                (() => {
                                                    // Group active vehicles by type — one chip per type, not per vehicle,
                                                    // with the largest capacity in that type as a helpful hint.
                                                    const maxCapacityByType = new Map<string, number>();
                                                    for (const v of vehicles) {
                                                        if (!v.is_active) continue;
                                                        maxCapacityByType.set(v.type, Math.max(maxCapacityByType.get(v.type) ?? 0, v.passenger_capacity));
                                                    }
                                                    const typeOptions = Array.from(maxCapacityByType.entries()).map(([type, maxSeats]) => ({
                                                        value: type,
                                                        label: `${VEHICLE_TYPE_LABELS[type] ?? type} · up to ${maxSeats} seats`,
                                                    }));
                                                    // Legacy selections saved before this list came from `/dashboard/vehicles` —
                                                    // keep them visible (as a readable label) instead of losing the selection.
                                                    const legacyOptions = reqs.transport.cabTypes
                                                        .filter(v => !maxCapacityByType.has(v))
                                                        .map(v => ({ value: v, label: LEGACY_CAB_LABELS[v] ?? v }));

                                                    return (
                                                        <MultiToggle
                                                            options={[...typeOptions, ...legacyOptions]}
                                                            selected={reqs.transport.cabTypes}
                                                            onChange={v => update("transport", { cabTypes: v })}
                                                        />
                                                    );
                                                })()
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Flights</Label>
                                            <div className="flex gap-2">
                                                <ToggleButton
                                                    selected={reqs.transport.includeFlights === false}
                                                    onClick={() => update("transport", { includeFlights: false })}
                                                >
                                                    No Flights
                                                </ToggleButton>
                                                <ToggleButton
                                                    selected={reqs.transport.includeFlights === true}
                                                    onClick={() => update("transport", { includeFlights: true })}
                                                >
                                                    Include Flights
                                                </ToggleButton>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Train Ticket</Label>
                                            <div className="flex gap-2">
                                                <ToggleButton
                                                    selected={reqs.transport.includeTrain === false}
                                                    onClick={() => update("transport", { includeTrain: false })}
                                                >
                                                    No Train
                                                </ToggleButton>
                                                <ToggleButton
                                                    selected={reqs.transport.includeTrain === true}
                                                    onClick={() => update("transport", { includeTrain: true })}
                                                >
                                                    Train Ticket Required
                                                </ToggleButton>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {!reqs.transport.required && (
                                    <div className="rounded-lg bg-dashboard-base-200/50 border border-dashboard-base-300 px-3 py-2.5">
                                        <p className="text-xs text-dashboard-base-content/60">
                                            No transport will be included in the package. Customer arranges their own travel.
                                        </p>
                                    </div>
                                )}

                                <SpecialDemands
                                    value={reqs.transport.specialDemands ?? ""}
                                    onChange={v => update("transport", { specialDemands: v })}
                                />
                            </div>
                        )}

                        {/* ── 5. ACTIVITIES ───────────────────────────────────── */}
                        {activeTab === "activities" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Zap}
                                    title="Activities & Experiences"
                                    color="text-dashboard-accent"
                                    bg="bg-dashboard-accent/12"
                                    subtitle="What experiences does the customer want?"
                                />

                                <div className="space-y-2">
                                    <Label>
                                        Select Activities
                                        <span className="text-dashboard-base-content/60 text-xs font-normal ml-1.5">tap to select</span>
                                    </Label>
                                    <MultiToggle
                                        options={PRESET_ACTIVITIES}
                                        selected={reqs.activities.selected}
                                        onChange={v => update("activities", { selected: v })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        Custom Activities
                                        <span className="text-dashboard-base-content/60 text-xs font-normal ml-1.5">not in the list above</span>
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={customActivityInput}
                                            onChange={e => setCustomActivityInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") { e.preventDefault(); addCustomActivity(); }
                                            }}
                                            placeholder="e.g. Yak riding in Ladakh, Spiti Valley tour..."
                                            className="text-sm"
                                        />
                                        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={addCustomActivity}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {reqs.activities.custom.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {reqs.activities.custom.map((a, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
                                                    <Zap className="h-2.5 w-2.5 text-dashboard-accent" />
                                                    {a}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCustomActivity(i)}
                                                        className="hover:text-dashboard-error transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {(reqs.activities.selected.length > 0 || reqs.activities.custom.length > 0) && (
                                    <div className="rounded-lg bg-dashboard-accent/8 border border-dashboard-accent/30 px-3 py-2">
                                        <p className="text-xs text-dashboard-accent font-medium">
                                            {reqs.activities.selected.length + reqs.activities.custom.length} activities selected
                                        </p>
                                    </div>
                                )}

                                <SpecialDemands
                                    value={reqs.activities.specialDemands ?? ""}
                                    onChange={v => update("activities", { specialDemands: v })}
                                />
                            </div>
                        )}

                        {/* ── 6. BUDGET ────────────────────────────────────────── */}
                        {activeTab === "budget" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Wallet}
                                    title="Budget"
                                    color="text-dashboard-error"
                                    bg="bg-dashboard-error/12"
                                    subtitle="What is the customer's budget range?"
                                />

                                <div className="space-y-2">
                                    <Label>Budget Type</Label>
                                    <div className="flex gap-2">
                                        <ToggleButton
                                            selected={reqs.budget.type === "PER_PERSON"}
                                            onClick={() => update("budget", { type: "PER_PERSON" })}
                                        >
                                            Per Person
                                        </ToggleButton>
                                        <ToggleButton
                                            selected={reqs.budget.type === "TOTAL"}
                                            onClick={() => update("budget", { type: "TOTAL" })}
                                        >
                                            Total Budget
                                        </ToggleButton>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="budgetMin">
                                            Minimum (₹)
                                        </Label>
                                        <Input
                                            id="budgetMin"
                                            type="number"
                                            min={0}
                                            step={500}
                                            placeholder="e.g. 15000"
                                            value={reqs.budget.min ?? ""}
                                            onFocus={e => e.target.select()}
                                            onWheel={e => e.currentTarget.blur()}
                                            onChange={e => update("budget", {
                                                min: e.target.value ? parseInt(e.target.value) : undefined,
                                            })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="budgetMax">
                                            Maximum (₹)
                                        </Label>
                                        <Input
                                            id="budgetMax"
                                            type="number"
                                            min={0}
                                            step={500}
                                            placeholder="e.g. 25000"
                                            value={reqs.budget.max ?? ""}
                                            onFocus={e => e.target.select()}
                                            onWheel={e => e.currentTarget.blur()}
                                            onChange={e => update("budget", {
                                                max: e.target.value ? parseInt(e.target.value) : undefined,
                                            })}
                                        />
                                    </div>
                                </div>

                                {(reqs.budget.min || reqs.budget.max) && (
                                    <div className="rounded-lg bg-dashboard-primary/15 border border-dashboard-primary/20 px-4 py-3">
                                        <p className="text-xs text-dashboard-primary mb-0.5">Budget Range</p>
                                        <p className="text-lg font-semibold text-dashboard-primary">
                                            {reqs.budget.min ? `₹${reqs.budget.min.toLocaleString("en-IN")}` : null}
                                            {reqs.budget.min && reqs.budget.max ? " — " : null}
                                            {reqs.budget.max ? `₹${reqs.budget.max.toLocaleString("en-IN")}` : null}
                                        </p>
                                        <p className="text-xs text-dashboard-primary mt-0.5">
                                            {reqs.budget.type === "PER_PERSON" ? "per person" : "total for the group"}
                                            {reqs.budget.type === "PER_PERSON" && totalPax > 0 && (
                                                <span className="ml-1">
                                                    (≈ {reqs.budget.min ? `₹${(reqs.budget.min * totalPax).toLocaleString("en-IN")}` : null}
                                                    {reqs.budget.min && reqs.budget.max ? " — " : null}
                                                    {reqs.budget.max ? `₹${(reqs.budget.max * totalPax).toLocaleString("en-IN")}` : null} total)
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                )}

                                <SpecialDemands
                                    value={reqs.budget.specialDemands ?? ""}
                                    onChange={v => update("budget", { specialDemands: v })}
                                />
                            </div>
                        )}

                    </div>
                </ScrollArea>

                {/* Footer — step position + prev/next + save. The step list on
                    the left already shows overall progress, so this only needs
                    to say where we are, not repeat it as dots. */}
                <div className="px-8 py-4 border-t border-dashboard-base-300 bg-dashboard-base-200/60 shrink-0 flex items-center justify-between gap-3">
                    <p className="text-xs text-dashboard-base-content/60">
                        Step {activeTabIdx + 1} of {TABS.length} · <span className="font-medium text-dashboard-base-content">{TABS[activeTabIdx].label}</span>
                    </p>

                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                            className="border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200 hover:text-dashboard-base-content"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={prevTab}
                            disabled={activeTabIdx === 0}
                            className="gap-1 border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200 hover:text-dashboard-base-content disabled:opacity-40"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Back
                        </Button>
                        {!isLastTab ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={nextTab}
                                className="gap-1 bg-dashboard-primary hover:bg-dashboard-primary/90 text-dashboard-primary-content cursor-pointer"
                            >
                                Next
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSave}
                                disabled={isPending}
                                className="gap-1.5 bg-dashboard-primary hover:bg-dashboard-primary/90 text-dashboard-primary-content rounded-md cursor-pointer"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isPending ? "Saving..." : "Save Requirements"}
                            </Button>
                        )}
                        {/* Allow save from any tab */}
                        {!isLastTab && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSave}
                                disabled={isPending}
                                className="gap-1.5 bg-dashboard-success hover:bg-dashboard-success/90 text-dashboard-success-content cursor-pointer"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isPending ? "Saving..." : "Save"}
                            </Button>
                        )}
                    </div>
                </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}