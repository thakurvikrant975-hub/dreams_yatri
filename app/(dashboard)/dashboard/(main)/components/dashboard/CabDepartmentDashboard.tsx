import { Suspense } from "react";
import {
  Car, User2, Wrench, ArrowRight, AlertTriangle, Eye, EyeOff,
  TrendingUp, CheckCircle2, PlusCircle, ShieldCheck, ShieldAlert,
  Zap, MapPin,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/app/lib/utils";
import type { CurrentMember } from "@/app/types/members";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import { getCabDepartmentDashboardData } from "../../actions/cab-department-dashboard-actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(date));
}

function pct(mine: number, total: number) {
  if (total === 0) return 0;
  return Math.round((mine / total) * 100);
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK:       "Hatchback",
  SEDAN:           "Sedan",
  SUV:             "SUV",
  LUXURY_SEDAN:    "Luxury Sedan",
  LUXURY_SUV:      "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller",
  MINI_BUS:        "Mini Bus",
  BUS:             "Bus",
  Rikshaw:         "Rikshaw",
};

const VEHICLE_TYPE_COLORS: Record<string, string> = {
  HATCHBACK:       "bg-dashboard-info",
  SEDAN:           "bg-dashboard-primary",
  SUV:             "bg-dashboard-secondary",
  LUXURY_SEDAN:    "bg-dashboard-warning",
  LUXURY_SUV:      "bg-dashboard-success",
  TEMPO_TRAVELLER: "bg-dashboard-error",
  MINI_BUS:        "bg-dashboard-neutral",
  BUS:             "bg-dashboard-accent",
  Rikshaw:         "bg-dashboard-info",
};

// ── Card shells ───────────────────────────────────────────────────────────────

function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl overflow-hidden bg-dashboard-base-100 border border-dashboard-base-300", className)}>
      {children}
    </div>
  );
}

function DashCardHeader({
  children, href, linkLabel = "View all",
}: { children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
      <div className="flex items-center gap-2">{children}</div>
      {href && (
        <a href={href} className="flex items-center gap-1 text-xs text-dashboard-base-content/45 hover:text-dashboard-primary transition-colors">
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)", color: "var(--color-dashboard-success)" }}>
      <Eye className="h-2.5 w-2.5" /> Active
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 15%, transparent)", color: "var(--color-dashboard-warning)" }}>
      <EyeOff className="h-2.5 w-2.5" /> Inactive
    </span>
  );
}

// ── Contribution bar ──────────────────────────────────────────────────────────

