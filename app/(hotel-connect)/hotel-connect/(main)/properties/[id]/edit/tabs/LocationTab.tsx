"use client";

import dynamic from "next/dynamic";
import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { saveLocation } from "./location-actions";
import type { LocationState, LocationValues } from "./location-schema";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HotelLocationInfo = {
  id: number;
  address: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Extended error keys — includes local split-address fields + terms
type AllErrors = Partial<Record<keyof LocationValues | "buildingNo" | "locality" | "terms", string[]>>;

// ── Map (SSR-disabled) ────────────────────────────────────────────────────────

const MapPicker = dynamic(
  () => import("@/app/(dashboard)/dashboard/(main)/components/location/LocationMapPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-neutral-100 rounded-xl">
        <div className="flex flex-col items-center gap-2 text-neutral-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-xs">Loading map…</span>
        </div>
      </div>
    ),
  }
);

// ── Mapbox geocoding ───────────────────────────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type GeoSuggestion = {
  id: string;
  place_name: string;
  center: [number, number];
  text: string;
  context?: { id: string; text: string }[];
};

async function geocodeAddress(query: string): Promise<GeoSuggestion[]> {
  if (!query.trim() || !MAPBOX_TOKEN) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("language", "en");
  url.searchParams.set("country", "in");
  url.searchParams.set("types", "address,poi,place,locality,neighborhood,postcode");
  url.searchParams.set("limit", "5");
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return data.features ?? [];
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(`/api/locations/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ name?: string; country?: string; region?: string; place?: string }>;
  } catch {
    return null;
  }
}

function extractContext(feature: GeoSuggestion) {
  const ctx: Record<string, string> = {};
  (feature.context ?? []).forEach((c) => {
    const key = c.id.split(".")[0];
    ctx[key] = c.text;
  });
  return ctx;
}

// Derive city/state/country from a Mapbox feature.
// When the user searches "Manali", the result IS the city (id starts with "place.").
// Its own name won't appear in its context — we must check the feature itself.
function extractLocation(s: GeoSuggestion) {
  const ctx = extractContext(s);
  const selfType = s.id.split(".")[0]; // "place", "locality", "region", "country", …

  const city =
    ctx.place ||
    ctx.locality ||
    ctx.district ||
    (["place", "locality", "district", "neighborhood"].includes(selfType) ? s.text : "");

  const state   = ctx.region  || (selfType === "region"  ? s.text : "");
  const country = ctx.country || (selfType === "country" ? s.text : "");
  const postcode = ctx.postcode || (selfType === "postcode" ? s.text : "");

  return { city, state, country, postcode };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p data-field-error className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      {errors[0]}
    </p>
  );
}

function FieldRow({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      <FieldError errors={error} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LocationTab({ hotel }: { hotel: HotelLocationInfo }) {
  const boundAction = saveLocation.bind(null, hotel.id);
  const [state, formAction, isPending] = useActionState<LocationState, FormData>(
    boundAction,
    {}
  );

  // ── Map coordinates ────────────────────────────────────────────────────────
  const [lat, setLat] = useState<number>(hotel.latitude ?? 22.5937);
  const [lng, setLng] = useState<number>(hotel.longitude ?? 82.9629);
  const [pinned, setPinned] = useState(hotel.latitude != null && hotel.longitude != null);
  const [locating, setLocating] = useState(false);

  // ── Address: split saved value at first ", " for re-hydration ─────────────
  const savedAddress = hotel.address ?? "";
  const commaIdx = savedAddress.indexOf(", ");
  const [buildingNo, setBuildingNo] = useState(commaIdx > 0 ? savedAddress.slice(0, commaIdx) : "");
  const [locality,   setLocality]   = useState(commaIdx > 0 ? savedAddress.slice(commaIdx + 2) : savedAddress);
  const [landmark,   setLandmark]   = useState(hotel.landmark ?? "");

  // ── Auto-populated (read-only) fields ─────────────────────────────────────
  const [city,    setCity]    = useState(hotel.city    ?? "");
  const [state_,  setState_]  = useState(hotel.state   ?? "");
  const [country, setCountry] = useState(hotel.country ?? "");
  const [pincode, setPincode] = useState(hotel.pincode ?? "");

  // ── Terms checkbox ─────────────────────────────────────────────────────────
  const [termsChecked, setTermsChecked] = useState(false);

  // ── Address search autocomplete ────────────────────────────────────────────
  const [searchQuery,     setSearchQuery]     = useState("");
  const [suggestions,     setSuggestions]     = useState<GeoSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // ── Errors ─────────────────────────────────────────────────────────────────
  const [clientErrors, setClientErrors] = useState<AllErrors>({});
  const fe: AllErrors = { ...(state.fieldErrors ?? {}), ...clientErrors };

  function clearErr(...fields: (keyof AllErrors)[]) {
    setClientErrors((prev) => {
      const next = { ...prev };
      fields.forEach((f) => delete next[f]);
      return next;
    });
  }

  // ── Address search ─────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await geocodeAddress(q);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSearchLoading(false);
    }, 350);
  }, []);

  function pickSuggestion(s: GeoSuggestion) {
    const [sLng, sLat] = s.center;
    setLat(sLat); setLng(sLng); setPinned(true);
    setSearchQuery(s.place_name);
    setShowSuggestions(false);
    setSuggestions([]);

    const loc = extractLocation(s);
    // s.text is the street / area / POI name → pre-fill locality if blank
    if (!locality) setLocality(s.text);
    // Always overwrite city/state/country so re-selecting a different location updates them
    if (loc.city)     { setCity(loc.city);        clearErr("city"); }
    if (loc.state)    { setState_(loc.state);      clearErr("state"); }
    if (loc.country)  { setCountry(loc.country);   clearErr("country"); }
    if (loc.postcode) { setPincode(loc.postcode);  clearErr("pincode"); }
    clearErr("latitude");
  }

  // Close suggestions on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── Map pin ────────────────────────────────────────────────────────────────

  async function handlePin(newLat: number, newLng: number) {
    setLat(newLat); setLng(newLng); setPinned(true);
    clearErr("latitude");
    const geo = await reverseGeocode(newLat, newLng);
    if (geo) {
      if (geo.place)   { setCity(geo.place);      clearErr("city"); }
      if (geo.region)  { setState_(geo.region);   clearErr("state"); }
      if (geo.country) { setCountry(geo.country); clearErr("country"); }
      if (geo.name && !locality) setLocality(geo.name);
    }
  }

  // ── Current location ───────────────────────────────────────────────────────

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await handlePin(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  // ── Composed address for hidden input ──────────────────────────────────────
  const composedAddress = [buildingNo.trim(), locality.trim()].filter(Boolean).join(", ");

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): AllErrors {
    const errs: AllErrors = {};
    if (!pinned)
      errs.latitude = ["Please pin your property location on the map"];
    if (!buildingNo.trim())
      errs.buildingNo = ["Building / house number is required"];
    if (!locality.trim())
      errs.locality = ["Locality / area / street is required"];
    if (!city.trim())
      errs.city = ["City is required — search or pin the map to auto-fill"];
    if (!state_.trim())
      errs.state = ["State is required — search or pin the map to auto-fill"];
    if (!country.trim())
      errs.country = ["Country is required — search or pin the map to auto-fill"];
    if (!/^\d{6}$/.test(pincode.trim()))
      errs.pincode = ["Enter a valid 6-digit pincode"];
    if (!termsChecked)
      errs.terms = ["Please confirm the address accuracy before continuing"];
    return errs;
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      setClientErrors(errs);
      requestAnimationFrame(() => {
        document.querySelector("[data-field-error]")?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    } else {
      setClientErrors({});
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form id="wizard-form" action={formAction} onSubmit={handleSubmit} className="space-y-5">

      {/* Hidden inputs: lat/lng + composed address + city/state/country/pincode */}
      <input type="hidden" name="latitude"  value={pinned ? lat : ""} />
      <input type="hidden" name="longitude" value={pinned ? lng : ""} />
      <input type="hidden" name="address"   value={composedAddress} />

      {state.error && (
        <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
          {state.error}
        </div>
      )}

      {/* ── Section 1: Map ───────────────────────────────────────────────── */}
      <SectionCard
        title="Pin Your Property on the Map"
        desc="Search for your address or click the map to mark your exact location"
      >

        {/* Address search */}
        <div ref={searchWrapRef} className="relative z-1001">
          <div className="relative flex items-center">
            <svg className="absolute left-3 h-4 w-4 text-neutral-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search your locality, street, area or landmark…"
              className={[
                "w-full h-10 pl-9 pr-8 rounded-lg border text-sm shadow-sm outline-none transition-colors",
                "placeholder:text-neutral-400 focus:ring-2 focus:ring-primary-500/20",
                fe.latitude
                  ? "border-red-400 focus:border-red-400 bg-red-50/30"
                  : "border-neutral-300 focus:border-primary-400 bg-white",
              ].join(" ")}
              autoComplete="off"
            />
            {searchLoading && (
              <svg className="absolute right-3 animate-spin h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {!searchLoading && searchQuery && (
              <button
                type="button"
                className="absolute right-3 text-neutral-400 hover:text-neutral-600"
                onClick={() => { setSearchQuery(""); setSuggestions([]); setShowSuggestions(false); }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-neutral-50 flex items-start gap-2.5 transition-colors"
                    onClick={() => pickSuggestion(s)}
                  >
                    <svg className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                    <span>
                      <span className="font-medium text-neutral-800">{s.text}</span>
                      <span className="block text-xs text-neutral-400 truncate">{s.place_name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Map */}
        <div
          className={[
            "relative rounded-xl overflow-hidden border",
            fe.latitude ? "border-red-300 ring-2 ring-red-300/30" : "border-neutral-200",
          ].join(" ")}
          style={{ height: 300 }}
        >
          <MapPicker lat={lat} lng={lng} onPin={handlePin} />

          {!pinned && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2.5 text-center shadow border border-neutral-200">
                <p className="text-sm font-semibold text-neutral-700">Click on the map to pin your property</p>
                <p className="text-xs text-neutral-400 mt-0.5">Or search for your address above</p>
              </div>
            </div>
          )}

          {pinned && (
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-md px-2.5 py-1 text-[11px] text-neutral-500 font-mono shadow-sm">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          )}
        </div>

        {/* Current location + pin error */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating || isPending}
            className="flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-600 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            <svg className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
            {locating ? "Detecting location…" : "Use my current location"}
          </button>
          {fe.latitude && (
            <p data-field-error className="text-xs text-red-500 flex items-center gap-1">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {fe.latitude[0]}
            </p>
          )}
        </div>

      </SectionCard>

      {/* ── Section 2: Address Details ───────────────────────────────────── */}
      <SectionCard
        title="Property Address Details"
        desc="Enter the complete address — this appears on booking confirmations sent to guests"
      >

        {/* Row 1: Building No + Locality */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="House / Building / Flat No." required error={fe.buildingNo}>
            <Input
              name="buildingNo"
              value={buildingNo}
              onChange={(e) => { setBuildingNo(e.target.value); if (e.target.value.trim()) clearErr("buildingNo"); }}
              placeholder="e.g. 12, Block B, Sunrise Apts"
              disabled={isPending}
              aria-invalid={!!fe.buildingNo}
            />
          </FieldRow>

          <FieldRow label="Locality / Area / Street" required error={fe.locality}>
            <Input
              name="locality"
              value={locality}
              onChange={(e) => { setLocality(e.target.value); if (e.target.value.trim()) clearErr("locality"); }}
              placeholder="e.g. Mall Road, Lakkar Bazaar"
              disabled={isPending}
              aria-invalid={!!fe.locality}
            />
          </FieldRow>
        </div>

        {/* Row 2: Landmark */}
        <FieldRow label="Nearest Landmark" error={fe.landmark}>
          <Input
            name="landmark"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="e.g. Near Shimla Bus Station, The Ridge"
            disabled={isPending}
          />
        </FieldRow>

        {/* Row 3: City + State */}
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="City" required error={fe.city}>
            <Input
              name="city"
              value={city}
              onChange={(e) => { setCity(e.target.value); if (e.target.value.trim()) clearErr("city"); }}
              placeholder="e.g. Manali"
              disabled={isPending}
              aria-invalid={!!fe.city}
            />
          </FieldRow>
          <FieldRow label="State" required error={fe.state}>
            <Input
              name="state"
              value={state_}
              onChange={(e) => { setState_(e.target.value); if (e.target.value.trim()) clearErr("state"); }}
              placeholder="e.g. Himachal Pradesh"
              disabled={isPending}
              aria-invalid={!!fe.state}
            />
          </FieldRow>
        </div>

        {/* Row 4: Country + Pincode */}
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Country" required error={fe.country}>
            <Input
              name="country"
              value={country}
              onChange={(e) => { setCountry(e.target.value); if (e.target.value.trim()) clearErr("country"); }}
              placeholder="e.g. India"
              disabled={isPending}
              aria-invalid={!!fe.country}
            />
          </FieldRow>
          <FieldRow label="Pincode" required error={fe.pincode}>
            <Input
              name="pincode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPincode(v);
                if (/^\d{6}$/.test(v)) clearErr("pincode");
              }}
              placeholder="6-digit pincode"
              disabled={isPending}
              aria-invalid={!!fe.pincode}
            />
          </FieldRow>
        </div>

        {/* Hint: fields auto-fill but are editable */}
        <p className="text-xs text-neutral-400">
          City, State, and Country auto-fill when you search or pin the map. You can also type them manually.
        </p>

      </SectionCard>

      {/* ── Terms checkbox ────────────────────────────────────────────────── */}
      <div
        className={[
          "rounded-xl border p-4 transition-colors",
          fe.terms
            ? "border-red-300 bg-red-50/40"
            : termsChecked
            ? "border-green-200 bg-green-50/40"
            : "border-neutral-200 bg-white",
        ].join(" ")}
      >
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={termsChecked}
              onChange={(e) => {
                setTermsChecked(e.target.checked);
                if (e.target.checked) clearErr("terms");
              }}
            />
            <div
              className={[
                "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                termsChecked
                  ? "bg-primary-500 border-primary-500"
                  : fe.terms
                  ? "border-red-400 bg-white"
                  : "border-neutral-400 bg-white",
              ].join(" ")}
            >
              {termsChecked && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-neutral-700 leading-snug">
            I confirm that the address entered above accurately matches the{" "}
            <strong className="text-neutral-900">property registration or lease document</strong>, and is
            correct for guest navigation and booking communications.
          </span>
        </label>
        <FieldError errors={fe.terms} />
      </div>

    </form>
  );
}
