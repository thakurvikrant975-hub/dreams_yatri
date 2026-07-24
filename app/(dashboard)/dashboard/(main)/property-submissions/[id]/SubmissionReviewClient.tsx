"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  Building2, MapPin, Phone, Mail, Star, BedDouble, Bath, ChefHat,
  ImageIcon, ShieldCheck, Banknote, CheckCircle2, XCircle, Clock,
  ExternalLink, FileText, Loader2, AlertTriangle, UtensilsCrossed,
  Tags, UserCog, PawPrint, Sofa,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { approveSubmission, rejectSubmission, type SubmissionDetail } from "../actions";
import type { BedroomDetail } from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/bedroom/[n]/bedroom-types";
import type {
  BathroomDetail, KitchenDetail, SpaceItem,
} from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/tabs/homestay-rooms-types";
import {
  computeEffectiveWizardStep, totalTabsFor, wizardCompletenessPct,
} from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/wizard-progress";

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;
const MIN_TOTAL_PHOTOS = 6;
const MIN_ROOM_TAGGED_PHOTOS = 2;
const ROOM_TAG = "Bedroom";

const money = (n: number | null | undefined) => n != null ? `₹${n.toLocaleString("en-IN")}` : null;

// Room JSON shapes, as written by room-actions.ts — see BedsEntry/BathroomEntry/AmenitiesJson below.
type BedsEntry = { label: string; kind: string; beds: { type: string; count: number }[] };
type BathroomEntry = { type: string; attached_to: string };
type AmenitiesJson = { selected?: string[]; details?: Record<string, unknown> };

// Decimal fields converted to plain numbers by the server page before this
// component ever sees them (Prisma.Decimal can't cross the RSC boundary).
type Detail = Omit<
  SubmissionDetail,
  "latitude" | "longitude" | "prop_base_rate" | "prop_extra_adult" | "prop_child_rate" | "hotelRooms" | "meal_pricing" | "addons"
