"use client";

import { useActionState, useState } from "react";
import { Star } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/app/lib/utils";
import { saveBasicInfo } from "./basic-info-actions";
import type { BasicInfoState } from "./basic-info-schema";
import type { PropertySubType } from "@/app/generated/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HotelBasicInfo = {
  id: number;
  name: string;
  property_sub_type: PropertySubType | null;
  star_rating: number | null;
  year_built: number | null;
  booking_since_year: number | null;
  has_channel_manager: boolean;
  channel_manager_name: string | null;
  contact_email: string | null;
  contact_mobile_cc: string | null;
  contact_mobile: string | null;
  whatsapp_same_as_mobile: boolean;
  contact_whatsapp: string | null;
  contact_landline: string | null;
};

// ── Sub-type options ──────────────────────────────────────────────────────────

const SUB_TYPE_OPTIONS: { value: PropertySubType; label: string }[] = [
  { value: "HOTEL",       label: "Hotel" },
  { value: "RESORT",      label: "Resort" },
  { value: "LODGE",       label: "Lodge" },
  { value: "GUEST_HOUSE", label: "Guest House" },
  { value: "PALACE",      label: "Palace / Heritage" },
  { value: "HOUSEBOAT",   label: "Houseboat" },
  { value: "MOTEL",       label: "Motel" },
  { value: "HOMESTAY",    label: "Homestay" },
  { value: "VILLA",       label: "Villa" },
  { value: "APARTMENT",   label: "Apartment" },
  { value: "FARMHOUSE",   label: "Farmhouse" },
  { value: "TREEHOUSE",   label: "Treehouse" },
  { value: "TENT_CAMP",   label: "Tent / Camp" },
];

