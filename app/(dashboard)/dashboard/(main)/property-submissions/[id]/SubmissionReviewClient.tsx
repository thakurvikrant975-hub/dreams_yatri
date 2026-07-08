"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  Building2, MapPin, Phone, Mail, Star, BedDouble, Bath, ChefHat,
  ImageIcon, ShieldCheck, Banknote, CheckCircle2, XCircle, Clock,
  ExternalLink, FileText, Loader2, AlertTriangle,
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

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;
const MIN_TOTAL_PHOTOS = 6;
const MIN_ROOM_TAGGED_PHOTOS = 2;
const ROOM_TAG = "Bedroom";

// Decimal fields converted to plain numbers by the server page before this
// component ever sees them (Prisma.Decimal can't cross the RSC boundary).
type Detail = Omit<SubmissionDetail, "latitude" | "longitude" | "prop_base_rate" | "prop_extra_adult" | "prop_child_rate" | "hotelRooms"> & {
  latitude: number | null;
  longitude: number | null;
  prop_base_rate: number | null;
  prop_extra_adult: number | null;
  prop_child_rate: number | null;
  hotelRooms: {
    id: number; name: string; bed_type: string | null; area_sqft: number | null;
    max_adults: number; max_children: number; max_occupancy: number;
    pricing: { id: number; plan_name: string | null; price_per_night: number; gst_percentage: number }[];
  }[];
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
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

function yesNo(v: boolean | null | undefined): React.ReactNode {
  if (v == null) return <span className="text-dashboard-base-content/40">Not set</span>;
  return v ? <Chip tone="good">Yes</Chip> : <Chip tone="bad">No</Chip>;
}

function isYesAmenity(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "object" && v !== null && "yes" in v) return (v as { yes?: unknown }).yes === true;
  return false;
}

export function SubmissionReviewClient({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canDecide = detail.listing_status === "SUBMITTED" || detail.listing_status === "UNDER_REVIEW";
  const isHomestay = detail.property_category === "HOMESTAY_VILLA";

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
          <Field label="Year Built" value={detail.year_built} />
          <Field label="Contact" value={
            (detail.contact_email || detail.contact_mobile) ? (
              <span className="space-y-0.5 block">
                {detail.contact_email && <span className="block">{detail.contact_email}</span>}
                {detail.contact_mobile && <span className="block">{detail.contact_mobile_cc} {detail.contact_mobile}</span>}
              </span>
            ) : null
          } />
        </Section>

        <Section title="Location" icon={MapPin}>
          <Field label="Address" value={[detail.address, detail.landmark].filter(Boolean).join(", ") || null} />
          <Field label="City / State" value={[detail.city, detail.state].filter(Boolean).join(", ") || null} />
          <Field label="Pincode" value={detail.pincode} />
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
              <div key={i} className="text-sm border-b border-dashboard-base-300 last:border-0 pb-2 last:pb-0">
                <p className="font-medium">{b.name || `Bedroom ${i + 1}`}</p>
                <p className="text-xs text-dashboard-base-content/60">
                  {Object.entries(b.beds ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} × ${k.replace(/_/g, " ")}`).join(", ") || "No beds set"}
                  {b.has_bathroom ? ` · ${b.bathroom_type || "Private bathroom"}` : ""}
                  {b.has_balcony ? " · Balcony" : ""}
                </p>
              </div>
            ))}
          </Section>

          <Section title={`Bathrooms (${bathrooms.length})`} icon={Bath}>
            {bathrooms.length === 0 ? <p className="text-sm text-dashboard-base-content/40">None added</p> : bathrooms.map((b, i) => (
              <div key={i} className="text-sm border-b border-dashboard-base-300 last:border-0 pb-2 last:pb-0">
                <p className="font-medium">{b.name || `Bathroom ${i + 1}`}</p>
                <p className="text-xs text-dashboard-base-content/60">{b.type || "Type not set"}</p>
              </div>
            ))}
          </Section>

          {detail.hs_has_kitchen && (
            <Section title="Kitchen" icon={ChefHat}>
              <Field label="Type" value={kitchen?.type} />
              <Field label="Meal types" value={kitchen?.meal_types} />
            </Section>
          )}

          {spaces.length > 0 && (
            <Section title={`Additional Spaces (${spaces.length})`} icon={Building2}>
              {spaces.map((s, i) => (
                <p key={s.id ?? i} className="text-sm">{s.name || s.label}</p>
              ))}
            </Section>
          )}

          <Section title="Pricing" icon={Banknote} className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Base rate / night" value={detail.prop_base_rate != null ? `₹${detail.prop_base_rate}` : null} />
              <Field label="Extra adult" value={detail.prop_extra_adult != null ? `₹${detail.prop_extra_adult}` : null} />
              <Field label="Child rate" value={detail.prop_child_rate != null ? `₹${detail.prop_child_rate}` : null} />
              <Field label="Max occupancy" value={detail.prop_max_occupancy} />
            </div>
          </Section>
        </div>
      ) : (
        <Section title={`Rooms (${detail.hotelRooms.length})`} icon={BedDouble}>
          {detail.hotelRooms.length === 0 ? (
            <p className="text-sm text-dashboard-base-content/40">No rooms added</p>
          ) : detail.hotelRooms.map((room) => (
            <div key={room.id} className="border-b border-dashboard-base-300 last:border-0 pb-3 last:pb-0">
              <p className="text-sm font-medium">{room.name}</p>
              <p className="text-xs text-dashboard-base-content/60">
                {room.bed_type ?? "—"} · Up to {room.max_adults} adults, {room.max_children} children
              </p>
              {room.pricing.length === 0 ? (
                <p className="text-xs text-red-500 mt-1">No rate plans</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {room.pricing.map((p) => (
                    <Chip key={p.id}>{p.plan_name || "Standard"} — ₹{p.price_per_night}/night</Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
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

      {/* ── Policies ── */}
      <Section title="Policies" icon={ShieldCheck}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Check-in" value={detail.check_in_time} />
          <Field label="Check-out" value={detail.check_out_time} />
          <Field label="Cancellation" value={detail.cancellation_policy} />
          <Field label="Smoking allowed" value={yesNo(detail.smoking_allowed)} />
          <Field label="Unmarried couples" value={yesNo(detail.allow_unmarried_couples)} />
          <Field label="Guests under 18" value={yesNo(detail.allow_guests_below_18)} />
          <Field label="Pets allowed" value={yesNo(detail.pets_allowed)} />
          <Field label="Wheelchair accessible" value={yesNo(detail.wheelchair_accessible)} />
        </div>
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