function ContributionBar({ label, mine, total, color }: { label: string; mine: number; total: number; color: string }) {
  const share = pct(mine, total);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-dashboard-base-content/70">{label}</span>
        <span className="font-semibold text-dashboard-base-content tabular-nums">
          {mine} <span className="font-normal text-dashboard-base-content/40">/ {total}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-dashboard-base-300 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${share}%` }} />
      </div>
      <p className="text-[10px] text-dashboard-base-content/40">{share}% of all {label.toLowerCase()}</p>
    </div>
  );
}

// ── Main async content ────────────────────────────────────────────────────────

async function CabDepartmentDashboardContent({ member }: { member: CurrentMember }) {
  const d = await getCabDepartmentDashboardData(member.id);

  const attentionCount =
    d.mine.vehiclesNoRates +
    d.mine.driversNoLicense +
    d.mine.inactiveVehicles;

  const weekTotal = d.mineThisWeek.vehicles + d.mineThisWeek.drivers;

  return (
    <div className="space-y-6">
      <FunNotification memberId={member.id} />

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <StatGrid cols={4}>
        <StatCard
          label="My vehicles"
          value={d.mine.totalVehicles}
          sub={`${d.mine.activeVehicles} active · ${pct(d.mine.totalVehicles, d.global.totalVehicles)}% of all`}
          icon={Car}
          iconColor="bg-dashboard-primary/10"
          iconText="text-dashboard-primary"
          trend={
            d.mineThisWeek.vehicles > 0
              ? { value: `+${d.mineThisWeek.vehicles} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="My drivers"
          value={d.mine.totalDrivers}
          sub={`${d.mine.verifiedDrivers} verified · ${pct(d.mine.totalDrivers, d.global.totalDrivers)}% of all`}
          icon={User2}
          iconColor="bg-dashboard-secondary/10"
          iconText="text-dashboard-secondary"
          trend={
            d.mineThisWeek.drivers > 0
              ? { value: `+${d.mineThisWeek.drivers} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="My pricing routes"
          value={d.mine.pricingRoutes}
          sub={`${d.global.totalPricingRoutes} total system routes`}
          icon={MapPin}
          iconColor="bg-dashboard-info/10"
          iconText="text-dashboard-info"
        />
        <StatCard
          label="Active fleet"
          value={d.mine.activeVehicles + d.mine.activeDrivers}
          sub={`${d.mine.activeVehicles} vehicles · ${d.mine.activeDrivers} drivers`}
          icon={Zap}
          iconColor="bg-dashboard-success/10"
          iconText="text-dashboard-success"
        />
      </StatGrid>

      {/* ── Attention banner ──────────────────────────────────────────────── */}
      {attentionCount > 0 && (
        <div className="rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{
            backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 8%, transparent)",
            border: "1px solid color-mix(in oklch, var(--color-dashboard-warning) 25%, transparent)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-dashboard-warning" />
          <p className="text-sm font-medium text-dashboard-warning flex-1">
            {attentionCount} item{attentionCount > 1 ? "s" : ""} need attention —{" "}
            <span className="font-normal opacity-80">
              {[
                d.mine.vehiclesNoRates > 0  && `${d.mine.vehiclesNoRates} vehicle${d.mine.vehiclesNoRates > 1 ? "s" : ""} without rates`,
                d.mine.driversNoLicense > 0 && `${d.mine.driversNoLicense} driver${d.mine.driversNoLicense > 1 ? "s" : ""} missing license`,
                d.mine.inactiveVehicles > 0 && `${d.mine.inactiveVehicles} vehicle${d.mine.inactiveVehicles > 1 ? "s" : ""} inactive`,
              ].filter(Boolean).join(", ")}
            </span>
          </p>
        </div>
      )}

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Vehicles + Drivers stacked left */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Recent vehicles */}
          <DashCard>
            <DashCardHeader href="/dashboard/vehicles" linkLabel="All vehicles">
              <Car className="h-4 w-4" />
              <p className="text-sm font-semibold">My recent vehicles</p>
            </DashCardHeader>

            {d.recentVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-6">
                <span className="text-3xl">🚗</span>
                <p className="text-sm font-medium text-dashboard-base-content">No vehicles yet.</p>
                <a href="/dashboard/vehicles" className="text-xs text-dashboard-primary hover:underline">Add a vehicle →</a>
              </div>
            ) : (
              <div>
                {d.recentVehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 10%, transparent)" }}>
                      <Car className="h-4 w-4 text-dashboard-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-dashboard-base-content">{v.name}</p>
                      <p className="text-xs text-dashboard-base-content/45">
                        {VEHICLE_TYPE_LABELS[v.type] ?? v.type}
                        {" · "}{v.capacity}P{v.hasAc ? " · AC" : ""}
                        {" · "}{fmt(v.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <StatusPill active={v.is_active} />
                      {v.rateCount > 0
                        ? <span className="text-[9px] text-dashboard-base-content/40">{v.rateCount} rate{v.rateCount > 1 ? "s" : ""}</span>
                        : <span className="text-[9px] text-dashboard-warning">No rates</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashCard>

          {/* Recent drivers */}
          <DashCard>
            <DashCardHeader href="/dashboard/cab-drivers" linkLabel="All drivers">
              <User2 className="h-4 w-4" />
              <p className="text-sm font-semibold">My recent drivers</p>
            </DashCardHeader>

            {d.recentDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-6">
                <span className="text-3xl">🧑‍✈️</span>
                <p className="text-sm font-medium text-dashboard-base-content">No drivers yet.</p>
                <a href="/dashboard/cab-drivers" className="text-xs text-dashboard-primary hover:underline">Add a driver →</a>
              </div>
            ) : (
              <div>
                {d.recentDrivers.map((dr) => (
                  <div key={dr.id} className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-secondary) 10%, transparent)" }}>
                      <User2 className="h-4 w-4 text-dashboard-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-dashboard-base-content">{dr.name}</p>
                      <p className="text-xs text-dashboard-base-content/45">
                        {dr.city ?? "—"}{dr.vehicle ? ` · ${dr.vehicle}` : " · No vehicle"}
                        {" · "}{fmt(dr.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {dr.is_verified
                        ? <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)", color: "var(--color-dashboard-success)" }}>
                            <ShieldCheck className="h-2.5 w-2.5" /> Verified
                          </span>
                        : <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 15%, transparent)", color: "var(--color-dashboard-warning)" }}>
                            <ShieldAlert className="h-2.5 w-2.5" /> Unverified
                          </span>}
                      <StatusPill active={dr.is_active} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashCard>
        </div>

        {/* Right column: fleet health + vehicle type */}
        <div className="flex flex-col gap-4">

          {/* Fleet health summary */}
          <DashCard className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-dashboard-primary" />
              <p className="text-sm font-semibold text-dashboard-base-content">Fleet health</p>
            </div>
            <div className="space-y-3">
              {([
                {
                  label: "Active vehicles",
                  count: d.mine.activeVehicles,
                  total: d.mine.totalVehicles,
                  color: "bg-dashboard-success",
                },
                {
                  label: "Verified drivers",
                  count: d.mine.verifiedDrivers,
                  total: d.mine.totalDrivers,
                  color: "bg-dashboard-info",
                },
                {
                  label: "Vehicles with rates",
                  count: d.mine.totalVehicles - d.mine.vehiclesNoRates,
                  total: d.mine.totalVehicles,
                  color: "bg-dashboard-primary",
                },
                {
                  label: "Drivers with license",
                  count: d.mine.totalDrivers - d.mine.driversNoLicense,
                  total: d.mine.totalDrivers,
                  color: "bg-dashboard-secondary",
                },
              ] as const).map(({ label, count, total, color }) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dashboard-base-content/70">{label}</span>
                    <span className="font-semibold tabular-nums text-dashboard-base-content">{count} / {total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", color)}
                      style={{ width: `${pct(count, total)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DashCard>

          {/* Vehicle types */}
          {d.byVehicleType.length > 0 && (
            <DashCard className="px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-4 w-4 text-dashboard-info" />
                <p className="text-sm font-semibold text-dashboard-base-content">By vehicle type</p>
              </div>
              <div className="space-y-2">
                {d.byVehicleType.map((v) => (
                  <div key={v.type} className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", VEHICLE_TYPE_COLORS[v.type] ?? "bg-dashboard-primary")} />
                    <span className="text-xs text-dashboard-base-content/70 flex-1 truncate">
                      {VEHICLE_TYPE_LABELS[v.type] ?? v.type}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-dashboard-base-content">{v.count}</span>
                  </div>
                ))}
              </div>
            </DashCard>
          )}

          {/* Drivers without vehicle */}
          {d.mine.driversNoVehicle > 0 && (
            <div className="rounded-xl px-4 py-3.5"
              style={{
                backgroundColor: "color-mix(in oklch, var(--color-dashboard-info) 8%, transparent)",
                border: "1px solid color-mix(in oklch, var(--color-dashboard-info) 25%, transparent)",
              }}>
              <p className="text-xs font-semibold text-dashboard-info">
                {d.mine.driversNoVehicle} driver{d.mine.driversNoVehicle > 1 ? "s" : ""} not assigned to a vehicle
              </p>
              <a href="/dashboard/cab-drivers" className="text-[10px] text-dashboard-info underline underline-offset-2 hover:opacity-70 mt-0.5 block">
                Assign vehicles →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Contribution share ────────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-dashboard-success" />
          <p className="text-sm font-semibold text-dashboard-base-content">My contribution</p>
          <span className="ml-auto text-xs text-dashboard-base-content/40">My records vs system total</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
          <ContributionBar label="Vehicles"       mine={d.mine.totalVehicles}    total={d.global.totalVehicles}      color="bg-dashboard-primary" />
          <ContributionBar label="Drivers"        mine={d.mine.totalDrivers}     total={d.global.totalDrivers}       color="bg-dashboard-secondary" />
          <ContributionBar label="Pricing routes" mine={d.mine.pricingRoutes}    total={d.global.totalPricingRoutes} color="bg-dashboard-info" />
        </div>
      </DashCard>

      {/* ── This week ─────────────────────────────────────────────────────── */}
      {weekTotal > 0 ? (
        <DashCard className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-dashboard-success" />
            <p className="text-sm font-semibold text-dashboard-base-content">Added this week</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Vehicles", count: d.mineThisWeek.vehicles, color: "text-dashboard-primary" },
              { label: "Drivers",  count: d.mineThisWeek.drivers,  color: "text-dashboard-secondary" },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex flex-col items-center justify-center rounded-lg border border-dashboard-base-300 bg-dashboard-base-200 py-3 gap-0.5">
                <p className={cn("text-xl font-bold", color)}>{count}</p>
                <p className="text-xs text-dashboard-base-content/50">{label}</p>
              </div>
            ))}
          </div>
        </DashCard>
      ) : (
        <div className="rounded-xl border border-dashed border-dashboard-base-300 px-5 py-4 text-center">
          <p className="text-sm text-dashboard-base-content/40">Nothing added this week yet — time to grow your fleet! 🚗</p>
        </div>
      )}

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard/vehicles",      icon: Car,        label: "Add Vehicle",    iconColor: "bg-dashboard-primary/15",   iconText: "text-dashboard-primary"   },
            { href: "/dashboard/cab-drivers",   icon: User2,      label: "Add Driver",     iconColor: "bg-dashboard-secondary/15", iconText: "text-dashboard-secondary" },
            { href: "/dashboard/cab-pricing",   icon: Wrench,     label: "Cab Pricing",    iconColor: "bg-dashboard-info/15",      iconText: "text-dashboard-info"      },
            { href: "/dashboard/verify-cabs",   icon: ShieldCheck,label: "Verify Cabs",    iconColor: "bg-dashboard-success/15",   iconText: "text-dashboard-success"   },
            { href: "/dashboard/vehicles",      icon: Car,        label: "My Vehicles",    iconColor: "bg-dashboard-primary/15",   iconText: "text-dashboard-primary"   },
            { href: "/dashboard/cab-drivers",   icon: User2,      label: "My Drivers",     iconColor: "bg-dashboard-secondary/15", iconText: "text-dashboard-secondary" },
            { href: "/dashboard/cab-pricing",   icon: MapPin,     label: "Pricing Routes", iconColor: "bg-dashboard-warning/15",   iconText: "text-dashboard-warning"   },
            { href: "/dashboard/assign-driver", icon: PlusCircle, label: "Assign Driver",  iconColor: "bg-dashboard-base-200",     iconText: "text-dashboard-neutral"   },
          ].map(({ href, icon: Icon, label, iconColor, iconText }) => (
            <a key={label} href={href}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashboard-base-300 bg-dashboard-base-200 hover:bg-dashboard-base-300 px-3 py-4 transition-all duration-150 text-center">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", iconColor)}>
                <Icon className={cn("h-4 w-4", iconText)} />
              </div>
              <p className="text-xs font-medium text-dashboard-base-content">{label}</p>
            </a>
          ))}
        </div>
      </DashCard>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CabDepartmentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
            <Skeleton className="h-3 w-20 bg-dashboard-base-300" />
            <Skeleton className="h-7 w-12 bg-dashboard-base-300" />
            <Skeleton className="h-3 w-28 bg-dashboard-base-300" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-dashboard-base-300 bg-dashboard-base-100">
              <div className="px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200">
                <Skeleton className="h-4 w-32 bg-dashboard-base-300" />
              </div>
              {[...Array(4)].map((_, j) => (
                <div key={j} className={cn("flex items-center gap-3 px-4 py-3", j > 0 && "border-t border-dashboard-base-300")}>
                  <Skeleton className="h-9 w-9 rounded-lg bg-dashboard-base-300" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-36 bg-dashboard-base-300" />
                    <Skeleton className="h-3 w-24 bg-dashboard-base-300" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full bg-dashboard-base-300" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-4 space-y-3">
            <Skeleton className="h-4 w-28 bg-dashboard-base-300" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24 bg-dashboard-base-300" />
                  <Skeleton className="h-3 w-10 bg-dashboard-base-300" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full bg-dashboard-base-300" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function CabDepartmentDashboard({ member }: { member: CurrentMember }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CabDepartmentSkeleton />}>
        <CabDepartmentDashboardContent member={member} />
      </Suspense>
    </div>
  );
}
