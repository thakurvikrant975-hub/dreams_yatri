"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  AlertTriangle, BadgeCheck, BedDouble, Building2, CheckCircle2,
  CircleAlert, ExternalLink, History, ImageIcon, Loader2, Mail, MapPin,
  Pencil, PawPrint, RotateCcw, Search, ShieldCheck, Tags, UtensilsCrossed, XCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { ApprovalBadge } from "../ApprovalBadge";
import {
  APPROVAL_SECTIONS, SECTION_LABELS, summarizeChecklist,
  type ApprovalSectionKey, type ChecklistItem,
} from "../approval-checklist";
import {
  approveHotel, reopenHotelApproval, requestHotelChanges,
  type HotelApprovalDetail,
} from "../actions";

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

type HistoryEntry = {
  id: string;
  operation: string;
  description: string | null;
  by: string;
  at: Date;
  notes: string | null;
  flags: string[];
};

const money = (n: number | null | undefined) => (n != null ? `₹${n.toLocaleString("en-IN")}` : null);

const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

const imageSrc = (url: string | null | undefined) =>
  !url ? null : url.startsWith("http") ? url : `${R2}/${url}`;

// ── Small presentational helpers ─────────────────────────────────────────────

function Section({
  title, icon: Icon, id, children, className = "",
}: {
  title: string; icon: React.ElementType; id?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div id={id} className={`rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden scroll-mt-4 ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200/50">
        <Icon className="size-4 text-dashboard-primary" />
        <h3 className="text-sm font-semibold text-dashboard-base-content">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "";
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">{label}</p>
      <div className="text-sm text-dashboard-base-content mt-0.5">
        {empty ? <span className="text-dashboard-base-content/40">Not provided</span> : value}
      </div>
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

function chips(items: string[] | null | undefined) {
  if (!items || items.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{items.map((it) => <Chip key={it}>{it.replace(/_/g, " ")}</Chip>)}</div>;
}

/** hotel_rooms.amenities is written as either a string[] or { selected: string[] }. */
function amenityList(amenities: unknown): string[] {
  if (Array.isArray(amenities)) return amenities.filter((a): a is string => typeof a === "string");
  if (amenities && typeof amenities === "object" && "selected" in amenities) {
    const sel = (amenities as { selected?: unknown }).selected;
    return Array.isArray(sel) ? sel.filter((a): a is string => typeof a === "string") : [];
  }
  return [];
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function HotelReviewClient({
  detail,
  history,
}: {
  detail: HotelApprovalDetail;
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [approveOpen, setApproveOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [note, setNote] = useState("");
  const [changeNotes, setChangeNotes] = useState("");
  const [flags, setFlags] = useState<ApprovalSectionKey[]>([]);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(
    () =>
      summarizeChecklist({
        name: detail.name,
        description: detail.description,
        thumbnail: detail.thumbnail,
        category: detail.category,
        destination_id: detail.destination_id,
        address: detail.address,
        city: detail.city,
        state: detail.state,
        country: detail.country,
        pincode: detail.pincode,
        business_phone: detail.business_phone,
        business_email: detail.business_email,
        b2b_email: detail.b2b_email,
        check_in_time: detail.check_in_time,
        check_out_time: detail.check_out_time,
        meta_title: detail.meta_title,
        meta_desc: detail.meta_desc,
        margin_percentage: detail.margin_percentage,
        gst_percentage: detail.gst_percentage,
        imageCount: detail.imageCount,
        childPolicyCount: detail.childPolicyCount,
        rooms: detail.rooms.map((r) => ({ name: r.name, pricingCount: r.pricing.length, imageCount: r.images.length })),
      }),
    [detail],
  );

  const bySection = useMemo(() => {
    const map = new Map<ApprovalSectionKey, ChecklistItem[]>();
    for (const item of summary.items) {
      map.set(item.section, [...(map.get(item.section) ?? []), item]);
    }
    return map;
  }, [summary]);

  function openChanges() {
    setError(null);
    setChangeNotes("");
    // Pre-tick whatever the automated checks already flag — the manager edits
    // from there rather than starting from a blank slate.
    setFlags(summary.weakSections);
    setChangesOpen(true);
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const res = await approveHotel(detail.id, note);
      if (res.ok) {
        toast.success(`"${detail.name}" marked approved`);
        setApproveOpen(false);
        setNote("");
        router.refresh();
      } else {
        setError(res.error ?? "Failed to approve");
      }
    });
  }

  function handleRequestChanges() {
    setError(null);
    startTransition(async () => {
      const res = await requestHotelChanges(detail.id, changeNotes, flags);
      if (res.ok) {
        toast.success("Changes requested — the hotel team will see your notes");
        setChangesOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to save");
      }
    });
  }

  function handleReopen() {
    startTransition(async () => {
      const res = await reopenHotelApproval(detail.id);
      if (res.ok) {
        toast.success("Back in the review queue");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to re-open");
      }
    });
  }

  const decided = detail.approval_status !== "PENDING";
  const totalRoomPhotos = detail.rooms.reduce((n, r) => n + r.images.length, 0);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold text-dashboard-base-content">{detail.name}</h1>
            <ApprovalBadge status={detail.approval_status} />
            {!detail.is_active && <Chip tone="bad">Inactive</Chip>}
            {detail.owner && <Chip>Owner-listed · {detail.listing_status}</Chip>}
          </div>
          <p className="text-sm text-dashboard-base-content/60 mt-1">
            {detail.destination?.name ?? "No destination"} · {[detail.city, detail.state].filter(Boolean).join(", ") || "No city"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/dashboard/hotels/${detail.id}`}>
              <Pencil className="size-3.5" />
              Edit hotel
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/hotels/${detail.slug}`} target="_blank">
              <ExternalLink className="size-3.5" />
              View live page
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Decision panel ── */}
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 text-sm text-dashboard-base-content/70">
            <p>
              {detail.approval_reviewed_at
                ? <>Last reviewed {new Date(detail.approval_reviewed_at).toLocaleString()}{detail.reviewerName ? ` by ${detail.reviewerName}` : ""}</>
                : "Never reviewed by a manager."}
            </p>
            <p className="flex items-center gap-1.5">
              {summary.requiredFailed === 0 ? (
                <><CheckCircle2 className="size-3.5 text-emerald-600" /> All {summary.items.filter((i) => i.required).length} required content checks pass.</>
              ) : (
                <><AlertTriangle className="size-3.5 text-amber-600" /> {summary.requiredFailed} required check{summary.requiredFailed === 1 ? "" : "s"} failing — see the checklist below.</>
              )}
            </p>
            {detail.approval_status === "CHANGES_REQUESTED" && detail.approval_notes && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-200 px-3 py-2 max-w-xl">
                <CircleAlert className="size-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Changes requested</p>
                  <p className="text-xs text-red-600 mt-0.5">{detail.approval_notes}</p>
                  {detail.approval_flags.length > 0 && (
                    <p className="text-[11px] text-red-500/80 mt-1">
                      Sections flagged: {detail.approval_flags.map((f) => SECTION_LABELS[f as ApprovalSectionKey] ?? f).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}
            {detail.approval_status === "APPROVED" && detail.approval_notes && (
              <p className="text-emerald-700 text-xs">Note: {detail.approval_notes}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {decided && (
              <Button variant="outline" className="gap-1.5" disabled={isPending} onClick={handleReopen}>
                <RotateCcw className="size-4" />
                Re-open review
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={isPending}
              onClick={openChanges}
            >
              <XCircle className="size-4" />
              Request changes
            </Button>
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isPending || detail.approval_status === "APPROVED"}
              onClick={() => { setError(null); setNote(""); setApproveOpen(true); }}
            >
              <BadgeCheck className="size-4" />
              Approve
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-dashboard-base-content/45 border-t border-dashboard-base-300 pt-2">
          Approval is a content sign-off only — it does not publish or hide the hotel. Unapproved hotels stay live and bookable.
        </p>
      </div>

      {/* ── Checklist ── */}
      <Section title={`Content checklist — ${summary.readinessPct}% ready`} icon={ShieldCheck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {APPROVAL_SECTIONS.map(({ key, label }) => {
            const items = bySection.get(key) ?? [];
            if (items.length === 0) return null;
            const failing = items.filter((i) => !i.ok && i.required).length;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/60">{label}</p>
                  {failing > 0 && <Chip tone="bad">{failing} missing</Chip>}
                </div>
                {items.map((item) => (
                  <div key={item.label} className="flex items-start gap-2">
                    {item.ok
                      ? <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      : item.required
                        ? <XCircle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                        : <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className={`text-sm ${item.ok ? "text-dashboard-base-content/70" : "text-dashboard-base-content"}`}>
                        {item.label}
                        {!item.required && <span className="text-dashboard-base-content/40 text-xs"> · optional</span>}
                      </p>
                      {!item.ok && item.detail && (
                        <p className="text-xs text-dashboard-base-content/50">{item.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Basics / Location / Contact ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Basics" icon={Building2}>
          <Field label="Category" value={detail.category} />
          <Field label="Stay type" value={detail.stay_type} />
          <Field label="Slug" value={detail.slug} />
          <Field label="Thumbnail" value={
            imageSrc(detail.thumbnail) ? (
              <Image src={imageSrc(detail.thumbnail)!} alt={detail.name} width={0} height={0} sizes="160px"
                className="h-auto max-h-24 w-auto max-w-40 rounded-lg border mt-1" />
            ) : null
          } />
          <Field label="Description" value={
            detail.description ? (
              <span className="block max-h-40 overflow-y-auto whitespace-pre-wrap text-dashboard-base-content/80">
                {detail.description}
              </span>
            ) : null
          } />
        </Section>

        <Section title="Location" icon={MapPin}>
          <Field label="Destination" value={detail.destination?.name} />
          <Field label="Address" value={[detail.address, detail.landmark].filter(Boolean).join(", ") || null} />
          <Field label="City / State" value={[detail.city, detail.state].filter(Boolean).join(", ") || null} />
          <Field label="Country / Pincode" value={[detail.country, detail.pincode].filter(Boolean).join(" · ") || null} />
          <Field label="Mapped location" value={detail.location?.name} />
          <Field label="Map pin" value={
            detail.latitude != null && detail.longitude != null ? (
              <Link href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`} target="_blank"
                className="text-dashboard-primary hover:underline inline-flex items-center gap-1">
                {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                <ExternalLink className="size-3" />
              </Link>
            ) : null
          } />
        </Section>

        <Section title="Contact & commercials" icon={Mail}>
          <Field label="Business phone" value={detail.business_phone} />
          <Field label="Business email" value={detail.business_email} />
          <Field label="WhatsApp" value={detail.whatsapp_number} />
          <Field label="B2B email" value={detail.b2b_email} />
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashboard-base-300">
            <Field label="Margin" value={`${detail.margin_percentage}%`} />
            <Field label="GST" value={`${detail.gst_percentage}%`} />
            <Field label="Check-in" value={detail.check_in_time} />
            <Field label="Check-out" value={detail.check_out_time} />
          </div>
          {detail.owner && (
            <div className="pt-2 border-t border-dashboard-base-300 space-y-2">
              <Field label="Listed by owner" value={detail.owner.businessName || detail.owner.name} />
              <Field label="Owner contact" value={[detail.owner.email, detail.owner.phone && `${detail.owner.phone_cc ?? ""} ${detail.owner.phone}`].filter(Boolean).join(" · ") || null} />
            </div>
          )}
        </Section>
      </div>

      {/* ── Rooms & rates ── */}
      <Section title={`Rooms & rates (${detail.rooms.length})`} icon={BedDouble}>
        {detail.rooms.length === 0 ? (
          <p className="text-sm text-red-500">No active rooms on this hotel — nothing can be sold.</p>
        ) : (
          <div className="space-y-4">
            {detail.rooms.map((room) => {
              const amenities = amenityList(room.amenities);
              return (
                <div key={room.id} className="rounded-lg border border-dashboard-base-300 p-3 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold">{room.name}</p>
                      <p className="text-xs text-dashboard-base-content/60">
                        {room.room_type ?? "No room type"}
                        {room.view_type ? ` · ${room.view_type} view` : ""}
                        {room.area_sqft ? ` · ${room.area_sqft} ${room.area_unit ?? "sqft"}` : ""}
                        {room.bed_type ? ` · ${room.bed_count} × ${room.bed_type}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Chip tone={room.is_bookable ? "good" : "bad"}>{room.is_bookable ? "Open for sale" : "Closed"}</Chip>
                      <Chip>{room.num_rooms} unit{room.num_rooms === 1 ? "" : "s"}</Chip>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-dashboard-base-content/70">
                    <p>Occupancy: {room.base_adults}–{room.max_adults} adults, {room.base_children}–{room.max_children} children</p>
                    <p>Max total: {room.max_occupancy}</p>
                    <p>Extra bed capacity: {room.extra_bed_capacity}</p>
                    <p>Child cot: {room.child_cot_available ? "Yes" : "No"}</p>
                  </div>

                  {amenities.length > 0 && chips(amenities)}
                  {room.description && <p className="text-xs text-dashboard-base-content/60 italic">{room.description}</p>}

                  {room.images.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {room.images.map((img) => {
                        const src = imageSrc(img.thumbnail || img.url);
                        return src ? (
                          <div key={img.id} className="relative w-20 h-16 rounded-lg overflow-hidden border border-dashboard-base-300 shrink-0">
                            <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600">No photos on this room.</p>
                  )}

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50 mb-1.5">
                      Rate plans ({room.pricing.length})
                    </p>
                    {room.pricing.length === 0 ? (
                      <p className="text-xs text-red-500">No active rate plan — this room cannot be quoted.</p>
                    ) : (
                      <div className="space-y-2">
                        {room.pricing.map((plan) => (
                          <div key={plan.id} className="rounded-lg border border-dashboard-base-300 p-3 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <p className="text-sm font-semibold">
                                {plan.plan_name || "Standard plan"}
                                <span className="font-normal text-dashboard-base-content/50">
                                  {plan.meal_type ? ` · ${plan.meal_type.name}` : ""}
                                  {plan.diet_type ? ` · ${plan.diet_type.name}` : ""}
                                </span>
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Chip tone="good">{money(plan.price_per_night)}/night</Chip>
                                {plan.weekend_price_per_night != null && <Chip>weekend {money(plan.weekend_price_per_night)}</Chip>}
                                {plan.original_price != null && <Chip>was {money(plan.original_price)}</Chip>}
                                <Chip>{plan.margin_percentage}% margin</Chip>
                                <Chip>{plan.gst_percentage}% GST</Chip>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-dashboard-base-content/70">
                              <p>Extra adult: {money(plan.extra_bed_rate) ?? "—"}</p>
                              <p>Extra child: {money(plan.extra_child_rate) ?? "—"}</p>
                              <p>Valid: {plan.valid_from ? `${fmtDate(plan.valid_from)} → ${fmtDate(plan.valid_to)}` : "Always"}</p>
                              <p>Cancellation: {plan.cancellation_policy ?? "—"}</p>
                            </div>
                            {plan.occupancy_prices.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {plan.occupancy_prices.map((o) => (
                                  <Chip key={o.occupancy}>{o.occupancy} pax — {money(o.price_per_night)}</Chip>
                                ))}
                              </div>
                            )}
                            {plan.seasons.length > 0 && (
                              <div className="pt-2 border-t border-dashboard-base-300 space-y-1.5">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">
                                  Seasonal rates ({plan.seasons.length})
                                </p>
                                {plan.seasons.map((s) => (
                                  <div key={s.id} className="rounded-md bg-dashboard-base-200/50 px-2.5 py-2 text-xs space-y-1">
                                    <p className="font-medium">{s.season_name} — {fmtDate(s.valid_from)} → {fmtDate(s.valid_to)}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      <Chip tone="good">{money(s.price_per_night)}/night</Chip>
                                      {s.weekend_price_per_night != null && <Chip>weekend {money(s.weekend_price_per_night)}</Chip>}
                                      {s.extra_bed_rate != null && <Chip>extra adult {money(s.extra_bed_rate)}</Chip>}
                                      {s.extra_child_rate != null && <Chip>extra child {money(s.extra_child_rate)}</Chip>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {plan.notes && <p className="text-xs text-dashboard-base-content/60 italic">{plan.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Meals, add-ons, child policies ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title={`Meal pricing (${detail.mealPricing.length})`} icon={UtensilsCrossed}>
          {detail.mealPricing.length === 0 ? (
            <p className="text-sm text-dashboard-base-content/40">No meal pricing set</p>
          ) : detail.mealPricing.map((m) => (
            <div key={m.id} className="space-y-1">
              <p className="text-sm font-medium">{m.label} <span className="text-dashboard-base-content/50 font-normal">({m.meal_type})</span></p>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="good">{money(m.price)}</Chip>
                {m.weekend_price != null && <Chip>weekend {money(m.weekend_price)}</Chip>}
                {m.veg_price != null && <Chip>veg {money(m.veg_price)}</Chip>}
                {m.non_veg_price != null && <Chip>non-veg {money(m.non_veg_price)}</Chip>}
              </div>
            </div>
          ))}
        </Section>

        <Section title={`Add-ons (${detail.addons.length})`} icon={Tags}>
          {detail.addons.length === 0 ? (
            <p className="text-sm text-dashboard-base-content/40">No add-ons</p>
          ) : detail.addons.map((a) => (
            <div key={a.id} className="space-y-0.5">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-dashboard-base-content/60">
                {money(a.price)} ({a.charge_type}){a.weekend_price != null ? ` · weekend ${money(a.weekend_price)}` : ""}
              </p>
              {a.description && <p className="text-xs text-dashboard-base-content/50">{a.description}</p>}
            </div>
          ))}
        </Section>

        <Section title={`Child policies (${detail.childPolicies.length})`} icon={PawPrint}>
          {detail.childPolicies.length === 0 ? (
            <p className="text-sm text-amber-600">None set — children will be charged as adults.</p>
          ) : detail.childPolicies.map((c) => (
            <div key={c.id} className="space-y-0.5">
              <p className="text-sm font-medium">Age {c.age_from}–{c.age_to}</p>
              <p className="text-xs text-dashboard-base-content/60">
                {c.charge_type.replace(/_/g, " ")}{c.price != null ? ` · ${money(c.price)}` : ""}
              </p>
              {c.description && <p className="text-xs text-dashboard-base-content/50">{c.description}</p>}
            </div>
          ))}
        </Section>
      </div>

      {/* ── Photos ── */}
      <Section title={`Photos (${detail.imageCount} property · ${totalRoomPhotos} room)`} icon={ImageIcon}>
        {detail.imageCategories.every((c) => c.images.length === 0) ? (
          <p className="text-sm text-red-500">No photos uploaded.</p>
        ) : (
          <div className="space-y-4">
            {detail.imageCategories.map((cat) => (
              <div key={cat.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-dashboard-base-content/60 flex items-center gap-1.5">
                  {cat.name}
                  <span className="text-dashboard-base-content/40 font-normal">({cat.images.length})</span>
                  {cat.is_required && cat.images.length === 0 && <Chip tone="bad">required, empty</Chip>}
                </p>
                {cat.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {cat.images.map((img) => {
                      const src = imageSrc(img.thumbnail || img.url);
                      return src ? (
                        <div key={img.id} className="relative w-24 h-18 rounded-lg overflow-hidden border border-dashboard-base-300 shrink-0">
                          <Image src={src} alt={img.alt ?? cat.name} fill sizes="96px" className="object-cover" />
                          {img.is_primary && (
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5">Primary</span>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── SEO ── */}
      <Section title="SEO" icon={Search}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Meta title" value={detail.meta_title} />
          <Field label="Meta description" value={detail.meta_desc} />
        </div>
      </Section>

      {/* ── Review history ── */}
      <Section title={`Review history (${history.length})`} icon={History}>
        {history.length === 0 ? (
          <p className="text-sm text-dashboard-base-content/40">No approval decisions recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-2.5 border-b border-dashboard-base-300 last:border-0 pb-3 last:pb-0">
                {h.operation === "approve_hotel"
                  ? <BadgeCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  : h.operation === "request_hotel_changes"
                    ? <CircleAlert className="size-4 text-red-500 shrink-0 mt-0.5" />
                    : <RotateCcw className="size-4 text-dashboard-base-content/50 shrink-0 mt-0.5" />}
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm">{h.description}</p>
                  <p className="text-xs text-dashboard-base-content/50">
                    {h.by} · {new Date(h.at).toLocaleString()}
                  </p>
                  {h.flags.length > 0 && (
                    <p className="text-[11px] text-dashboard-base-content/50">
                      Flagged: {h.flags.map((f) => SECTION_LABELS[f as ApprovalSectionKey] ?? f).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Approve dialog ── */}
      <Dialog open={approveOpen} onOpenChange={(open) => { if (!isPending) setApproveOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve &quot;{detail.name}&quot;</DialogTitle>
            <DialogDescription>
              Marks the hotel as checked and complete. It stays live either way — this records your sign-off.
            </DialogDescription>
          </DialogHeader>

          {summary.requiredFailed > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-200 px-3 py-2">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 space-y-1">
                <p className="font-semibold">{summary.requiredFailed} required check{summary.requiredFailed === 1 ? "" : "s"} still failing</p>
                <p>{summary.weakSections.map((s) => SECTION_LABELS[s]).join(", ")}</p>
                <p className="text-amber-600/80">You can still approve if these are acceptable.</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="approve-note">Note (optional)</Label>
            <Textarea
              id="approve-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rates verified against the Feb contract; photos re-shot last week."
              rows={3}
              maxLength={1000}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={isPending}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <BadgeCheck className="size-4 mr-1.5" />}
              Approve hotel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Request changes dialog ── */}
      <Dialog open={changesOpen} onOpenChange={(open) => { if (!isPending) setChangesOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes on &quot;{detail.name}&quot;</DialogTitle>
            <DialogDescription>
              Flag the sections that need work and say what&apos;s missing. The hotel stays live meanwhile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Sections that need work</Label>
            <div className="grid grid-cols-2 gap-2">
              {APPROVAL_SECTIONS.map(({ key, label }) => (
                <Checkbox
                  key={key}
                  checked={flags.includes(key)}
                  onChange={() =>
                    setFlags((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]))
                  }
                  label={
                    <span className="flex items-center gap-1">
                      {label}
                      {summary.weakSections.includes(key) && <AlertTriangle className="size-3 text-amber-500" />}
                    </span>
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-notes">What needs fixing</Label>
            <Textarea
              id="change-notes"
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="e.g. Deluxe room has no rate plan for the peak season, and the description is a single line."
              rows={4}
              maxLength={1000}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleRequestChanges} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Request changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
