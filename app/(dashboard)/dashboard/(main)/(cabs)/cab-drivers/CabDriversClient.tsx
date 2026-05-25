"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { format, isPast, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Car, Users, UserCheck, UserX, Phone, MapPin, Pencil, Trash2,
  CreditCard, Shield, Banknote, X, Star, Clock, TrendingUp,
  CheckCircle2, AlertCircle, ChevronRight, Wallet, BadgeCheck,
  ShieldOff,
} from "lucide-react";
import { SteeringWheelIcon } from "@phosphor-icons/react";

import { Button }   from "../../components/ui/button";
import { Badge }    from "../../components/ui/badge";
import { Switch }   from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "../../components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters }    from "../../components/dashboard/Tablefilters";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import { PageHeader }      from "../../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";

import { CreateDriverSheet, EditDriverSheet } from "./CabDriverSheet";
import {
  getCabDrivers, toggleDriverActive, toggleDriverVerified, deleteCabDriver,
  type CabDriverFull, type CabDriverVehicle,
} from "./actions";

// ── Constants ──────────────────────────────────────────────────────────────────

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  try { return format(new Date(iso), "dd MMM yyyy"); } catch { return null; }
}

type ExpiryState = "ok" | "soon" | "expired";

function getExpiryState(iso: string | null | undefined): ExpiryState | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isPast(d)) return "expired";
  if (differenceInDays(d, new Date()) <= 30) return "soon";
  return "ok";
}

function ExpiryBadge({ iso }: { iso: string | null | undefined }) {
  const state = getExpiryState(iso);
  if (!state) return null;
  const label = fmtDate(iso) ?? "";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
      state === "expired"
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : state === "soon"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    }`}>
      {state === "expired" && <AlertCircle className="h-2.5 w-2.5" />}
      {state === "soon"    && <Clock       className="h-2.5 w-2.5" />}
      {state === "ok"      && <CheckCircle2 className="h-2.5 w-2.5" />}
      {state === "expired" ? "Expired" : state === "soon" ? `Expiring · ${label}` : label}
    </span>
  );
}

function Avatar({ src, name, size = "md" }: { src?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (src) {
    return (
      <Image
        src={`${R2}/${src}`}
        alt={name}
        width={64}
        height={64}
        className={`${dim} rounded-sm object-cover shrink-0 ring-1 ring-border`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-border`}>
      <span className={`font-semibold text-primary`}>{initials}</span>
    </div>
  );
}

// ── Star Rating display ───────────────────────────────────────────────────────

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled  = i < Math.floor(rating);
        const partial = !filled && i < rating;
        return (
          <span key={i} className="relative inline-block">
            <Star className="h-3.5 w-3.5 text-muted-foreground/30" />
            {(filled || partial) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? "100%" : `${(rating % 1) * 100}%` }}
              >
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── Detail row helper ─────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 w-36">{label}</span>
      <span className="text-sm font-medium text-right flex-1">{value}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2.5">
      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
    </div>
  );
}

// ── Trip & Rating placeholder panel ──────────────────────────────────────────

function TripSummaryPanel() {
  // Placeholder — will be populated once trip-assignment data is linked
  const stats = [
    { label: "Total Trips",     value: "—",  icon: TrendingUp,  color: "text-blue-600"  },
    { label: "Advance Paid",    value: "—",  icon: Wallet,      color: "text-amber-600" },
    { label: "Balance Pending", value: "—",  icon: Clock,       color: "text-orange-600"},
    { label: "Total Earned",    value: "—",  icon: Banknote,    color: "text-green-600" },
  ];

  return (
    <div className="space-y-3">
      {/* Mini stat cards */}
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border bg-muted/30 px-3 py-2.5 flex items-center gap-2"
          >
            <s.icon className={`h-4 w-4 shrink-0 ${s.color}`} />
            <div>
              <p className="text-[11px] text-muted-foreground leading-none">{s.label}</p>
              <p className="text-sm font-semibold mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty trip list */}
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
        <Car className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">No trips assigned yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Trip history will appear here once this driver is assigned to travel packages.
        </p>
      </div>
    </div>
  );
}

