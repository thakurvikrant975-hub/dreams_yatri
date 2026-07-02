"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { formatDistanceToNow } from "date-fns";
import { Plus, Pencil, Loader2, AlertTriangle, CheckCircle2, Clock, User2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "../components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { LOCATION_TYPES, type LocationTypeValue } from "@/app/lib/validators/locations";
import {
    createLocation, updateLocation, checkLocationSlug, checkLocationDuplicate,
    type LocationFormState, type LocationRef, type LocationDuplicateMatch,
} from "./actions";
import { LocationSearchSelect } from "../components/location/LocationSearchSelect";
import type { LocationValue } from "../components/location/location.types";

const LocationMapPicker = dynamic(
    () => import("../components/location/LocationMapPicker"),
    { ssr: false, loading: () => <div className="h-full w-full rounded-xl bg-muted animate-pulse" /> },
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type LocationRow = {
    id: string;
    type: string;
    name: string;
    official_name: string | null;
    slug: string;
    // Attribution — optional so existing callers without these fields still typecheck.
    // Populated whenever this row comes from getLocations / getLocationById (which call attachActors).
    created_at?: Date;
    createdByName?: string | null;
    short_code: string | null;
    iso_code: string | null;
    latitude: number | null;
    longitude: number | null;
    elevation_meters: number | null;
    population: number | null;
    timezone: string | null;
    description: string | null;
    is_featured: boolean;
    is_popular: boolean;
    is_searchable: boolean;
    is_active: boolean;
    parent: LocationRef | null;
    country: LocationRef | null;
    state: LocationRef | null;
    city: LocationRef | null;
    seo_title: string | null;
    seo_description: string | null;
    hero_image: string | null;
    geonames_id: number | null;
    osm_id: string | null;
    mapbox_id: string | null;
};

type FormState = {
    type: LocationTypeValue;
    name: string;
    official_name: string;
    slug: string;
    short_code: string;
    iso_code: string;
    latitude: number | null;
    longitude: number | null;
    elevation_meters: string;
    population: string;
    timezone: string;
    description: string;
    is_featured: boolean;
    is_popular: boolean;
    is_searchable: boolean;
    is_active: boolean;
    parent: LocationValue | null;
    country: LocationValue | null;
    state: LocationValue | null;
    city: LocationValue | null;
    seo_title: string;
    seo_description: string;
    hero_image: string;
    geonames_id: string;
    osm_id: string;
    mapbox_id: string;
};

function refToValue(ref: LocationRef | null): LocationValue | null {
    if (!ref) return null;
    return { id: ref.id, name: ref.name, type: ref.type as LocationValue["type"], breadcrumb: ref.breadcrumb, slug: ref.slug };
}

const DEFAULT_CENTER: [number, number] = [22.5, 80]; // roughly central India

function toSlug(s: string) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "");
}

// Entity-specific types get a suffix appended to the slug to reduce collisions
// (e.g. "manali-hotel" vs "manali-activity" for the same place name).
// Pure geographic types (CITY, STATE, COUNTRY, …) don't need a suffix.
const TYPE_SLUG_SUFFIX: Record<string, string> = {
    HOTEL:           "hotel",
    ACTIVITY:        "activity",
    AIRPORT:         "airport",
    RAILWAY_STATION: "railway-station",
    BUS_STOP:        "bus-stop",
    ROUTE_STOP:      "stop",
    TRANSFER_POINT:  "transfer",
    PORT:            "port",
    ATTRACTION:      "attraction",
    PARK:            "park",
    LANDMARK:        "landmark",
};

function slugWithSuffix(baseName: string, type: string): string {
    const base = toSlug(baseName);
    const suffix = TYPE_SLUG_SUFFIX[type];
    if (!suffix || !base) return base;
    return `${base}-${suffix}`;
}