> & {
  latitude: number | null;
  longitude: number | null;
  prop_base_rate: number | null;
  prop_extra_adult: number | null;
  prop_child_rate: number | null;
  hotelRooms: {
    id: number; name: string; room_type: string | null; bed_type: string | null; beds: unknown; bed_count: number;
    area_sqft: number | null; area_unit: string | null; view_type: string | null;
    max_adults: number; max_children: number; max_occupancy: number;
    base_adults: number; base_children: number;
    num_rooms: number; num_bedrooms: number | null; num_living_rooms: number | null;
    extra_bed_capacity: number; child_cot_available: boolean; meal_plan: string | null;
    amenities: unknown; features: unknown; bathroom: unknown; facilities: unknown; description: string | null;
    is_bookable: boolean;
    images: { id: number; url: string; thumbnail: string | null; is_primary: boolean }[];
    pricing: {
      id: number; plan_name: string | null; price_per_night: number; original_price: number | null;
      extra_bed_rate: number | null; extra_child_rate: number | null; gst_percentage: number;
      valid_from: Date | string | null; valid_to: Date | string | null; cancellation_policy: string | null;
      occupancy_prices: { occupancy: number; price_per_night: number; original_price: number | null }[];
      seasons: {
        id: number; season_name: string; valid_from: Date | string; valid_to: Date | string;
        price_per_night: number; weekend_price_per_night: number | null; original_price: number | null;
        extra_bed_rate: number | null; extra_child_rate: number | null;
        occupancy_prices: { occupancy: number; price_per_night: number; original_price: number | null }[];
      }[];
    }[];
  }[];
  meal_pricing: {
    id: number; meal_type: string; label: string; price: number; weekend_price: number | null;
    veg_price: number | null; non_veg_price: number | null;
    seasons: { id: number; season_name: string; valid_from: Date | string; valid_to: Date | string; price: number; weekend_price: number | null }[];
  }[];
  addons: { id: number; label: string; description: string | null; charge_type: string; price: number; weekend_price: number | null }[];
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  DRAFT: { label: "Draft", icon: Clock, className: "bg-slate-500/10 text-slate-500 border-slate-200" },
  SUBMITTED: { label: "Submitted", icon: Clock, className: "bg-slate-500/10 text-slate-600 border-slate-200" },
  UNDER_REVIEW: { label: "Under Review", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  APPROVED: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  LIVE: { label: "Live", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejected", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, icon: Clock, className: "bg-muted text-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.className} text-sm h-6 px-2.5`}>
      <Icon className="size-3.5" />
      {cfg.label}
    </Badge>
  );
}

function Section({
  title, icon: Icon, children, className = "",
}: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200/50">
        <Icon className="size-4 text-dashboard-primary" />
        <h3 className="text-sm font-semibold text-dashboard-base-content">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">{label}</p>
      <p className="text-sm text-dashboard-base-content mt-0.5">{value ?? <span className="text-dashboard-base-content/40">Not provided</span>}</p>
    </div>
  );
}

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "good" | "bad" }) {
  const cls = tone === "good"
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
    : tone === "bad"
      ? "bg-red-500/10 text-red-600 border-red-200"
      : "bg-dashboard-base-200 text-dashboard-base-content/70 border-dashboard-base-300";
  return <Badge variant="outline" className={`${cls} font-normal`}>{children}</Badge>;
}

function chips(items: string[] | null | undefined): React.ReactNode {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => <Chip key={it}>{it.replace(/_/g, " ")}</Chip>)}
    </div>
  );
}

function yesNo(v: boolean | null | undefined): React.ReactNode {
  if (v == null) return <span className="text-dashboard-base-content/40">Not set</span>;
  return v ? <Chip tone="good">Yes</Chip> : <Chip tone="bad">No</Chip>;
}

function isYesAmenity(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "object" && v !== null && "yes" in v) return (v as { yes?: unknown }).yes === true;
  return false;
}

function fmtDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Room JSON renderers ──────────────────────────────────────────────────────

function BedsSummary({ beds }: { beds: unknown }) {
  const entries = Array.isArray(beds) ? (beds as BedsEntry[]) : [];
  if (entries.length === 0) return <span className="text-dashboard-base-content/40 text-sm">Not set</span>;
  return (
    <div className="space-y-1">
      {entries.map((e, i) => (
        <p key={i} className="text-sm">
          <span className="font-medium">{e.label}:</span>{" "}
          {e.beds.length > 0
            ? e.beds.map((b) => `${b.count} × ${b.type.replace(/_/g, " ")}`).join(", ")
            : <span className="text-dashboard-base-content/40">No beds set</span>}
        </p>
      ))}
    </div>
  );
}

function BathroomSummary({ bathroom }: { bathroom: unknown }) {
  const entries = Array.isArray(bathroom) ? (bathroom as BathroomEntry[]) : [];
  if (entries.length === 0) return <span className="text-dashboard-base-content/40 text-sm">Not set</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((b, i) => (
        <Chip key={i}>{b.type.replace(/_/g, " ")} — {b.attached_to.replace(/_/g, " ")}</Chip>
      ))}
    </div>
  );
}

function RoomAmenities({ amenities }: { amenities: unknown }) {
  const a = (amenities ?? {}) as AmenitiesJson;
  const selected = a.selected ?? [];
  if (selected.length === 0) return <span className="text-dashboard-base-content/40 text-sm">None selected</span>;
  return chips(selected);
}

// ── Room pricing card (base plan + occupancy tiers + seasons) ───────────────

function OccupancyTiers({ tiers }: { tiers: { occupancy: number; price_per_night: number; original_price: number | null }[] }) {
  if (tiers.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {tiers.map((t) => (
        <Chip key={t.occupancy}>{t.occupancy} pax — {money(t.price_per_night)}{t.original_price ? ` (was ${money(t.original_price)})` : ""}</Chip>
      ))}
    </div>
  );
}

function RoomPricingCard({ plan }: { plan: Detail["hotelRooms"][number]["pricing"][number] }) {
  return (
    <div className="rounded-lg border border-dashboard-base-300 p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold">{plan.plan_name || "Standard Plan"}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip tone="good">{money(plan.price_per_night)}/night</Chip>
          {plan.original_price != null && <Chip>was {money(plan.original_price)}</Chip>}
          <Chip>{plan.gst_percentage}% GST</Chip>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-dashboard-base-content/70">
        <p>Extra adult: {plan.extra_bed_rate != null ? money(plan.extra_bed_rate) : "—"}</p>
        <p>Extra child: {plan.extra_child_rate != null ? money(plan.extra_child_rate) : "—"}</p>
        <p>Valid: {plan.valid_from ? `${fmtDate(plan.valid_from)} → ${fmtDate(plan.valid_to)}` : "Always"}</p>
        <p>Cancellation: {plan.cancellation_policy ?? "—"}</p>
      </div>
      {plan.occupancy_prices.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">Occupancy tiers</p>
          <OccupancyTiers tiers={plan.occupancy_prices} />
        </div>
      )}
      {plan.seasons.length > 0 && (
        <div className="pt-2 border-t border-dashboard-base-300 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">Seasonal overrides ({plan.seasons.length})</p>
          {plan.seasons.map((s) => (
            <div key={s.id} className="rounded-md bg-dashboard-base-200/50 px-2.5 py-2 text-xs space-y-1">
              <p className="font-medium">{s.season_name} — {fmtDate(s.valid_from)} → {fmtDate(s.valid_to)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="good">{money(s.price_per_night)}/night</Chip>
                {s.weekend_price_per_night != null && <Chip>weekend {money(s.weekend_price_per_night)}</Chip>}
                {s.extra_bed_rate != null && <Chip>extra adult {money(s.extra_bed_rate)}</Chip>}
                {s.extra_child_rate != null && <Chip>extra child {money(s.extra_child_rate)}</Chip>}
              </div>
              <OccupancyTiers tiers={s.occupancy_prices} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubmissionReviewClient({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canDecide = detail.listing_status === "SUBMITTED" || detail.listing_status === "UNDER_REVIEW";
  const isHomestay = detail.property_category === "HOMESTAY_VILLA";

  const totalTabs = totalTabsFor(detail.property_category);
  const reachedStep = computeEffectiveWizardStep({
    property_category: detail.property_category,
    address: detail.address, city: detail.city, state: detail.state, country: detail.country,
    pincode: detail.pincode, latitude: detail.latitude, wizard_step: detail.wizard_step,
    roomCount: detail.hotelRooms.length, imageCount: detail.images.length,
  });
  const completenessPct = wizardCompletenessPct(reachedStep, totalTabs);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveSubmission(detail.id);
      if (result.ok) {
        toast.success("Property approved and is now live");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to approve");
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectSubmission(detail.id, reason);
      if (result.ok) {
        toast.success("Property rejected — the owner will see your reason");
        setRejectOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to reject");
      }
    });
  }

  const amenities = (detail.property_amenities as Record<string, unknown> | null) ?? {};
  const yesAmenities = Object.entries(amenities).filter(([, v]) => isYesAmenity(v));
  const pools = (() => {
    const v = amenities["Swimming Pool"];
    if (typeof v === "object" && v !== null && "pools" in v) {
      return (v as { pools?: unknown[] }).pools ?? [];
    }
    return [];
  })();

  const totalPhotos = detail.images.length;
  const roomTaggedPhotos = detail.images.filter((img) => img.tags.includes(ROOM_TAG)).length;
  const photosOk = totalPhotos >= MIN_TOTAL_PHOTOS && roomTaggedPhotos >= MIN_ROOM_TAGGED_PHOTOS;

  const bedrooms = (detail.hs_bedroom_details as unknown as BedroomDetail[] | null) ?? [];
  const bathrooms = (detail.hs_bathroom_details as unknown as BathroomDetail[] | null) ?? [];
  const kitchen = detail.hs_kitchen_details as unknown as KitchenDetail | null;
  const spaces = (detail.hs_space_items as unknown as SpaceItem[] | null) ?? [];

  const documents = (detail.property_documents as Record<string, string> | null) ?? {};

  const hasExtraBedInfo = detail.extra_bed_included || detail.provide_bed_extra_adults || detail.provide_bed_extra_kids
    || detail.extra_cot_charge_adult || detail.extra_mattress_charge_adult || detail.extra_sofa_charge_adult
    || detail.extra_cot_charge_child || detail.extra_mattress_charge_child || detail.extra_sofa_charge_child || detail.extra_crib_charge_child;

  const hasCaretakerInfo = detail.caretaker_stays != null || detail.caretaker_details || detail.caretaker_availability
    || (detail.caretaker_services?.length ?? 0) > 0 || (detail.caretaker_knowledge?.length ?? 0) > 0
    || detail.self_checkin_smart_door != null || detail.host_greets_helps != null || detail.caretaker_greets_helps != null
    || detail.building_staff_keys != null || detail.caretaker_helps_cleaning != null;

  const hasPetInfo = detail.pets_allowed != null || detail.pets_on_property != null || (detail.allowed_pet_types?.length ?? 0) > 0
    || detail.pet_extra_charges != null || detail.pets_restricted_areas || detail.pets_without_leash != null
    || detail.pet_food_available != null || detail.pet_charge_amount || detail.pet_count != null;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold text-dashboard-base-content">{detail.name}</h1>
            <StatusBadge status={detail.listing_status} />
          </div>
          <p className="text-sm text-dashboard-base-content/60 mt-1">
            {isHomestay ? "Homestay/Villa" : "Hotel"} · {detail.city ?? "—"}{detail.state ? `, ${detail.state}` : ""}
          </p>
        </div>
        {(detail.listing_status === "LIVE" || detail.listing_status === "APPROVED") && (
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/hotels/${detail.slug}`} target="_blank">
              <ExternalLink className="size-3.5" />
              View live page
            </Link>
          </Button>
        )}
      </div>

      {/* ── Decision panel ── */}
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1 text-sm text-dashboard-base-content/70">
            {detail.listing_status === "DRAFT" && (
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 text-slate-500 shrink-0" />
                <span>Not yet submitted for review — the owner is still filling this out.</span>
                <span className="font-semibold text-dashboard-base-content">{completenessPct}% complete</span>
              </div>
            )}
            {detail.submitted_at && <p>Submitted {new Date(detail.submitted_at).toLocaleString()}</p>}
            {detail.listing_status === "REJECTED" && detail.rejection_reason && (
              <div className="mt-1 flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-200 px-3 py-2 max-w-xl">
                <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Rejection reason shown to owner</p>
                  <p className="text-xs text-red-600 mt-0.5">{detail.rejection_reason}</p>
                </div>
              </div>
            )}
            {(detail.listing_status === "LIVE" || detail.listing_status === "APPROVED") && detail.approved_at && (
              <p className="text-emerald-700">
                Approved {new Date(detail.approved_at).toLocaleString()}
                {detail.approvedByName ? ` by ${detail.approvedByName}` : ""}
              </p>
            )}
            {!photosOk && (
              <p className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="size-3.5" />
                Photos requirement not met: {totalPhotos}/{MIN_TOTAL_PHOTOS} total, {roomTaggedPhotos}/{MIN_ROOM_TAGGED_PHOTOS} tagged &quot;{ROOM_TAG}&quot;
              </p>
            )}
          </div>

          {canDecide && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={isPending}
                onClick={() => { setError(null); setReason(""); setRejectOpen(true); }}
              >
                <XCircle className="size-4" />
                Reject
              </Button>
              <Button
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isPending}
                onClick={handleApprove}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Approve &amp; Publish
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Owner, Basic Info, Location ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Owner" icon={Building2}>
          <Field label="Name" value={detail.owner?.name} />
          <Field label="Business" value={detail.owner?.businessName} />
          <Field label="Email" value={detail.owner?.email && (
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />{detail.owner.email}</span>
          )} />
          <Field label="Phone" value={detail.owner?.phone && (
            <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />{detail.owner.phone_cc} {detail.owner.phone}</span>
          )} />
        </Section>

        <Section title="Basic Info" icon={Star}>
          <Field label="Category" value={isHomestay ? "Homestay/Villa" : "Hotel"} />
          <Field label="Sub-type" value={detail.property_sub_type} />
          {!isHomestay && (
            <Field label="Star Rating" value={detail.star_rating != null ? `${detail.star_rating} ★` : null} />
          )}
          {isHomestay && (
            <>
              <Field label="Hosted as" value={detail.hosted_as} />
              <Field label="Host lives at property" value={yesNo(detail.host_lives_at_property)} />
            </>
          )}
          <Field label="Year Built" value={detail.year_built} />
          <Field label="Accepting bookings since" value={detail.booking_since_year} />
          <Field label="Channel manager" value={detail.has_channel_manager ? (detail.channel_manager_name || "Yes") : "No"} />
          <Field label="Contact" value={
            (detail.contact_email || detail.contact_mobile) ? (
              <span className="space-y-0.5 block">
                {detail.contact_email && <span className="block">{detail.contact_email}</span>}
                {detail.contact_mobile && (
                  <span className="block">
                    {detail.contact_mobile_cc} {detail.contact_mobile}
                    {detail.contact_mobile_verified && <span className="text-emerald-600"> · verified</span>}
                  </span>
                )}
                {!detail.whatsapp_same_as_mobile && detail.contact_whatsapp && <span className="block">WhatsApp: {detail.contact_whatsapp}</span>}
                {detail.contact_landline && <span className="block">Landline: {detail.contact_landline}</span>}
              </span>
            ) : null
          } />
        </Section>

        <Section title="Location" icon={MapPin}>
          <Field label="Address" value={[detail.address, detail.landmark].filter(Boolean).join(", ") || null} />
          <Field label="City / State" value={[detail.city, detail.state].filter(Boolean).join(", ") || null} />
          <Field label="Country / Pincode" value={[detail.country, detail.pincode].filter(Boolean).join(" · ") || null} />
          <Field label="Map Pin" value={
            detail.latitude != null && detail.longitude != null ? (
              <Link
                href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
                target="_blank"
                className="text-dashboard-primary hover:underline inline-flex items-center gap-1"
              >
                {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                <ExternalLink className="size-3" />
              </Link>
            ) : null
          } />
        </Section>
      </div>

      {/* ── Amenities ── */}
      <Section title={`Amenities (${yesAmenities.length} enabled)`} icon={ShieldCheck}>
        {yesAmenities.length === 0 ? (
          <p className="text-sm text-dashboard-base-content/40">No amenities marked yes</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {yesAmenities.map(([name]) => <Chip key={name}>{name}</Chip>)}
          </div>
        )}
        {pools.length > 0 && (
          <div className="pt-2 border-t border-dashboard-base-300 space-y-1.5">
            <p className="text-xs font-semibold text-dashboard-base-content/60">Swimming pools ({pools.length})</p>
            {pools.map((p, i) => {
              const pool = p as { id?: string; name?: string; type?: string; suitableFor?: string };
              return (
                <p key={pool.id ?? i} className="text-sm">
                  {pool.name || "Unnamed pool"} — {[pool.type, pool.suitableFor].filter(Boolean).join(" · ")}
                </p>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Rooms & Spaces ── */}
      {isHomestay ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title={`Bedrooms (${bedrooms.length})`} icon={BedDouble}>
            {bedrooms.length === 0 ? <p className="text-sm text-dashboard-base-content/40">None added</p> : bedrooms.map((b, i) => (
              <div key={i} className="text-sm border-b border-dashboard-base-300 last:border-0 pb-2.5 last:pb-0 space-y-1">
                <p className="font-medium">{b.name || `Bedroom ${i + 1}`}</p>
                <p className="text-xs text-dashboard-base-content/60">
                  {Object.entries(b.beds ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} × ${k.replace(/_/g, " ")}`).join(", ") || "No beds set"}
                </p>
                <p className="text-xs text-dashboard-base-content/60">
                  Sleeps {b.base_adults}–{b.max_adults} adults
                  {b.floor_level ? ` · ${b.floor_level}` : ""}
                  {b.size_value ? ` · ${b.size_value} ${b.size_unit}` : ""}
                  {b.view ? ` · ${b.view} view` : ""}
                </p>
                <p className="text-xs text-dashboard-base-content/60">
                  {b.has_bathroom ? `Private bathroom${b.bathroom_type ? ` (${b.bathroom_type})` : ""}` : "No private bathroom"}
                  {b.has_balcony ? ` · Balcony${b.balcony_furniture ? " (furnished)" : ""}` : ""}
                  {b.has_extra_bed ? ` · Extra bed available${b.extra_bed_type ? ` (${b.extra_bed_type})` : ""}` : ""}
                </p>
                {b.amenities?.length > 0 && chips(b.amenities)}
                {b.description && <p className="text-xs text-dashboard-base-content/50 italic">{b.description}</p>}
              </div>
            ))}
          </Section>

          <Section title={`Bathrooms (${bathrooms.length})`} icon={Bath}>
            {bathrooms.length === 0 ? <p className="text-sm text-dashboard-base-content/40">None added</p> : bathrooms.map((b, i) => (
              <div key={i} className="text-sm border-b border-dashboard-base-300 last:border-0 pb-2.5 last:pb-0 space-y-1">
                <p className="font-medium">{b.name || `Bathroom ${i + 1}`}</p>
                <p className="text-xs text-dashboard-base-content/60">
                  {b.type || "Type not set"}
                  {b.floor_level ? ` · ${b.floor_level}` : ""}
                  {b.size_value ? ` · ${b.size_value} ${b.size_unit}` : ""}
                </p>
                <p className="text-xs text-dashboard-base-content/60">
                  {[b.has_bathtub && "Bathtub", b.has_shower && "Shower", b.has_hot_water && "Hot water"].filter(Boolean).join(" · ") || "No fixtures noted"}
                </p>
                {b.amenities?.length > 0 && chips(b.amenities)}
              </div>
            ))}
          </Section>

          {detail.hs_has_kitchen && (
            <Section title="Kitchen" icon={ChefHat}>
              <Field label="Type" value={kitchen?.type} />
              <Field label="Meal types" value={kitchen?.meal_types} />
              <Field label="Accessible to guests" value={yesNo(kitchen?.is_accessible)} />
              <Field label="Staff help" value={kitchen?.staff_help?.length ? chips(kitchen.staff_help) : null} />
              <Field label="Appliances" value={kitchen?.appliances?.length ? chips(kitchen.appliances) : null} />
              {kitchen?.description && <Field label="Description" value={kitchen.description} />}
            </Section>
          )}

          {spaces.length > 0 && (
            <Section title={`Additional Spaces (${spaces.length})`} icon={Building2}>
              {spaces.map((s, i) => (
                <div key={s.id ?? i} className="text-sm border-b border-dashboard-base-300 last:border-0 pb-2.5 last:pb-0 space-y-1">
                  <p className="font-medium">{s.name || s.label}</p>
                  <p className="text-xs text-dashboard-base-content/60">
                    {s.access_type ? `${s.access_type.replace(/_/g, " ")} access` : ""}
                    {s.floor_level ? ` · ${s.floor_level}` : ""}
                    {s.room_size ? ` · ${s.room_size} ${s.room_size_unit}` : ""}
                    {s.room_view ? ` · ${s.room_view} view` : ""}
                  </p>
                  {s.amenities?.length > 0 && chips(s.amenities)}
                </div>
              ))}
            </Section>
          )}

          <Section title="Meals, Pricing & Availability" icon={UtensilsCrossed} className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Base rate / night" value={money(detail.prop_base_rate)} />
              <Field label="Extra adult" value={money(detail.prop_extra_adult)} />
              <Field label="Child rate" value={money(detail.prop_child_rate)} />
              <Field label="Max occupancy" value={detail.prop_max_occupancy} />
              <Field label="Base occupancy" value={detail.prop_base_occupancy} />
              <Field label="Max adults / children" value={[detail.prop_max_adults, detail.prop_max_children].filter((v) => v != null).join(" / ") || null} />
              <Field label="Units available" value={detail.prop_num_units} />
              <Field label="Meal option" value={detail.prop_meal_option} />
            </div>
            {(detail.prop_avail_from || detail.prop_avail_to) && (
              <Field label="Available" value={`${fmtDate(detail.prop_avail_from)} → ${fmtDate(detail.prop_avail_to)}`} />
            )}
          </Section>
        </div>
      ) : (
        <Section title={`Rooms (${detail.hotelRooms.length})`} icon={BedDouble}>
          {detail.hotelRooms.length === 0 ? (
            <p className="text-sm text-dashboard-base-content/40">No rooms added</p>
          ) : (
            <div className="space-y-4">
              {detail.hotelRooms.map((room) => (
                <div key={room.id} className="rounded-lg border border-dashboard-base-300 p-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold">{room.name}</p>
                      <p className="text-xs text-dashboard-base-content/60">
                        {room.room_type ?? "—"}
                        {room.view_type ? ` · ${room.view_type} view` : ""}
                        {room.area_sqft ? ` · ${room.area_sqft} ${room.area_unit ?? "sqft"}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Chip tone={room.is_bookable ? "good" : "bad"}>{room.is_bookable ? "Open for sale" : "Closed"}</Chip>
                      <Chip>{room.num_rooms} room{room.num_rooms !== 1 ? "s" : ""}</Chip>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-dashboard-base-content/70">
                    <p>Occupancy: {room.base_adults}–{room.max_adults} adults, {room.base_children}–{room.max_children} children</p>
                    <p>Max total: {room.max_occupancy}</p>
                    <p>Bedrooms/Living: {room.num_bedrooms ?? "—"} / {room.num_living_rooms ?? "—"}</p>
                    <p>Meal plan: {room.meal_plan ?? "—"}</p>
                    <p>Extra bed capacity: {room.extra_bed_capacity}</p>
                    <p>Child cot available: {room.child_cot_available ? "Yes" : "No"}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50 mb-1">Beds</p>
                    <BedsSummary beds={room.beds} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50 mb-1">Bathrooms</p>
                    <BathroomSummary bathroom={room.bathroom} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50 mb-1">Amenities</p>
                    <RoomAmenities amenities={room.amenities} />
                  </div>
                  {room.description && <p className="text-xs text-dashboard-base-content/60 italic">{room.description}</p>}

                  {room.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {room.images.map((img) => (
                        <div key={img.id} className="relative w-20 h-16 rounded-lg overflow-hidden border border-dashboard-base-300 shrink-0">
                          <Image src={img.thumbnail || img.url} alt="" fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50 mb-1.5">
                      Rate plans ({room.pricing.length})
                    </p>
                    {room.pricing.length === 0 ? (
                      <p className="text-xs text-red-500">No rate plans</p>
                    ) : (
                      <div className="space-y-2">
                        {room.pricing.map((p) => <RoomPricingCard key={p.id} plan={p} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Meal Pricing (tiered, both categories) ── */}
      {detail.meal_pricing.length > 0 && (
        <Section title={`Meal Pricing (${detail.meal_pricing.length})`} icon={UtensilsCrossed}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {detail.meal_pricing.map((m) => (
              <div key={m.id} className="rounded-lg border border-dashboard-base-300 p-3 space-y-1.5">
                <p className="text-sm font-semibold">{m.label} <span className="text-dashboard-base-content/50 font-normal">({m.meal_type})</span></p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="good">{money(m.price)}</Chip>
                  {m.weekend_price != null && <Chip>weekend {money(m.weekend_price)}</Chip>}
                  {m.veg_price != null && <Chip>veg {money(m.veg_price)}</Chip>}
                  {m.non_veg_price != null && <Chip>non-veg {money(m.non_veg_price)}</Chip>}
                </div>
                {m.seasons.length > 0 && (
                  <div className="pt-1.5 border-t border-dashboard-base-300 space-y-1">
                    {m.seasons.map((s) => (
                      <p key={s.id} className="text-xs text-dashboard-base-content/70">
                        {s.season_name} ({fmtDate(s.valid_from)} → {fmtDate(s.valid_to)}): {money(s.price)}
                        {s.weekend_price != null ? ` · weekend ${money(s.weekend_price)}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {!isHomestay && (detail.meal_price_breakfast || detail.meal_price_lunch || detail.meal_price_dinner) && (
        <Section title="Meal Rack Prices" icon={UtensilsCrossed}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Breakfast" value={detail.meal_price_breakfast} />
            <Field label="Lunch" value={detail.meal_price_lunch} />
            <Field label="Dinner" value={detail.meal_price_dinner} />
          </div>
        </Section>
      )}

      {/* ── Add-ons ── */}
      {detail.addons.length > 0 && (
        <Section title={`Add-ons (${detail.addons.length})`} icon={Tags}>
          <div className="flex flex-wrap gap-2">
            {detail.addons.map((a) => (
              <Chip key={a.id}>{a.label} — {money(a.price)} ({a.charge_type}){a.weekend_price != null ? `, weekend ${money(a.weekend_price)}` : ""}</Chip>
            ))}
          </div>
        </Section>
      )}

      {/* ── Extra Beds & Charges ── */}
      {hasExtraBedInfo && (
        <Section title="Extra Beds & Charges" icon={Sofa}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Extra bed included" value={yesNo(detail.extra_bed_included)} />
            <Field label="Extra bed for adults" value={yesNo(detail.provide_bed_extra_adults)} />
            <Field label="Extra bed for kids" value={yesNo(detail.provide_bed_extra_kids)} />
          </div>
          {detail.provide_bed_extra_adults && (
            <div className="pt-2 border-t border-dashboard-base-300">
              <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1.5">Adults</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Availability" value={detail.extra_bed_adults_avail} />
                <Field label="Types" value={detail.extra_bed_adults_types?.length ? chips(detail.extra_bed_adults_types) : null} />
                <Field label="Cot charge" value={detail.extra_cot_charge_adult} />
                <Field label="Mattress charge" value={detail.extra_mattress_charge_adult} />
                <Field label="Sofa bed charge" value={detail.extra_sofa_charge_adult} />
              </div>
            </div>
          )}
          {detail.provide_bed_extra_kids && (
            <div className="pt-2 border-t border-dashboard-base-300">
              <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1.5">Children</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Availability" value={detail.extra_bed_kids_avail} />
                <Field label="Types" value={detail.extra_bed_kids_types?.length ? chips(detail.extra_bed_kids_types) : null} />
                <Field label="Cot charge" value={detail.extra_cot_charge_child} />
                <Field label="Mattress charge" value={detail.extra_mattress_charge_child} />
                <Field label="Sofa bed charge" value={detail.extra_sofa_charge_child} />
                <Field label="Crib charge" value={detail.extra_crib_charge_child} />
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Policies ── */}
      <Section title="Policies" icon={ShieldCheck}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Check-in" value={detail.check_in_time} />
          <Field label="Check-out" value={detail.check_out_time} />
          {detail.has_check_in_end_time && <Field label="Check-in until" value={detail.check_in_end_time} />}
          <Field label="Cancellation" value={detail.cancellation_policy} />
          <Field label="24-hour check-in" value={yesNo(detail.checkin_24_hours)} />
          <Field label="Smoking allowed" value={yesNo(detail.smoking_allowed)} />
          {detail.smoking_areas && <Field label="Smoking areas" value={detail.smoking_areas} />}
          <Field label="Parties/events allowed" value={yesNo(detail.parties_events_allowed)} />
          <Field label="Unmarried couples" value={yesNo(detail.allow_unmarried_couples)} />
          {detail.allow_unmarried_couples && <Field label="Show couple tag" value={yesNo(detail.show_couple_tag)} />}
          <Field label="Guests under 18" value={yesNo(detail.allow_guests_below_18)} />
          <Field label="Male-only groups" value={yesNo(detail.allow_male_only_groups)} />
          <Field label="Same-city ID guests" value={yesNo(detail.allow_same_city_id)} />
          <Field label="Wheelchair accessible" value={yesNo(detail.wheelchair_accessible)} />
          <Field label="Outside visitors allowed" value={yesNo(detail.allow_outside_visitors)} />
          <Field label="Entry/exit restrictions" value={yesNo(detail.entry_exit_restrictions)} />
          {detail.noise_policy && <Field label="Noise policy" value={detail.noise_policy} />}
          <Field label="Infant free occupancy" value={yesNo(detail.infant_free_occupancy)} />
          <Field label="Infant complimentary food" value={yesNo(detail.infant_complimentary_food)} />
        </div>
        {detail.acceptable_id_proofs?.length > 0 && (
          <div className="pt-2 border-t border-dashboard-base-300">
            <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1.5">Acceptable ID proofs</p>
            {chips(detail.acceptable_id_proofs)}
          </div>
        )}
        {detail.custom_policy && (
          <div className="pt-2 border-t border-dashboard-base-300">
            <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1">Custom policy</p>
            <p className="text-sm">{detail.custom_policy}</p>
          </div>
        )}
      </Section>

      {/* ── Pets ── */}
      {hasPetInfo && (
        <Section title="Pet Policy" icon={PawPrint}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Pets on property" value={yesNo(detail.pets_on_property)} />
            <Field label="Pets allowed for guests" value={yesNo(detail.pets_allowed)} />
            <Field label="Extra charges" value={yesNo(detail.pet_extra_charges)} />
            <Field label="Charge amount" value={detail.pet_charge_amount} />
            <Field label="Pet count on property" value={detail.pet_count} />
            <Field label="Allowed off-leash" value={yesNo(detail.pets_without_leash)} />
            <Field label="Pet food available" value={yesNo(detail.pet_food_available)} />
          </div>
          {detail.allowed_pet_types?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1.5">Allowed pet types</p>
              {chips(detail.allowed_pet_types)}
            </div>
          )}
          {detail.pets_restricted_areas && <Field label="Restricted areas" value={detail.pets_restricted_areas} />}
        </Section>
      )}

      {/* ── Caretaker / House Help ── */}
      {hasCaretakerInfo && (
        <Section title="Caretaker & House Help" icon={UserCog}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Caretaker stays on-site" value={yesNo(detail.caretaker_stays)} />
            <Field label="Availability" value={detail.caretaker_availability} />
            <Field label="Host greets/helps" value={yesNo(detail.host_greets_helps)} />
            <Field label="Caretaker greets/helps" value={yesNo(detail.caretaker_greets_helps)} />
            <Field label="Caretaker helps cleaning" value={yesNo(detail.caretaker_helps_cleaning)} />
            <Field label="Self check-in / smart door" value={yesNo(detail.self_checkin_smart_door)} />
            <Field label="Building staff has keys" value={yesNo(detail.building_staff_keys)} />
            <Field label="Kitchen available" value={yesNo(detail.food_kitchen_available)} />
          </div>
          {detail.caretaker_details && <Field label="Details" value={detail.caretaker_details} />}
          {detail.caretaker_services?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1.5">Services offered</p>
              {chips(detail.caretaker_services)}
            </div>
          )}
          {detail.caretaker_knowledge?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1.5">Local knowledge</p>
              {chips(detail.caretaker_knowledge)}
            </div>
          )}
        </Section>
      )}

      {/* ── Photos ── */}
      <Section title={`Photos & Videos (${totalPhotos})`} icon={ImageIcon}>
        {totalPhotos === 0 ? (
          <p className="text-sm text-dashboard-base-content/40">No photos uploaded</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {detail.images.map((img) => (
              <div key={img.id} className="relative w-24 h-18 rounded-lg overflow-hidden border border-dashboard-base-300 shrink-0">
                {img.url ? (
                  <Image src={img.url} alt={img.tags[0] ?? "Photo"} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-dashboard-base-200">
                    <ImageIcon className="size-4 text-dashboard-base-content/30" />
                  </div>
                )}
                {img.tags[0] && (
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">{img.tags[0]}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Finance & Legal ── */}
      <Section title="Finance & Legal" icon={Banknote}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Bank Name" value={detail.bank_name} />
          <Field label="Account Number" value={detail.bank_account_number} />
          <Field label="IFSC" value={detail.bank_ifsc_code} />
          <Field label="PAN" value={detail.pan_number} />
          <Field label="GSTIN" value={detail.gstin_number} />
          <Field label="Business Type" value={detail.business_type} />
          <Field label="MSME Number" value={detail.msme_number} />
          {isHomestay && (
            <>
              <Field label="Ownership type" value={detail.ownership_type} />
              <Field label="Has registration doc" value={yesNo(detail.has_registration_doc)} />
              <Field label="Relationship doc type" value={detail.relationship_doc_type} />
              <Field label="ID proof type" value={detail.id_proof_type} />
              <Field label="TAN Number" value={detail.tan_number} />
            </>
          )}
        </div>
        {Object.keys(documents).length > 0 && (
          <div className="pt-3 border-t border-dashboard-base-300">
            <p className="text-xs font-semibold text-dashboard-base-content/60 mb-1.5">Uploaded documents</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(documents).map(([docType, url]) => (
                <Button key={docType} variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href={url} target="_blank">
                    <FileText className="size-3.5" />
                    {docType.replace(/_/g, " ")}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Reject dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!isPending) setRejectOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject &quot;{detail.name}&quot;</DialogTitle>
            <DialogDescription>
              This reason will be shown to the property owner so they can fix the issue and resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Rejection reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bank account details don't match the PAN holder name. Please re-verify and resubmit."
              rows={4}
              maxLength={1000}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Reject Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