// ── Small helpers ─────────────────────────────────────────────────────────────

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-red-500 mt-1">{errors[0]}</p>;
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        {desc && <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, error, required, children }: {
  label: string;
  error?: string[];
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      <FieldError errors={error} />
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRatingInput({ value, onChange, disabled }: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === n ? null : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={22}
            weight={display !== null && n <= display ? "fill" : "regular"}
            className={display !== null && n <= display ? "text-amber-400" : "text-neutral-300"}
          />
        </button>
      ))}
      <span className="ml-2 text-xs text-neutral-400">
        {value ? `${value} star${value > 1 ? "s" : ""}` : "Unrated"}
      </span>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ name, label, hint, checked, onChange, disabled }: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3", disabled && "opacity-50")}
    >
      <div>
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        {hint && <p className="text-xs text-neutral-400 mt-0.5">{hint}</p>}
      </div>
      <input type="hidden" name={name} value={checked ? "on" : "off"} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
          checked ? "bg-primary-500" : "bg-neutral-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BasicInfoTab({ hotel }: { hotel: HotelBasicInfo }) {
  const boundAction = saveBasicInfo.bind(null, hotel.id);
  const [state, formAction, isPending] = useActionState<BasicInfoState, FormData>(
    boundAction,
    {}
  );

  const [starRating,        setStarRating]       = useState<number | null>(hotel.star_rating);
  const [hasChannelMgr,     setHasChannelMgr]    = useState(hotel.has_channel_manager);
  const [whatsappSame,      setWhatsappSame]      = useState(hotel.whatsapp_same_as_mobile);

  const initialName = hotel.name === "My Property" ? "" : hotel.name;
  const fe = state.fieldErrors ?? {};

  return (
    <form id="wizard-form" action={formAction} className="space-y-5">

      {state.error && (
        <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
          {state.error}
        </div>
      )}

      {/* ── Section 1: Property Details ───────────────────────────────── */}
      <SectionCard title="Property Details">
        {/* Name */}
        <FieldRow label="Property Name" required error={fe.name}>
          <Input
            name="name"
            defaultValue={initialName}
            placeholder="e.g. The Grand Shimla Resort"
            disabled={isPending}
            className={cn("h-10 rounded-lg text-sm", fe.name && "border-red-400")}
          />
        </FieldRow>

        {/* Type + Star Rating */}
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Property Type" required error={fe.property_sub_type}>
            <select
              name="property_sub_type"
              defaultValue={hotel.property_sub_type ?? ""}
              disabled={isPending}
              className={cn(
                "w-full h-10 rounded-lg border px-3 text-sm bg-white text-neutral-900 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                fe.property_sub_type ? "border-red-400" : "border-neutral-300"
              )}
            >
              <option value="" disabled>Select type…</option>
              {SUB_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Star Rating" error={fe.star_rating}>
            <input type="hidden" name="star_rating" value={starRating ?? ""} />
            <div className="h-10 flex items-center">
              <StarRatingInput value={starRating} onChange={setStarRating} disabled={isPending} />
            </div>
          </FieldRow>
        </div>

        {/* Year Built + On DreamsYatri Since */}
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Year Built" error={fe.year_built}>
            <Input
              name="year_built"
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              defaultValue={hotel.year_built ?? ""}
              placeholder="e.g. 2010"
              disabled={isPending}
              className={cn("h-10 rounded-lg text-sm", fe.year_built && "border-red-400")}
            />
          </FieldRow>

          <FieldRow label="On DreamsYatri Since" error={fe.booking_since_year}>
            <Input
              name="booking_since_year"
              type="number"
              min={1990}
              max={new Date().getFullYear()}
              defaultValue={hotel.booking_since_year ?? ""}
              placeholder="e.g. 2022"
              disabled={isPending}
              className={cn("h-10 rounded-lg text-sm", fe.booking_since_year && "border-red-400")}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Section 2: Channel Manager ────────────────────────────────── */}
      <SectionCard
        title="Channel Manager"
        desc="A channel manager syncs availability across booking platforms."
      >
        <ToggleSwitch
          name="has_channel_manager"
          label="I use a channel manager"
          hint="e.g. RMS Cloud, Cloudbeds, eZee Absolute, SiteMinder"
          checked={hasChannelMgr}
          onChange={setHasChannelMgr}
          disabled={isPending}
        />

        {hasChannelMgr && (
          <FieldRow label="Channel Manager Name" error={fe.channel_manager_name}>
            <Input
              name="channel_manager_name"
              defaultValue={hotel.channel_manager_name ?? ""}
              placeholder="e.g. Cloudbeds"
              disabled={isPending}
              className="h-10 rounded-lg text-sm"
            />
          </FieldRow>
        )}
      </SectionCard>

      {/* ── Section 3: Contact Information ────────────────────────────── */}
      <SectionCard
        title="Contact Information"
        desc="Visible to DreamsYatri team only — not shown on public listing."
      >
        {/* Email */}
        <FieldRow label="Contact Email" error={fe.contact_email}>
          <Input
            name="contact_email"
            type="email"
            defaultValue={hotel.contact_email ?? ""}
            placeholder="reservations@yourhotel.com"
            disabled={isPending}
            className={cn("h-10 rounded-lg text-sm", fe.contact_email && "border-red-400")}
          />
        </FieldRow>

        {/* Mobile */}
        <FieldRow label="Mobile Number" error={fe.contact_mobile}>
          <div className="flex gap-2">
            <Input
              name="contact_mobile_cc"
              defaultValue={hotel.contact_mobile_cc ?? "+91"}
              className="h-10 w-16 rounded-lg text-sm text-center shrink-0"
              disabled={isPending}
            />
            <Input
              name="contact_mobile"
              type="tel"
              maxLength={10}
              defaultValue={hotel.contact_mobile ?? ""}
              placeholder="10-digit number"
              disabled={isPending}
              className={cn("h-10 rounded-lg text-sm flex-1", fe.contact_mobile && "border-red-400")}
            />
          </div>
        </FieldRow>

        {/* WhatsApp */}
        <ToggleSwitch
          name="whatsapp_same_as_mobile"
          label="WhatsApp is the same as mobile"
          checked={whatsappSame}
          onChange={setWhatsappSame}
          disabled={isPending}
        />

        {!whatsappSame && (
          <FieldRow label="WhatsApp Number" error={fe.contact_whatsapp}>
            <div className="flex gap-2">
              <Input
                value="+91"
                readOnly
                className="h-10 w-16 rounded-lg text-sm text-center shrink-0 bg-neutral-50"
              />
              <Input
                name="contact_whatsapp"
                type="tel"
                maxLength={10}
                defaultValue={hotel.contact_whatsapp ?? ""}
                placeholder="10-digit number"
                disabled={isPending}
                className="h-10 rounded-lg text-sm flex-1"
              />
            </div>
          </FieldRow>
        )}

        {/* Landline */}
        <FieldRow label="Landline (optional)" error={fe.contact_landline}>
          <Input
            name="contact_landline"
            type="tel"
            defaultValue={hotel.contact_landline ?? ""}
            placeholder="e.g. 01772-123456"
            disabled={isPending}
            className="h-10 rounded-lg text-sm"
          />
        </FieldRow>
      </SectionCard>

    </form>
  );
}