function RatingPanel({
  avgRating,
  ratingCount,
}: {
  driverName:  string;
  avgRating:   number | null;
  ratingCount: number;
}) {
  const hasRatings = avgRating != null && ratingCount > 0;

  return (
    <div className="space-y-3">
      {/* Overall rating row */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Average Rating</p>
          <div className="flex items-center gap-2 mt-1">
            <StarRating rating={avgRating ?? 0} />
            <span className="text-xs text-muted-foreground">
              {hasRatings ? `${ratingCount} review${ratingCount !== 1 ? "s" : ""}` : "No ratings yet"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${hasRatings ? "text-foreground" : "text-muted-foreground/40"}`}>
            {hasRatings ? (avgRating ?? 0).toFixed(1) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">out of 5</p>
        </div>
      </div>

      {/* Rating breakdown bars */}
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((stars) => (
          <div key={stars} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-3">{stars}</span>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: "0%" }} />
            </div>
            <span className="text-[11px] text-muted-foreground w-4 text-right">0</span>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {!hasRatings && (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center">
          <Star className="h-7 w-7 mx-auto text-amber-300/50 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No customer reviews yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Ratings from customers will appear here after completed trips.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Driver View Sheet ─────────────────────────────────────────────────────────

type ViewTab = "overview" | "documents" | "payment" | "trips" | "ratings";

function DriverViewSheet({
  driver,
  open,
  onOpenChange,
  vehicles,
}: {
  driver:        CabDriverFull | null;
  open:          boolean;
  onOpenChange:  (v: boolean) => void;
  vehicles:      CabDriverVehicle[];
}) {
  const [tab, setTab] = useState<ViewTab>("overview");

  useEffect(() => { if (open) setTab("overview"); }, [open]);

  if (!driver) return null;

  const tabs: { id: ViewTab; label: string }[] = [
    { id: "overview",  label: "Overview"  },
    { id: "documents", label: "Documents" },
    { id: "payment",   label: "Payment"   },
    { id: "trips",     label: "Trips"     },
    { id: "ratings",   label: "Ratings"   },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">

        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={driver.profile_image_key} name={driver.name} size="lg" />
              <div className="min-w-0">
                <SheetTitle className="text-base leading-tight">{driver.name}</SheetTitle>
                {(driver.city || driver.state) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[driver.city, driver.state].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge
                    variant={driver.is_active ? "default" : "secondary"}
                    className={`text-[10px] px-2 py-0.5 border-0 ${
                      driver.is_active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : ""
                    }`}
                  >
                    {driver.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {driver.is_verified && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      <BadgeCheck className="h-2.5 w-2.5" />
                      Verified
                    </Badge>
                  )}
                  {driver.avg_rating != null && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      {driver.avg_rating.toFixed(1)} ({driver.rating_count})
                    </Badge>
                  )}
                  {driver.vehicle && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-dashboard-neutral/60">
                      <Car className="h-2.5 w-2.5" />
                      {driver.vehicle.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <EditDriverSheet
                driver={driver}
                vehicles={vehicles}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                }
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Tab bar */}
        <div className="flex border-b shrink-0 px-2 overflow-x-auto gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">

          {/* ── Overview ── */}
          {tab === "overview" && (
            <div>
              <SectionTitle icon={Phone} title="Contact" />
              <DetailRow label="Mobile"           value={driver.mobile} />
              <DetailRow label="Secondary Mobile" value={driver.mobile_secondary} />
              <DetailRow label="City"             value={driver.city} />
              <DetailRow label="State"            value={driver.state} />

              {driver.vehicle && (
                <>
                  <SectionTitle icon={Car} title="Vehicle Assignment" />
                  <DetailRow label="Vehicle"      value={driver.vehicle.name} />
                  <DetailRow label="Type"         value={driver.vehicle.type.replace(/_/g, " ")} />
                </>
              )}

              {/* Quick compliance status */}
              <SectionTitle icon={Shield} title="Compliance Status" />
              <div className="space-y-2">
                {[
                  { label: "Driving Licence", expiry: driver.license_expiry, num: driver.license_number },
                  { label: "Vehicle Reg.",    expiry: driver.vehicle_reg_expiry, num: driver.vehicle_reg_number },
                  { label: "Insurance",       expiry: driver.insurance_expiry,   num: "—" },
                ].map((row) => {
                  const state = getExpiryState(row.expiry);
                  return (
                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <p className="text-xs font-medium">{row.label}</p>
                        {row.num !== "—" && row.num && (
                          <p className="text-[11px] text-muted-foreground font-mono">{row.num}</p>
                        )}
                      </div>
                      {state ? (
                        <ExpiryBadge iso={row.expiry} />
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Not added</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-muted-foreground mt-5">
                Added {fmtDate(driver.created_at)} · Updated {fmtDate(driver.updated_at)}
              </p>
            </div>
          )}

          {/* ── Documents ── */}
          {tab === "documents" && (
            <div>
              <SectionTitle icon={CreditCard} title="Driving Licence" />
              <DetailRow label="Licence Number" value={driver.license_number} />
              <DetailRow label="Expiry"         value={<ExpiryBadge iso={driver.license_expiry} />} />

              {driver.license_image_key && (
                <div className="mt-3 mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Licence Photo</p>
                  <Image
                    src={`${R2}/${driver.license_image_key}`}
                    alt="Licence"
                    width={280}
                    height={180}
                    className="rounded-lg object-cover border w-full max-w-xs"
                  />
                </div>
              )}

              <SectionTitle icon={Car} title="Vehicle Registration" />
              <DetailRow label="Reg. Number" value={driver.vehicle_reg_number} />
              <DetailRow label="Reg. Expiry"  value={<ExpiryBadge iso={driver.vehicle_reg_expiry} />} />

              <SectionTitle icon={Shield} title="Insurance" />
              <DetailRow label="Insurance Expiry" value={<ExpiryBadge iso={driver.insurance_expiry} />} />

              {driver.vehicle_image_keys.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2">Vehicle Photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {driver.vehicle_image_keys.map((key, i) => (
                      <Image
                        key={key}
                        src={`${R2}/${key}`}
                        alt={`Vehicle ${i + 1}`}
                        width={120}
                        height={80}
                        className="rounded-lg object-cover border w-full aspect-3/2"
                      />
                    ))}
                  </div>
                </div>
              )}

              {!driver.license_number && !driver.vehicle_reg_number && !driver.insurance_expiry && (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center mt-4">
                  <CreditCard className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No documents added</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Edit this driver to add licence, registration and insurance details.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Payment ── */}
          {tab === "payment" && (
            <div>
              <SectionTitle icon={Banknote} title="Per Trip Rate" />
              {driver.salary_amount ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Agreed Rate</p>
                    <p className="text-xl font-bold mt-0.5">
                      ₹{Number(driver.salary_amount).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      Per Trip
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">
                  No rate set — edit driver to add a per-trip rate.
                </p>
              )}

              {/* Payment flow info */}
              <div className="rounded-lg border bg-muted/20 p-3 mt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Payment Flow
                </p>
                {[
                  { step: "1", label: "Trip Assigned",  desc: "Advance amount released to driver" },
                  { step: "2", label: "Trip Completed", desc: "Balance (remaining) payment released" },
                  { step: "3", label: "Reviewed",       desc: "Customer rates driver · final closure" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-2">
                    <span className="h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {s.step}
                    </span>
                    <div>
                      <p className="text-xs font-medium">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <SectionTitle icon={CreditCard} title="Bank Details" />
              <DetailRow label="Bank Name"      value={driver.bank_name} />
              <DetailRow label="Account Holder" value={driver.bank_account_holder} />
              <DetailRow label="Account No."    value={driver.bank_account_number} />
              <DetailRow label="IFSC Code"      value={driver.bank_ifsc} />
              <DetailRow label="UPI ID"         value={driver.upi_id} />

              {!driver.bank_name && !driver.upi_id && (
                <p className="text-xs text-muted-foreground italic mt-2">
                  No bank details added — edit driver to add payment information.
                </p>
              )}
            </div>
          )}

          {/* ── Trips ── */}
          {tab === "trips" && (
            <div>
              <SectionTitle icon={TrendingUp} title="Trip Summary" />
              <TripSummaryPanel />
            </div>
          )}

          {/* ── Ratings ── */}
          {tab === "ratings" && (
            <div>
              <SectionTitle icon={Star} title="Customer Ratings" />
              <RatingPanel
                driverName={driver.name}
                avgRating={driver.avg_rating}
                ratingCount={driver.rating_count}
              />
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteDriverDialog({ id, name }: { id: number; name: string }) {
  const [isPending, start] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Driver</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              start(async () => {
                const res = await deleteCabDriver(id);
                if (res.success) toast.success("Driver deleted");
                else toast.error(res.message ?? "Failed to delete driver");
              });
            }}
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

type PageData = Awaited<ReturnType<typeof getCabDrivers>>;

export function CabDriversClient({
  initialData,
  vehicles,
  search: initSearch,
  status: initStatus,
  verified: initVerified,
}: {
  initialData: PageData;
  vehicles:    CabDriverVehicle[];
  search:      string;
  status:      string;
  verified:    string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [data, setData]       = useState(initialData);
  const [localSearch, setLocalSearch] = useState(initSearch);
  const [viewDriver, setViewDriver]   = useState<CabDriverFull | null>(null);
  const [viewOpen,   setViewOpen]     = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setData(initialData); }, [initialData]);
  useEffect(() => { setLocalSearch(initSearch); }, [initSearch]);

  // ── URL helpers ─────────────────────────────────────────────────────────────
  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  function handleSearch(value: string) {
    setLocalSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateParam("search", value), 400);
  }

  function buildHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      const res = await toggleDriverActive(id, !current);
      if (!res.success) toast.error(res.message ?? "Failed to update status");
    });
  }

  // ── Toggle verified ──────────────────────────────────────────────────────────
  function handleVerify(id: number, current: boolean) {
    startTransition(async () => {
      const res = await toggleDriverVerified(id, !current);
      if (res.success) toast.success(res.message);
      else toast.error(res.message ?? "Failed to update verification");
    });
  }

  const { rows, total, totalPages, currentPage, limit } = data;

  // ── Page-level stats ─────────────────────────────────────────────────────────
  const activeCount   = rows.filter((d) => d.is_active).length;
  const inactiveCount = rows.filter((d) => !d.is_active).length;
  const assignedCount = rows.filter((d) => d.vehicle_id).length;

  // ── Pagination label ─────────────────────────────────────────────────────────
  const from = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to   = Math.min(currentPage * limit, total);
  const paginationLabel = `Showing ${from}–${to} of ${total} driver${total !== 1 ? "s" : ""}`;

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns: ColumnDef<CabDriverFull>[] = [
    {
      header: "Driver",
      width:  "w-[220px]",
      cell: (d) => (
        <button
          className="flex items-center gap-3 text-left w-full hover:opacity-80 transition-opacity"
          onClick={() => { setViewDriver(d); setViewOpen(true); }}
        >
          <Avatar src={d.profile_image_key} name={d.name} />
          <div className="min-w-0">
            <p className="font-medium text-sm leading-tight truncate">{d.name}</p>
            {(d.city || d.state) && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {[d.city, d.state].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground tabular-nums mt-0.5 flex items-center gap-1">
              <Phone className="h-2.5 w-2.5 shrink-0" />
              {d.mobile}
            </p>
          </div>
        </button>
      ),
    },
    {
      header: "Vehicle",
      cell: (d) =>
        d.vehicle ? (
          <div className="flex items-center gap-2">
            {d.vehicle.image_key ? (
              <Image
                src={`${R2}/${d.vehicle.image_key}`}
                alt={d.vehicle.name}
                width={48}
                height={32}
                className="rounded-md object-cover border shrink-0 h-8 w-12"
              />
            ) : (
              <div className="h-8 w-12 rounded-md bg-muted flex items-center justify-center shrink-0 border">
                <Car className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{d.vehicle.name}</p>
              <p className="text-[11px] text-muted-foreground">{d.vehicle.type.replace(/_/g, " ")}</p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Unassigned</span>
        ),
    },
    {
      header: "Reg. No.",
      cell: (d) =>
        d.vehicle_reg_number ? (
          <div>
            <p className="text-xs font-mono font-medium">{d.vehicle_reg_number}</p>
            {d.vehicle_reg_expiry && (
              <div className="mt-0.5">
                <ExpiryBadge iso={d.vehicle_reg_expiry} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      header: "Licence",
      cell: (d) =>
        d.license_number ? (
          <div>
            <p className="text-xs font-mono font-medium">{d.license_number}</p>
            {d.license_expiry && (
              <div className="mt-0.5">
                <ExpiryBadge iso={d.license_expiry} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      header: "Verified",
      align:  "center",
      width:  "w-[100px]",
      cell: (d) => (
        <button
          onClick={() => handleVerify(d.id, d.is_verified)}
          disabled={isPending}
          title={d.is_verified ? "Click to remove verification" : "Click to verify driver"}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={d.is_verified ? {
            background: "color-mix(in oklch, var(--color-dashboard-success, #22c55e) 12%, transparent)",
            color:      "var(--color-dashboard-success, #16a34a)",
          } : {
            background: "color-mix(in oklch, var(--color-dashboard-neutral, #6b7280) 10%, transparent)",
            color:      "var(--color-dashboard-neutral, #6b7280)",
          }}
        >
          {d.is_verified
            ? <><BadgeCheck className="h-3.5 w-3.5" /> Verified</>
            : <><ShieldOff  className="h-3 w-3" /> Not verified</>
          }
        </button>
      ),
    },
    {
      header: "Rating",
      align:  "center",
      width:  "w-[100px]",
      cell: (d) =>
        d.avg_rating != null ? (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold tabular-nums">
                {d.avg_rating.toFixed(1)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {d.rating_count} review{d.rating_count !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-0.5">
              {[0,1,2,3,4].map((i) => (
                <Star key={i} className="h-3 w-3 text-muted-foreground/25" />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">No ratings</span>
          </div>
        ),
    },
    {
      header: "Active",
      align:  "center",
      cell: (d) => (
        <Switch
          checked={d.is_active}
          disabled={isPending}
          onCheckedChange={() => handleToggle(d.id, d.is_active)}
        />
      ),
    },
    {
      header: "Actions",
      align:  "right",
      width:  "w-[100px]",
      cell: (d) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground gap-1"
            onClick={() => { setViewDriver(d); setViewOpen(true); }}
          >
            View
            <ChevronRight className="h-3 w-3" />
          </Button>
          <EditDriverSheet driver={d} vehicles={vehicles} />
          <DeleteDriverDialog id={d.id} name={d.name} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Cab Drivers</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <PageHeader
        title="Cab Drivers"
        description="Manage drivers, vehicle assignments, licences and payments"
        icon={SteeringWheelIcon as never}
        actions={<CreateDriverSheet vehicles={vehicles} />}
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard label="Total Drivers"    value={total}         icon={Users}      />
        <StatCard label="Active"           value={activeCount}   icon={UserCheck}  />
        <StatCard label="Inactive"         value={inactiveCount} icon={UserX}      />
        <StatCard label="Vehicle Assigned" value={assignedCount} icon={Car}        />
      </StatGrid>

      {/* Filters + rows-per-page */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <TableFilters
          search={localSearch}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, mobile or city…"
          className="flex-1"
          filters={[
            {
              value:       initStatus,
              onChange:    (v) => updateParam("status", v),
              placeholder: "All Statuses",
              width:       "w-36",
              options: [
                { label: "Active",   value: "active"   },
                { label: "Inactive", value: "inactive" },
              ],
            },
            {
              value:       initVerified,
              onChange:    (v) => updateParam("verified", v),
              placeholder: "All Verifications",
              width:       "w-42",
              options: [
                { label: "Verified",     value: "verified"   },
                { label: "Not Verified", value: "unverified" },
              ],
            },
          ]}
        />

        <Select
          value={String(limit)}
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("limit", v);
            params.delete("page");
            startTransition(() => router.replace(`?${params.toString()}`));
          }}
        >
          <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg focus:ring-dashboard-primary/30 focus:border-dashboard-primary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
            {[10, 20, 50].map((n) => (
              <SelectItem
                key={n}
                value={String(n)}
                className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer"
              >
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(d) => d.id}
        emptyState={
          <TableEmptyState
            title="No drivers found"
            description="Add your first cab driver to get started"
          />
        }
        pagination={{
          currentPage,
          totalPages,
          buildHref,
          label: paginationLabel,
        }}
      />

      {/* View Sheet */}
      <DriverViewSheet
        driver={viewDriver}
        open={viewOpen}
        onOpenChange={setViewOpen}
        vehicles={vehicles}
      />
    </div>
  );
}