function emptyForm(): FormState {
    return {
        type: "CITY",
        name: "",
        official_name: "",
        slug: "",
        short_code: "",
        iso_code: "",
        latitude: null,
        longitude: null,
        elevation_meters: "",
        population: "",
        timezone: "",
        description: "",
        is_featured: false,
        is_popular: false,
        is_searchable: true,
        is_active: true,
        parent: null,
        country: null,
        state: null,
        city: null,
        seo_title: "",
        seo_description: "",
        hero_image: "",
        geonames_id: "",
        osm_id: "",
        mapbox_id: "",
    };
}

function fromRow(row: LocationRow): FormState {
    return {
        type: row.type as LocationTypeValue,
        name: row.name,
        official_name: row.official_name ?? "",
        slug: row.slug,
        short_code: row.short_code ?? "",
        iso_code: row.iso_code ?? "",
        latitude: row.latitude,
        longitude: row.longitude,
        elevation_meters: row.elevation_meters != null ? String(row.elevation_meters) : "",
        population: row.population != null ? String(row.population) : "",
        timezone: row.timezone ?? "",
        description: row.description ?? "",
        is_featured: row.is_featured,
        is_popular: row.is_popular,
        is_searchable: row.is_searchable,
        is_active: row.is_active,
        parent: refToValue(row.parent),
        country: refToValue(row.country),
        state: refToValue(row.state),
        city: refToValue(row.city),
        seo_title: row.seo_title ?? "",
        seo_description: row.seo_description ?? "",
        hero_image: row.hero_image ?? "",
        geonames_id: row.geonames_id != null ? String(row.geonames_id) : "",
        osm_id: row.osm_id ?? "",
        mapbox_id: row.mapbox_id ?? "",
    };
}

function buildFormData(data: FormState): FormData {
    const fd = new FormData();
    fd.append("type", data.type);
    fd.append("name", data.name);
    fd.append("official_name", data.official_name);
    fd.append("slug", data.slug);
    fd.append("short_code", data.short_code);
    fd.append("iso_code", data.iso_code);
    fd.append("latitude", data.latitude != null ? String(data.latitude) : "");
    fd.append("longitude", data.longitude != null ? String(data.longitude) : "");
    fd.append("elevation_meters", data.elevation_meters);
    fd.append("population", data.population);
    fd.append("timezone", data.timezone);
    fd.append("description", data.description);
    fd.append("is_featured", String(data.is_featured));
    fd.append("is_popular", String(data.is_popular));
    fd.append("is_searchable", String(data.is_searchable));
    fd.append("is_active", String(data.is_active));
    fd.append("parent_id", data.parent?.id ?? "");
    fd.append("country_id", data.country?.id ?? "");
    fd.append("state_id", data.state?.id ?? "");
    fd.append("city_id", data.city?.id ?? "");
    fd.append("seo_title", data.seo_title);
    fd.append("seo_description", data.seo_description);
    fd.append("hero_image", data.hero_image);
    fd.append("geonames_id", data.geonames_id);
    fd.append("osm_id", data.osm_id);
    fd.append("mapbox_id", data.mapbox_id);
    return fd;
}

// ── Shared form body ──────────────────────────────────────────────────────────

