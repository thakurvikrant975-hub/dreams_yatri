"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { ScrollArea } from "../../components/ui/scroll-area";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import {
    Users, MapPin, Hotel, Car, Zap, Wallet,
    Plus, X, AlertCircle, ChevronRight, ChevronLeft,
    CheckCircle2, CalendarDays,
} from "lucide-react";
import { savePackageRequirements } from "./actions";
import type { PackageQueryType, PackageRequirements } from "../../(marketing)/queries/actions";
import { number } from "zod";

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

const CAB_TYPES = [
    { value: "SEDAN", label: "Sedan" },
    { value: "SUV", label: "SUV" },
    { value: "BOLERO", label: "Bolero" },
    { value: "INNOVA", label: "Innova/Crysta" },
    { value: "TEMPO", label: "Tempo Traveller" },
    { value: "VOLVO", label: "Volvo Bus" },
    { value: "MINI_BUS", label: "Mini Bus" },
    { value: "BIKE", label: "Bike Rental" },
];

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

const TABS = [
    { id: "travellers", label: "Travellers", icon: Users, color: "text-violet-600" },
    { id: "journey", label: "Journey", icon: MapPin, color: "text-green-600" },
    { id: "stay", label: "Stay", icon: Hotel, color: "text-purple-600" },
    { id: "transport", label: "Transport", icon: Car, color: "text-orange-600" },
    { id: "activities", label: "Activities", icon: Zap, color: "text-yellow-600" },
    { id: "budget", label: "Budget", icon: Wallet, color: "text-red-600" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultRequirements(query: PackageQueryType): PackageRequirements {
    return {
        travellers: {
            leadName: query.name,
            adults: query.groupSize ?? 1,
            children: 0,
            infants: 0,
            specialDemands: "",
        },
        journey: {
            startingPoint: "",
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
                    ? "bg-violet-100 text-violet-600 border-violet-600 shadow-sm"
                    : "bg-background text-foreground border-border hover:border-primary/60 hover:bg-primary/5",
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
        <div className="space-y-1.5 pt-4 mt-2 border-t border-dashed border-border/60">
            <Label className="text-xs text-gray-700 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Special Demands <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="Any special requirements for this section..."
                rows={2}
                className="resize-none text-sm bg-gray-50/30 border-gray-200 focus-visible:ring-gray-300/50 placeholder:text-gray-400/70"
            />
        </div>
    );
}

function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    color,
}: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    color: string;
}) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Icon className={`h-4.5 w-4.5 ${color}`} />
            </div>
            <div>
                <h3 className="font-semibold text-base leading-tight">{title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
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
                "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all",
                selected
                    ? "bg-violet-400 text-primary-foreground border-violet-400 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
            ].join(" ")}
        >
            {children}
        </button>
    );
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
        initialRequirements ?? defaultRequirements(query),
    );

    // Inline input states (not stored in reqs until "Add" is clicked)
    const [destInput, setDestInput] = useState("");
    const [customActivityInput, setCustomActivityInput] = useState("");
    const [customMealInput, setCustomMealInput] = useState("");

    function update<K extends keyof PackageRequirements>(
        section: K,
        patch: Partial<PackageRequirements[K]>,
    ) {
        setReqs(prev => ({
            ...prev,
            [section]: { ...prev[section], ...patch },
        }));
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

    function addCustomActivity() {
        const val = customActivityInput.trim();
        if (!val) return;
        update("activities", { custom: [...reqs.activities.custom, val] });
        setCustomActivityInput("");
    }

    function removeCustomActivity(i: number) {
        update("activities", { custom: reqs.activities.custom.filter((_, idx) => idx !== i) });
    }

    function goToTab(id: TabId) {
        setActiveTab(id);
    }

    function nextTab() {
        const idx = TABS.findIndex(t => t.id === activeTab);
        if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
    }

    function prevTab() {
        const idx = TABS.findIndex(t => t.id === activeTab);
        if (idx > 0) setActiveTab(TABS[idx - 1].id);
    }

    function handleSave() {
        startTransition(async () => {
            const result = await savePackageRequirements(query.id, reqs);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                onDone?.();
            } else {
                toast.error(result.message);
            }
        });
    }

    const activeTabIdx = TABS.findIndex(t => t.id === activeTab);
    const isLastTab = activeTabIdx === TABS.length - 1;
    const totalPax = reqs.travellers.adults + reqs.travellers.children + reqs.travellers.infants;

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (v) {
                    setReqs(initialRequirements ?? defaultRequirements(query));
                    setActiveTab("travellers");
                }
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-8xl h-[88vh] p-0 flex flex-col gap-0 overflow-y-auto scrollbar-none">

                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <DialogTitle className="text-base">Package Requirements</DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">
                                {query.name} · {query.phone}
                                {query.destination && ` · ${query.destination}`}
                            </DialogDescription>
                        </div>
                        {totalPax > 0 && (
                            <Badge variant="secondary" className="shrink-0 text-xs bg-violet-200 text-violet-600 font-medium">
                                <Users className="h-3 w-3 mr-1" />
                                {totalPax} Pax
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                {/* Tab bar */}
                <div className="flex border-b bg-muted/20 overflow-x-auto shrink-0 scrollbar-none">
                    {TABS.map((tab, i) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => goToTab(tab.id)}
                                className={[
                                    "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap",
                                    "border-b-2 transition-colors shrink-0 cursor-pointer ",
                                    isActive
                                        ? `border-violet-500 text-violet-500 bg-violet-50`
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                                ].join(" ")}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{i + 1}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Scrollable content */}
                <ScrollArea className="flex-1">
                    <div className="px-6 py-5">

                        {/* ── 1. TRAVELLERS ──────────────────────────────────── */}
                        {activeTab === "travellers" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Users}
                                    title="Traveller Details"
                                    color="text-violet-600"
                                    subtitle="Who's coming on this trip?"
                                />

                                <div className="space-y-1.5">
                                    <Label htmlFor="leadName">Lead / Primary Traveller Name</Label>
                                    <Input
                                        id="leadName"
                                        value={reqs.travellers.leadName}
                                        onChange={e => update("travellers", { leadName: e.target.value })}
                                        placeholder="Full name of primary traveller"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="adults">
                                            Adults
                                            <span className="text-muted-foreground text-[10px] ml-1">12+ yrs</span>
                                        </Label>
                                        <Input
                                            id="adults"
                                            type="number"
                                            min={1}
                                            value={reqs.travellers.adults}
                                            onChange={e => update("travellers", { adults: Math.max(1, parseInt(e.target.value) || 1) })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="children">
                                            Children
                                            <span className="text-muted-foreground text-[10px] ml-1">2–12 yrs</span>
                                        </Label>
                                        <Input
                                            id="children"
                                            type="number"
                                            min={0}
                                            value={reqs.travellers.children}
                                            onChange={e => update("travellers", { children: Math.max(0, parseInt(e.target.value) || 0) })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="infants">
                                            Infants
                                            <span className="text-muted-foreground text-[10px] ml-1">&lt;2 yrs</span>
                                        </Label>
                                        <Input
                                            id="infants"
                                            type="number"
                                            min={0}
                                            value={reqs.travellers.infants}
                                            onChange={e => update("travellers", { infants: Math.max(0, parseInt(e.target.value) || 0) })}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 px-3 py-2.5">
                                    <p className="text-xs text-violet-700 dark:text-violet-400">
                                        Total Pax:{" "}
                                        <span className="font-semibold text-sm">
                                            {totalPax}
                                        </span>
                                        <span className="text-violet-600/70 ml-1.5">
                                            ({reqs.travellers.adults}A
                                            {reqs.travellers.children > 0 && ` + ${reqs.travellers.children}C`}
                                            {reqs.travellers.infants > 0 && ` + ${reqs.travellers.infants}I`})
                                        </span>
                                    </p>
                                </div>

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
                                    color="text-green-600"
                                    subtitle="Where are they going and when?"
                                />

                                <div className="space-y-1.5">
                                    <Label htmlFor="startingPoint">Departure / Starting Point</Label>
                                    <Input
                                        id="startingPoint"
                                        value={reqs.journey.startingPoint}
                                        onChange={e => update("journey", { startingPoint: e.target.value })}
                                        placeholder="e.g. Delhi, Mumbai, Chandigarh..."
                                    />
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
                                        <Input
                                            id="days"
                                            type="number"
                                            min={1}
                                            value={reqs.journey.noOfDays}
                                            onChange={e => {
                                                const value = e.target.value;

                                                // Allow empty input while typing
                                                if (value === "") {
                                                    update("journey", { noOfDays: 0 });
                                                    return;
                                                }

                                                update("journey", {
                                                    noOfDays: parseInt(value) || 0,
                                                });
                                            }}
                                            onBlur={e => {
                                                const d = Math.max(1, parseInt(e.target.value) || 1);
                                                update("journey", {
                                                    noOfDays: d,
                                                    noOfNights: Math.max(0, d - 1),
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="nights">Number of Nights</Label>
                                        <Input
                                            id="nights"
                                            type="number"
                                            min={0}
                                            value={reqs.journey.noOfNights}
                                            onChange={e => {
                                                const value = e.target.value;

                                                if (value === "") {
                                                    update("journey", { noOfNights: 0 });
                                                    return;
                                                }

                                                update("journey", {
                                                    noOfNights: parseInt(value) || 0,
                                                });
                                            }}
                                            onBlur={e => {
                                                update("journey", {
                                                    noOfNights: Math.max(0, parseInt(e.target.value) || 0),
                                                });
                                            }}
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
                                                    <MapPin className="h-2.5 w-2.5 text-green-600" />
                                                    {d}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDestination(i)}
                                                        className="ml-0.5 rounded-full hover:text-destructive transition-colors"
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

                        {/* ── 3. STAY ─────────────────────────────────────────── */}
                        {activeTab === "stay" && (
                            <div className="space-y-4">
                                <SectionHeader
                                    icon={Hotel}
                                    title="Stay & Accommodation"
                                    color="text-purple-600"
                                    subtitle="What kind of accommodation do they prefer?"
                                />

                                <div className="space-y-2">
                                    <Label>
                                        Stay Type
                                        <span className="text-muted-foreground text-xs font-normal ml-1.5">select all that apply</span>
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
                                        <span className="text-muted-foreground text-xs font-normal ml-1.5">select all that apply</span>
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
                                                className="hover:text-destructive"
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
                                    color="text-orange-600"
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
                                                Vehicle / Cab Type
                                                <span className="text-muted-foreground text-xs font-normal ml-1.5">select all that apply</span>
                                            </Label>
                                            <MultiToggle
                                                options={CAB_TYPES}
                                                selected={reqs.transport.cabTypes}
                                                onChange={v => update("transport", { cabTypes: v })}
                                            />
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
                                    <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                                        <p className="text-xs text-muted-foreground">
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
                                    color="text-yellow-600"
                                    subtitle="What experiences does the customer want?"
                                />

                                <div className="space-y-2">
                                    <Label>
                                        Select Activities
                                        <span className="text-muted-foreground text-xs font-normal ml-1.5">tap to select</span>
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
                                        <span className="text-muted-foreground text-xs font-normal ml-1.5">not in the list above</span>
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
                                                    <Zap className="h-2.5 w-2.5 text-yellow-600" />
                                                    {a}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCustomActivity(i)}
                                                        className="hover:text-destructive transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {(reqs.activities.selected.length > 0 || reqs.activities.custom.length > 0) && (
                                    <div className="rounded-lg bg-yellow-50/60 dark:bg-yellow-950/20 border border-yellow-200/60 dark:border-yellow-900/40 px-3 py-2">
                                        <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
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
                                    color="text-red-600"
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
                                            onChange={e => update("budget", {
                                                max: e.target.value ? parseInt(e.target.value) : undefined,
                                            })}
                                        />
                                    </div>
                                </div>

                                {(reqs.budget.min || reqs.budget.max) && (
                                    <div className="rounded-lg bg-violet-200/60 border border-primary/20 px-4 py-3">
                                        <p className="text-xs text-violet-700 mb-0.5">Budget Range</p>
                                        <p className="text-lg font-semibold text-primary">
                                            ₹{(reqs.budget.min ?? 0).toLocaleString("en-IN")}
                                            {" — "}
                                            ₹{(reqs.budget.max ?? 0).toLocaleString("en-IN")}
                                        </p>
                                        <p className="text-xs text-violet-700 mt-0.5">
                                            {reqs.budget.type === "PER_PERSON" ? "per person" : "total for the group"}
                                            {reqs.budget.type === "PER_PERSON" && totalPax > 0 && (
                                                <span className="ml-1">
                                                    (≈ ₹{((reqs.budget.min ?? 0) * totalPax).toLocaleString("en-IN")}
                                                    {" — "}
                                                    ₹{((reqs.budget.max ?? 0) * totalPax).toLocaleString("en-IN")} total)
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

                {/* Footer — nav dots + prev/next + save */}
                <div className="px-6 py-4 border-t bg-muted/20 shrink-0 flex items-center justify-between gap-3">
                    {/* Progress dots */}
                    <div className="flex items-center gap-1">
                        {TABS.map((tab, i) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => goToTab(tab.id)}
                                className={[
                                    "h-1.5 rounded-full transition-all duration-200",
                                    activeTab === tab.id
                                        ? "w-6 bg-violet-600"
                                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                                ].join(" ")}
                                title={tab.label}
                            />
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={prevTab}
                            disabled={activeTabIdx === 0}
                            className="gap-1"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Back
                        </Button>
                        {!isLastTab ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={nextTab}
                                className="gap-1"
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
                                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white p-2 rounded-md cursor-pointer"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isPending ? "Saving..." : "Save Requirements"}
                            </Button>
                        )}
                        {/* Allow save from any tab */}
                        {!isLastTab && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleSave}
                                disabled={isPending}
                            >
                                {isPending ? "Saving..." : "Save"}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}