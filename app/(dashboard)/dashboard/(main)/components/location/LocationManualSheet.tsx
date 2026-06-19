"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MapPinIcon, Loader2Icon, PlusIcon, RefreshCwIcon,
  ToggleRightIcon, ArrowLeftIcon, Maximize2Icon, Minimize2Icon,
  XIcon, LocateFixedIcon, Link2Icon, CheckCircle2Icon,
} from "lucide-react";
import { cn, capitalizeWords } from "@/app/lib/utils";
import type { LocationType, LocationValue } from "./location.types";
import { LOCATION_LABELS } from "./location.types";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const LocationMapPicker = dynamic(() => import("./LocationMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

// Dynamic import breaks the circular dependency:
// LocationSearchSelect → (lazy) LocationManualSheet → (lazy) LocationSearchSelect
const LocationSearchSelectAsync = dynamic(
  () => import("./LocationSearchSelect").then((m) => ({ default: m.LocationSearchSelect })),
  {
    ssr: false,
    loading: () => <div className="h-10 w-full rounded-lg border bg-muted/40 animate-pulse" />,
  },
);

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(1, "Name is required"),
  type:        z.string().min(1, "Type is required"),
  country:     z.string().optional(),
  state:       z.string().optional(),
  city:        z.string().optional(),
  latitude:    z.string().optional(),
  longitude:   z.string().optional(),
  description: z.string().optional(),
  slug:        z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and hyphens"),
  is_featured: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (location: LocationValue) => void;
  initialName?: string;
  /** Lock the type dropdown to a single value (e.g. "HOTEL") */
  lockedType?: LocationType;
  /** Open the map centered here instead of the default India center */
  mapCenter?: { lat: number; lng: number };
}

// COUNTRY excluded — you never pin a country on a map
const ALL_TYPES: LocationType[] = [
  "CITY", "STATE", "DISTRICT", "AREA", "NEIGHBORHOOD", "VILLAGE",
  "LANDMARK", "AIRPORT", "BEACH", "MOUNTAIN", "ISLAND",
  "TOURISM_ZONE", "BUS_STATION", "TRAIN_STATION", "PORT",
  "REGION", "SUBREGION",
];

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

// ── Google Maps URL parser ────────────────────────────────────────────────────
// Handles: /maps/place/Name/@lat,lng,zoom  and  ?q=lat,lng
function parseGoogleMapsUrl(url: string): { lat: number; lng: number; name?: string } | null {
  const atMatch = url.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      const nameMatch = url.match(/\/maps\/place\/([^/@?]+)/);
      const name = nameMatch
        ? decodeURIComponent(nameMatch[1].replace(/\+/g, " ")).replace(/\s+\d{5,}$/, "").trim()
        : undefined;
      return { lat, lng, name: name || undefined };
    }
  }
  const qMatch = url.match(/[?&]q=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      return { lat, lng };
  }
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function LocationManualSheet({ open, onOpenChange, onCreated, initialName, lockedType, mapCenter }: Props) {
  const [coords, setCoords]               = useState(mapCenter ?? DEFAULT_CENTER);
  const [reverseLoading, setRevLoad]      = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [serverError, setServerError]     = useState<string | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [countryLoc, setCountryLoc]       = useState<LocationValue | null>(null);
  const [mapsUrl, setMapsUrl]             = useState("");
  const [mapsUrlState, setMapsUrlState]   = useState<"idle" | "success" | "error">("idle");

  const reverseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors }, reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initialName ?? "", type: lockedType ?? "CITY", is_featured: false },
  });

  const nameVal     = watch("name");
  const featuredVal = watch("is_featured");
  const latVal      = watch("latitude");
  const lngVal      = watch("longitude");

  // Auto-slug from name
  useEffect(() => {
    const slug = nameVal
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 120);
    setValue("slug", slug, { shouldValidate: false });
  }, [nameVal, setValue]);

  // Reset when sheet opens; honour mapCenter if provided
  useEffect(() => {
    if (!open) return;
    reset({ name: initialName ?? "", type: lockedType ?? "CITY", is_featured: false });
    setCoords(mapCenter ?? DEFAULT_CENTER);
    setServerError(null);
    setMapFullscreen(false);
    setCountryLoc(null);
    setMapsUrl("");
    setMapsUrlState("idle");
  }, [open, initialName, lockedType, mapCenter, reset]);

  // ── Reverse geocode (shared) ───────────────────────────────────────────────
  function fireReverseGeocode(lat: number, lng: number) {
    if (reverseDebounce.current) clearTimeout(reverseDebounce.current);
    reverseDebounce.current = setTimeout(async () => {
      try {
        setRevLoad(true);
        const res = await fetch(`/api/locations/reverse-geocode?lat=${lat}&lng=${lng}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.country) { setValue("country", data.country); setCountryLoc(null); }
        if (data.region)  setValue("state", data.region);
        if (data.place)   setValue("city",  data.place);
        if (data.name && !watch("name")) setValue("name", data.name);
      } finally {
        setRevLoad(false);
      }
    }, 600);
  }

  // ── Map pin moved ─────────────────────────────────────────────────────────
  function handlePin(lat: number, lng: number) {
    setCoords({ lat, lng });
    setValue("latitude",  String(lat.toFixed(6)));
    setValue("longitude", String(lng.toFixed(6)));
    fireReverseGeocode(lat, lng);
  }

  // ── Manual lat/lng input change ───────────────────────────────────────────
  function handleLatChange(e: React.ChangeEvent<HTMLInputElement>) {
    register("latitude").onChange(e);
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && isFinite(v)) {
      const newCoords = { lat: v, lng: coords.lng };
      setCoords(newCoords);
      fireReverseGeocode(newCoords.lat, newCoords.lng);
    }
  }

  function handleLngChange(e: React.ChangeEvent<HTMLInputElement>) {
    register("longitude").onChange(e);
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && isFinite(v)) {
      const newCoords = { lat: coords.lat, lng: v };
      setCoords(newCoords);
      fireReverseGeocode(newCoords.lat, newCoords.lng);
    }
  }

  // ── Google Maps URL import ────────────────────────────────────────────────
  function handleMapsUrl(url: string) {
    setMapsUrl(url);
    if (!url.trim()) { setMapsUrlState("idle"); return; }
    const parsed = parseGoogleMapsUrl(url);
    if (!parsed) { setMapsUrlState("error"); return; }
    setMapsUrlState("success");
    handlePin(parsed.lat, parsed.lng);
    if (parsed.name && !watch("name")) setValue("name", parsed.name);
  }

  // ── Country select ────────────────────────────────────────────────────────
  function handleCountryChange(loc: LocationValue | null) {
    setCountryLoc(loc);
    setValue("country", loc?.name ?? "");
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      setServerError(null);
      const res = await fetch("/api/locations/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          latitude:  values.latitude  || String(coords.lat),
          longitude: values.longitude || String(coords.lng),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setServerError(data.error ?? "Failed to create location"); return; }
      onCreated({
        ...(data as LocationValue),
        city_name:    values.city    || null,
        state_name:   values.state   || null,
        country_name: values.country || null,
      });
      onOpenChange(false);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    reset({ name: initialName ?? "", type: lockedType ?? "CITY", is_featured: false });
    setCoords(mapCenter ?? DEFAULT_CENTER);
    setServerError(null);
    setCountryLoc(null);
    setMapsUrl("");
    setMapsUrlState("idle");
  }

  // ── Map block (reused in both normal + fullscreen) ────────────────────────
  const MapBlock = ({ fullscreen }: { fullscreen: boolean }) => (
    <div className={cn("flex flex-col", fullscreen ? "flex-1 min-h-0" : "shrink-0")}>
      {/* Map canvas */}
      <div className={cn("relative bg-muted", fullscreen ? "flex-1 min-h-0" : "h-56")}>
        <LocationMapPicker lat={coords.lat} lng={coords.lng} onPin={handlePin} />

        {/* Fullscreen / collapse button — z-1001 to sit above Leaflet panes (max ~1000) */}
        <button
          type="button"
          onClick={() => setMapFullscreen(!fullscreen)}
          className="absolute top-2 right-2 z-1001 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 shadow text-foreground hover:bg-white transition-colors"
          title={fullscreen ? "Collapse map" : "Expand map"}
        >
          {fullscreen
            ? <Minimize2Icon className="size-3.5" />
            : <Maximize2Icon className="size-3.5" />}
        </button>

        {reverseLoading && (
          <div className="absolute top-2 left-2 z-1001 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
            <Loader2Icon className="size-3 animate-spin text-white" />
            <span className="text-[10px] text-white/80">Locating…</span>
          </div>
        )}
      </div>

      {/* Lat / Lng bar — attached directly below the map, h-10 to match inputs */}
      <div className="flex items-stretch border border-t-0 rounded-b-lg overflow-hidden bg-muted/30">
        <div className="flex items-center gap-1.5 flex-1 h-10 px-3 border-r">
          <LocateFixedIcon className="size-3 shrink-0 text-muted-foreground" />
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70 shrink-0">Lat</span>
          <input
            {...register("latitude")}
            type="number"
            step="any"
            placeholder={coords.lat.toFixed(6)}
            onChange={handleLatChange}
            className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-1 h-10 px-3">
          <LocateFixedIcon className="size-3 shrink-0 text-muted-foreground" />
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70 shrink-0">Lng</span>
          <input
            {...register("longitude")}
            type="number"
            step="any"
            placeholder={coords.lng.toFixed(6)}
            onChange={handleLngChange}
            className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
      >
        <SheetTitle className="sr-only">Add Location Manually</SheetTitle>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPinIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-none">Add Location Manually</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Drop a pin or enter coordinates</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="relative flex-1 min-h-0 overflow-hidden">

          {/* Normal view: map + scrollable form */}
          {!mapFullscreen && (
            <div className="h-full overflow-y-auto flex flex-col">
              <div className="px-5 pt-5 space-y-4">
                {/* Google Maps URL import */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Import from Google Maps URL
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <Link2Icon className="size-3.5 text-muted-foreground" />
                    </div>
                    <input
                      type="text"
                      value={mapsUrl}
                      onChange={(e) => handleMapsUrl(e.target.value)}
                      placeholder="Paste Google Maps URL — coordinates auto-fill"
                      className={cn(
                        "h-10 w-full rounded-lg border bg-dashboard-base-100 pl-8 pr-3 text-xs text-dashboard-base-content",
                        "placeholder:text-dashboard-base-content/35 outline-none transition-colors",
                        "focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary/30",
                        mapsUrlState === "error"
                          ? "border-destructive ring-1 ring-destructive/20"
                          : mapsUrlState === "success"
                          ? "border-green-500 ring-1 ring-green-500/20"
                          : "border-dashboard-base-content/85",
                      )}
                    />
                    {mapsUrl && (
                      <button
                        type="button"
                        onClick={() => { setMapsUrl(""); setMapsUrlState("idle"); }}
                        className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {mapsUrlState === "success" && (
                    <p className="flex items-center gap-1 text-[10px] text-green-600">
                      <CheckCircle2Icon className="size-3" />
                      Coordinates extracted · map pin and fields updated
                    </p>
                  )}
                  {mapsUrlState === "error" && (
                    <p className="text-[10px] text-destructive">
                      No coordinates found — make sure it&apos;s a valid Google Maps URL
                    </p>
                  )}
                </div>

                {MapBlock({ fullscreen: false })}
              </div>

              <form
                id="location-manual-form"
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4 px-5 py-5"
              >
                <Field label="Location Name" error={errors.name?.message} required>
                  <Input
                    {...register("name")}
                    placeholder="e.g. Shimla Bus Stand"
                    onChange={(e) => {
                      e.target.value = capitalizeWords(e.target.value);
                      register("name").onChange(e);
                    }}
                  />
                </Field>

                <Field label="Location Type" error={errors.type?.message} required>
                  {lockedType ? (
                    <div className={cn(
                      "flex h-10 w-full items-center rounded-lg border border-dashboard-base-content/85 bg-muted/40",
                      "px-3 text-xs text-dashboard-base-content/60 cursor-not-allowed select-none",
                    )}>
                      {LOCATION_LABELS[lockedType]}
                      <input type="hidden" {...register("type")} value={lockedType} />
                    </div>
                  ) : (
                    <select
                      {...register("type")}
                      className={cn(
                        "h-10 w-full rounded-lg border border-dashboard-base-content/85 bg-dashboard-base-100",
                        "px-3 text-xs text-dashboard-base-content outline-none",
                        "focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary/30",
                      )}
                    >
                      {ALL_TYPES.map((t) => (
                        <option key={t} value={t}>{LOCATION_LABELS[t]}</option>
                      ))}
                    </select>
                  )}
                </Field>

                <Field label="Country" error={errors.country?.message}>
                  <LocationSearchSelectAsync
                    value={countryLoc}
                    onChange={handleCountryChange}
                    placeholder={watch("country") || "Search country…"}
                    types={["COUNTRY"]}
                  />
                  {!countryLoc && watch("country") && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Auto-filled: <span className="font-medium text-foreground">{watch("country")}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => { setValue("country", ""); setCountryLoc(null); }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  )}
                </Field>

                <Field label="State / Region" error={errors.state?.message}>
                  <Input {...register("state")} placeholder="e.g. Himachal Pradesh" />
                </Field>

                <Field label="City" error={errors.city?.message}>
                  <Input {...register("city")} placeholder="e.g. Shimla" />
                </Field>

                <Field label="SEO Slug" error={errors.slug?.message} required>
                  <Input
                    {...register("slug")}
                    placeholder="shimla-bus-stand"
                    className="font-mono text-[11px]"
                  />
                </Field>

                <Field label="Description (optional)" error={errors.description?.message}>
                  <textarea
                    {...register("description")}
                    rows={2}
                    placeholder="Short description for SEO and display"
                    className={cn(
                      "w-full rounded-lg border border-dashboard-base-content/85 bg-dashboard-base-100",
                      "px-3 py-2 text-xs text-dashboard-base-content placeholder:text-dashboard-base-content/35",
                      "outline-none resize-none focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary/30",
                    )}
                  />
                </Field>

                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                  <ToggleRightIcon className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-[11px] text-muted-foreground">Mark as featured</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={featuredVal}
                    onClick={() => setValue("is_featured", !featuredVal)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      featuredVal ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span className={cn(
                      "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
                      featuredVal ? "translate-x-4" : "translate-x-0.5",
                    )} />
                  </button>
                </div>

                {serverError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                    {serverError}
                  </p>
                )}

                <div className="h-2" />
              </form>
            </div>
          )}

          {/* Fullscreen map view — fills entire body */}
          {mapFullscreen && (
            <div className="absolute inset-0 flex flex-col bg-background">
              <div className="px-5 pt-4 pb-0 flex-1 min-h-0 flex flex-col">
                {MapBlock({ fullscreen: true })}
              </div>
              <div className="px-5 py-4 border-t text-center">
                <p className="text-[11px] text-muted-foreground">
                  Click the map to drop a pin · Coordinates auto-fill below
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!mapFullscreen && (
          <div className="border-t px-5 py-4 shrink-0 flex items-center gap-2 bg-background/95 backdrop-blur-sm">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleReset}
            >
              <RefreshCwIcon className="size-3" /> Reset
            </Button>
            <Button
              type="submit"
              form="location-manual-form"
              size="sm"
              className="flex-1 gap-1.5"
              disabled={submitting}
            >
              {submitting
                ? <><Loader2Icon className="size-3 animate-spin" /> Saving…</>
                : <><PlusIcon className="size-3" /> Create Location</>}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({
  label, error, required, children,
}: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
