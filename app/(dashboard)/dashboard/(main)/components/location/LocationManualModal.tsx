"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MapPinIcon, Loader2Icon, PlusIcon,
  RefreshCwIcon, ToggleRightIcon,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import type { LocationType, LocationValue, ManualLocationFormValues } from "./location.types";
import { LOCATION_LABELS } from "./location.types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";

// Leaflet map only ever runs in the browser
const LocationMapPicker = dynamic(() => import("./LocationMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

// ── Zod schema ──────────────────────────────────────────────────────────────
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
}

const ALL_TYPES: LocationType[] = [
  "CITY", "AREA", "DISTRICT", "NEIGHBORHOOD", "VILLAGE",
  "LANDMARK", "AIRPORT", "BEACH", "MOUNTAIN", "ISLAND",
  "TOURISM_ZONE", "BUS_STATION", "TRAIN_STATION", "PORT",
  "STATE", "COUNTRY",
];

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India centroid

export function LocationManualModal({ open, onOpenChange, onCreated, initialName }: Props) {
  const [coords, setCoords]           = useState(DEFAULT_CENTER);
  const [reverseLoading, setRevLoad]  = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const reverseDebounce               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors }, reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName ?? "", type: "CITY",
      is_featured: false,
    },
  });

  const nameVal = watch("name");

  // Auto-generate slug from name
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

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) return;
    reset({ name: initialName ?? "", type: "CITY", is_featured: false });
    setCoords(DEFAULT_CENTER);
    setServerError(null);
  }, [open, initialName, reset]);

  // Reverse geocode whenever pin moves (debounced 600 ms)
  function handlePin(lat: number, lng: number) {
    setCoords({ lat, lng });
    setValue("latitude",  String(lat.toFixed(6)));
    setValue("longitude", String(lng.toFixed(6)));

    if (reverseDebounce.current) clearTimeout(reverseDebounce.current);
    reverseDebounce.current = setTimeout(async () => {
      try {
        setRevLoad(true);
        const res = await fetch(`/api/locations/reverse-geocode?lat=${lat}&lng=${lng}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.name    && !watch("name"))    setValue("name",    data.name);
        if (data.country && !watch("country")) setValue("country", data.country);
        if (data.region  && !watch("state"))   setValue("state",   data.region);
        if (data.place   && !watch("city"))    setValue("city",    data.place);
      } finally {
        setRevLoad(false);
      }
    }, 600);
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      setServerError(null);
      const res = await fetch("/api/locations/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...values,
          latitude:  values.latitude  || String(coords.lat),
          longitude: values.longitude || String(coords.lng),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setServerError(data.error ?? "Failed to create location"); return; }
      onCreated(data as LocationValue);
      onOpenChange(false);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const featuredVal = watch("is_featured");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
        <div className="flex h-[600px] flex-col sm:flex-row">

          {/* ── Left: Map ───────────────────────────────────────────────── */}
          <div className="relative flex-1 min-h-[240px] sm:min-h-0">
            <LocationMapPicker
              lat={coords.lat}
              lng={coords.lng}
              onPin={handlePin}
            />
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/60 px-3 py-1.5 text-[10px] text-white backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <MapPinIcon className="size-3 shrink-0" />
                <span>
                  Click or drag marker to pin &nbsp;·&nbsp;
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
                {reverseLoading && (
                  <Loader2Icon className="ml-auto size-3 animate-spin" />
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Form ─────────────────────────────────────────────── */}
          <div className="flex w-full flex-col sm:w-[340px] overflow-y-auto border-t sm:border-t-0 sm:border-l border-border">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <PlusIcon className="size-4 text-primary" />
                Add Location Manually
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Drop a pin on the map or fill in the form below. All fields can be edited later.
              </p>
            </DialogHeader>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-1 flex-col gap-3 px-5 pb-5"
            >
              {/* Name */}
              <Field label="Location Name" error={errors.name?.message} required>
                <Input {...register("name")} placeholder="e.g. Shimla Bus Stand" />
              </Field>

              {/* Type */}
              <Field label="Location Type" error={errors.type?.message} required>
                <select
                  {...register("type")}
                  className={cn(
                    "h-10 w-full rounded-lg border border-dashboard-base-content/85 bg-dashboard-base-100",
                    "px-3 text-xs text-dashboard-base-content outline-none",
                    "focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary/30"
                  )}
                >
                  {ALL_TYPES.map((t) => (
                    <option key={t} value={t}>{LOCATION_LABELS[t]}</option>
                  ))}
                </select>
              </Field>

              {/* Country / State / City */}
              <div className="grid grid-cols-1 gap-2">
                <Field label="Country" error={errors.country?.message}>
                  <Input {...register("country")} placeholder="e.g. India" />
                </Field>
                <Field label="State / Region" error={errors.state?.message}>
                  <Input {...register("state")} placeholder="e.g. Himachal Pradesh" />
                </Field>
                <Field label="City" error={errors.city?.message}>
                  <Input {...register("city")} placeholder="e.g. Shimla" />
                </Field>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Latitude" error={errors.latitude?.message}>
                  <Input
                    {...register("latitude")}
                    type="number"
                    step="any"
                    placeholder="31.1048"
                    onChange={(e) => {
                      register("latitude").onChange(e);
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setCoords((c) => ({ ...c, lat: v }));
                    }}
                  />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <Input
                    {...register("longitude")}
                    type="number"
                    step="any"
                    placeholder="77.1734"
                    onChange={(e) => {
                      register("longitude").onChange(e);
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setCoords((c) => ({ ...c, lng: v }));
                    }}
                  />
                </Field>
              </div>

              {/* Slug */}
              <Field label="SEO Slug" error={errors.slug?.message} required>
                <Input
                  {...register("slug")}
                  placeholder="shimla-bus-stand"
                  className="font-mono text-[11px]"
                />
              </Field>

              {/* Description */}
              <Field label="Description (optional)" error={errors.description?.message}>
                <textarea
                  {...register("description")}
                  rows={2}
                  placeholder="Short description for SEO and display"
                  className={cn(
                    "w-full rounded-lg border border-dashboard-base-content/85 bg-dashboard-base-100",
                    "px-3 py-2 text-xs text-dashboard-base-content placeholder:text-dashboard-base-content/35",
                    "outline-none resize-none focus:border-dashboard-primary focus:ring-1 focus:ring-dashboard-primary/30"
                  )}
                />
              </Field>

              {/* Featured toggle */}
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <ToggleRightIcon className="size-4 text-muted-foreground" />
                <span className="flex-1 text-[11px] text-muted-foreground">Mark as featured</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={featuredVal}
                  onClick={() => setValue("is_featured", !featuredVal)}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    featuredVal ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
                      featuredVal ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {serverError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                  {serverError}
                </p>
              )}

              {/* Actions */}
              <div className="mt-auto flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    reset({ name: initialName ?? "", type: "CITY", is_featured: false });
                    setCoords(DEFAULT_CENTER);
                  }}
                >
                  <RefreshCwIcon className="size-3" /> Reset
                </Button>
                <Button type="submit" size="sm" className="flex-1 gap-1.5" disabled={submitting}>
                  {submitting
                    ? <><Loader2Icon className="size-3 animate-spin" /> Saving…</>
                    : <><PlusIcon className="size-3" /> Create Location</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tiny inline Field component ───────────────────────────────────────────────
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