function LocationForm({
    data,
    setData,
    isEdit,
    excludeId,
    errors,
}: {
    data: FormState;
    setData: (d: FormState) => void;
    isEdit: boolean;
    excludeId?: string;
    errors?: Record<string, string[]>;
}) {
    const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [slugSuggestion, setSlugSuggestion] = useState("");
    const [slugManual, setSlugManual] = useState(isEdit);
    const [duplicates, setDuplicates] = useState<LocationDuplicateMatch[]>([]);
    const dataRef = useRef(data);
    useEffect(() => { dataRef.current = data; });

    // Slug availability check
    useEffect(() => {
        if (!data.slug) { setSlugStatus("idle"); return; }
        setSlugStatus("checking");
        const timer = setTimeout(async () => {
            try {
                const result = await checkLocationSlug(data.slug, excludeId);
                setSlugStatus(result.exists ? "taken" : "available");
                setSlugSuggestion(result.suggestion);
            } catch {
                setSlugStatus("idle");
            }
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.slug]);

    // Duplicate detection — fires when name or type changes
    useEffect(() => {
        if (!data.name || data.name.trim().length < 2) { setDuplicates([]); return; }
        const timer = setTimeout(async () => {
            try {
                const result = await checkLocationDuplicate(data.name, data.type, excludeId);
                setDuplicates(result.matches);
            } catch {
                setDuplicates([]);
            }
        }, 600);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.name, data.type]);

    const lat = data.latitude ?? DEFAULT_CENTER[0];
    const lng = data.longitude ?? DEFAULT_CENTER[1];

    return (
        <div className="space-y-4 px-4">
            {/* Type + Name */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Type <span className="text-destructive">*</span></Label>
                    <Select
                        value={data.type}
                        onValueChange={(v) => {
                            const newType = v as LocationTypeValue;
                            setData({
                                ...data,
                                type: newType,
                                ...(slugManual ? {} : { slug: slugWithSuffix(data.name, newType) }),
                            });
                        }}
                    >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {LOCATION_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="loc-short-code">Short code</Label>
                    <Input
                        id="loc-short-code"
                        value={data.short_code}
                        onChange={(e) => setData({ ...data, short_code: e.target.value })}
                        placeholder="e.g. BOM"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="loc-name">Name <span className="text-destructive">*</span></Label>
                <Input
                    id="loc-name"
                    value={data.name}
                    onChange={(e) => {
                        const raw = e.target.value;
                        const name = raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
                        setData({
                            ...data, name,
                            ...(slugManual ? {} : { slug: slugWithSuffix(name, data.type) }),
                        });
                    }}
                    placeholder="e.g. Manali"
                />
                {errors?.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}

                {/* Duplicate warning — same type, similar name */}
                {duplicates.length > 0 && (
                    <div className="rounded-lg border px-3 py-2 space-y-1.5"
                        style={{
                            borderColor: "color-mix(in oklch, var(--color-dashboard-warning) 35%, transparent)",
                            backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 8%, transparent)",
                        }}>
                        <p className="flex items-center gap-1.5 text-xs font-medium text-dashboard-warning">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Similar {data.type.replace(/_/g, " ").toLowerCase()} already exists
                        </p>
                        {duplicates.map((d) => (
                            <div key={d.id} className="pl-4.5 flex items-start gap-1 text-[11px] text-dashboard-warning/80">
                                <span className="font-medium">{d.name}</span>
                                {d.createdByName && (
                                    <span className="flex items-center gap-0.5 shrink-0">
                                        <User2 className="h-2.5 w-2.5" />
                                        {d.createdByName}
                                    </span>
                                )}
                                <span className="flex items-center gap-0.5 shrink-0">
                                    <Clock className="h-2.5 w-2.5" />
                                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="loc-official-name">Official name <span className="text-[10px] font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                    id="loc-official-name"
                    value={data.official_name}
                    onChange={(e) => setData({ ...data, official_name: e.target.value })}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="loc-slug">Slug <span className="text-destructive">*</span></Label>
                <Input
                    id="loc-slug"
                    value={data.slug}
                    onChange={(e) => {
                        setSlugManual(true);
                        setData({ ...data, slug: toSlug(e.target.value) });
                    }}
                    className={cn(slugStatus === "taken" && "border-destructive focus-visible:ring-destructive")}
                />
                {slugStatus === "checking" ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" /> Checking availability…
                    </p>
                ) : slugStatus === "taken" ? (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Already taken.{" "}
                        <button type="button" className="underline" onClick={() => setData({ ...data, slug: slugSuggestion })}>
                            Use {slugSuggestion}
                        </button>
                    </p>
                ) : slugStatus === "available" ? (
                    <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Available
                    </p>
                ) : null}
                {errors?.slug && <p className="text-xs text-destructive">{errors.slug[0]}</p>}
            </div>

            {/* Map picker */}
            <div className="space-y-1.5">
                <Label>Coordinates</Label>
                <div className="h-56 rounded-xl border overflow-hidden">
                    <LocationMapPicker
                        lat={lat}
                        lng={lng}
                        onPin={(newLat, newLng) => setData({ ...data, latitude: newLat, longitude: newLng })}
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Input
                        type="number" step="any" placeholder="Latitude"
                        value={data.latitude ?? ""}
                        onChange={(e) => setData({ ...data, latitude: e.target.value ? Number(e.target.value) : null })}
                    />
                    <Input
                        type="number" step="any" placeholder="Longitude"
                        value={data.longitude ?? ""}
                        onChange={(e) => setData({ ...data, longitude: e.target.value ? Number(e.target.value) : null })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="loc-elevation">Elevation (m)</Label>
                    <Input
                        id="loc-elevation" type="number"
                        value={data.elevation_meters}
                        onChange={(e) => setData({ ...data, elevation_meters: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="loc-population">Population</Label>
                    <Input
                        id="loc-population" type="number"
                        value={data.population}
                        onChange={(e) => setData({ ...data, population: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="loc-iso">ISO code</Label>
                    <Input
                        id="loc-iso"
                        value={data.iso_code}
                        onChange={(e) => setData({ ...data, iso_code: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="loc-timezone">Timezone</Label>
                <Input
                    id="loc-timezone"
                    value={data.timezone}
                    onChange={(e) => setData({ ...data, timezone: e.target.value })}
                    placeholder="e.g. Asia/Kolkata"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="loc-desc">Description</Label>
                <Textarea
                    id="loc-desc" rows={3}
                    value={data.description}
                    onChange={(e) => setData({ ...data, description: e.target.value })}
                />
            </div>

            {/* Hierarchy — country/state/city are denormalised lookups used for fast
                hierarchy queries; parent is the general "belongs under" relation. */}
            <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Hierarchy</p>
                <p className="text-xs text-muted-foreground -mt-2">
                    Fix a wrong country/state/city by re-linking it here
                </p>

                <div className="space-y-1.5">
                    <Label>Country</Label>
                    <LocationSearchSelect
                        value={data.country}
                        onChange={(loc) => setData({ ...data, country: loc })}
                        placeholder="Search country…"
                        types={["COUNTRY"]}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>State</Label>
                    <LocationSearchSelect
                        value={data.state}
                        onChange={(loc) => setData({ ...data, state: loc })}
                        placeholder="Search state…"
                        types={["STATE"]}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>City</Label>
                    <LocationSearchSelect
                        value={data.city}
                        onChange={(loc) => setData({ ...data, city: loc })}
                        placeholder="Search city…"
                        types={["CITY"]}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Parent location <span className="text-[10px] font-normal text-muted-foreground">(optional, general hierarchy)</span></Label>
                    <LocationSearchSelect
                        value={data.parent}
                        onChange={(loc) => setData({ ...data, parent: loc })}
                        placeholder="Search parent location…"
                    />
                </div>
            </div>

            {/* SEO */}
            <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">SEO</p>
                <div className="space-y-1.5">
                    <Label htmlFor="loc-seo-title">Meta title</Label>
                    <Input
                        id="loc-seo-title"
                        value={data.seo_title}
                        onChange={(e) => setData({ ...data, seo_title: e.target.value.slice(0, 60) })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="loc-seo-desc">Meta description</Label>
                    <Textarea
                        id="loc-seo-desc" rows={2}
                        value={data.seo_description}
                        onChange={(e) => setData({ ...data, seo_description: e.target.value.slice(0, 160) })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="loc-hero-image">Hero image URL / R2 key</Label>
                    <Input
                        id="loc-hero-image"
                        value={data.hero_image}
                        onChange={(e) => setData({ ...data, hero_image: e.target.value })}
                    />
                </div>
            </div>

            {/* Source ids — informational, populated by seeding/import flows */}
            <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Source IDs</p>
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="loc-geonames">Geonames ID</Label>
                        <Input
                            id="loc-geonames" type="number"
                            value={data.geonames_id}
                            onChange={(e) => setData({ ...data, geonames_id: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="loc-osm">OSM ID</Label>
                        <Input
                            id="loc-osm"
                            value={data.osm_id}
                            onChange={(e) => setData({ ...data, osm_id: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="loc-mapbox">Mapbox ID</Label>
                        <Input
                            id="loc-mapbox"
                            value={data.mapbox_id}
                            onChange={(e) => setData({ ...data, mapbox_id: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {[
                    { key: "is_active" as const, label: "Active", hint: "Available for use across the platform" },
                    { key: "is_searchable" as const, label: "Searchable", hint: "Shows up in location search pickers" },
                    { key: "is_featured" as const, label: "Featured", hint: "Highlighted in curated lists" },
                    { key: "is_popular" as const, label: "Popular", hint: "Marked as a popular destination" },
                ].map((f) => (
                    <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                        <div>
                            <p className="text-sm font-medium">{f.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{f.hint}</p>
                        </div>
                        <Switch
                            checked={data[f.key]}
                            onCheckedChange={(v) => setData({ ...data, [f.key]: v })}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Create ────────────────────────────────────────────────────────────────────

export function CreateLocationDialog() {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<FormState>(emptyForm());
    const [errors, setErrors] = useState<Record<string, string[]> | undefined>();
    const [isPending, startTransition] = useTransition();

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (o) { setData(emptyForm()); setErrors(undefined); }
    }

    function handleSubmit() {
        startTransition(async () => {
            const result: LocationFormState = await createLocation({ success: false, message: "" }, buildFormData(data));
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
            } else {
                toast.error(result.message);
                setErrors(result.errors);
            }
        });
    }

    return (
        <>
            <Button
                onClick={() => handleOpenChange(true)}
                size="lg"
                className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
            >
                <Plus className="mr-2 h-4 w-4" />
                Add Location
            </Button>

            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Add Location</SheetTitle>
                        <SheetDescription>Create a new location on the map</SheetDescription>
                    </SheetHeader>

                    <LocationForm data={data} setData={setData} isEdit={false} errors={errors} />

                    <SheetFooter>
                        <Button onClick={handleSubmit} disabled={isPending || !data.name || !data.slug}>
                            {isPending ? "Creating…" : "Create Location"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </>
    );
}

// ── Edit ──────────────────────────────────────────────────────────────────────

export function EditLocationDialog({
    location,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    hideTrigger,
}: {
    location: LocationRow;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    hideTrigger?: boolean;
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;

    const [data, setData] = useState<FormState>(() => fromRow(location));
    const [errors, setErrors] = useState<Record<string, string[]> | undefined>();
    const [isPending, startTransition] = useTransition();

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (o) { setData(fromRow(location)); setErrors(undefined); }
    }

    function handleSubmit() {
        startTransition(async () => {
            const result: LocationFormState = await updateLocation(location.id, { success: false, message: "" }, buildFormData(data));
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
            } else {
                toast.error(result.message);
                setErrors(result.errors);
            }
        });
    }

    return (
        <>
            {!hideTrigger && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenChange(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
            )}

            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Edit Location</SheetTitle>
                        <SheetDescription>Editing: {location.name}</SheetDescription>
                        {(location.createdByName || location.created_at) && (
                            <p className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                                {location.createdByName && (
                                    <span className="flex items-center gap-1">
                                        <User2 className="h-3 w-3 shrink-0" />
                                        {location.createdByName}
                                    </span>
                                )}
                                {location.created_at && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3 shrink-0" />
                                        {formatDistanceToNow(new Date(location.created_at), { addSuffix: true })}
                                    </span>
                                )}
                            </p>
                        )}
                    </SheetHeader>

                    <LocationForm data={data} setData={setData} isEdit excludeId={location.id} errors={errors} />

                    <SheetFooter>
                        <Button onClick={handleSubmit} disabled={isPending || !data.name || !data.slug}>
                            {isPending ? "Saving…" : "Save Changes"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </>
    );
}
