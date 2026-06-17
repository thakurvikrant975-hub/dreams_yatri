import { Suspense } from "react";
import {
  Building2, Car, User2, ArrowRight, AlertTriangle,
  Eye, EyeOff, TrendingUp, CheckCircle2, DoorOpen,
  ShieldCheck, ShieldAlert, Wrench, PlusCircle,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/app/lib/utils";
import type { CurrentMember } from "@/app/types/members";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import { getInventoryManagerDashboardData } from "../../actions/inventory-manager-dashboard-actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(date));
}

function pct(mine: number, total: number) {
  if (total === 0) return 0;
  return Math.round((mine / total) * 100);
}

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

async function InventoryManagerDashboardContent({ member }: { member: CurrentMember }) {
  const d = await getInventoryManagerDashboardData(member.name);

  const myAttention =
    d.mine.inactiveHotels +
    d.mine.hotelsNoRooms +
    d.mine.driversNoLicense;

  const myWeekTotal = d.mineThisWeek.hotels + d.mineThisWeek.vehicles + d.mineThisWeek.drivers;

  const CATEGORY_LABELS: Record<string, string> = {
    budget: "Budget",
    standard: "Standard",
    deluxe: "Deluxe",
    luxury: "Luxury",
    premium: "Premium",
    boutique: "Boutique",
  };

  return (
    <div className="space-y-6">
      <FunNotification memberId={member.id} />

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <StatGrid cols={4}>
        <StatCard
          label="My hotels"
          value={d.mine.totalHotels}
          sub={`${d.mine.activeHotels} active · ${pct(d.mine.totalHotels, d.global.totalHotels)}% of all`}
          icon={Building2}
          iconColor="bg-dashboard-primary/10"
          iconText="text-dashboard-primary"
          trend={
            d.mineThisWeek.hotels > 0
              ? { value: `+${d.mineThisWeek.hotels} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="My vehicles"
          value={d.mine.totalVehicles}
          sub={`${d.mine.activeVehicles} active · ${pct(d.mine.totalVehicles, d.global.totalVehicles)}% of all`}
          icon={Car}
          iconColor="bg-dashboard-info/10"
          iconText="text-dashboard-info"
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
          label="Cab pricing routes"
          value={d.global.cabPricingRoutes}
          sub="System-wide (all team)"
          icon={Wrench}
          iconColor="bg-dashboard-base-200"
          iconText="text-dashboard-neutral"
          muted
        />
      </StatGrid>

      {/* ── Attention banner ─────────────────────────────────────────────── */}
      {myAttention > 0 && (
        <div className="rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{
            backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 8%, transparent)",
            border: "1px solid color-mix(in oklch, var(--color-dashboard-warning) 25%, transparent)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-dashboard-warning" />
          <p className="text-sm font-medium text-dashboard-warning flex-1">
            {myAttention} item{myAttention > 1 ? "s" : ""} need your attention —{" "}
            <span className="font-normal opacity-80">
              {[
                d.mine.inactiveHotels > 0    && `${d.mine.inactiveHotels} hotel${d.mine.inactiveHotels > 1 ? "s" : ""} inactive`,
                d.mine.hotelsNoRooms > 0     && `${d.mine.hotelsNoRooms} hotel${d.mine.hotelsNoRooms > 1 ? "s" : ""} without rooms`,
                d.mine.driversNoLicense > 0  && `${d.mine.driversNoLicense} driver${d.mine.driversNoLicense > 1 ? "s" : ""} missing license`,
              ].filter(Boolean).join(", ")}
            </span>
          </p>
        </div>
      )}

      {/* ── Main content grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* My recent hotels */}
        <DashCard>
          <DashCardHeader href="/dashboard/hotels" linkLabel="All hotels">
            <Building2 className="h-4 w-4" />
            <p className="text-sm font-semibold">My recent hotels</p>
          </DashCardHeader>

          {d.recentHotels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">🏨</span>
              <p className="text-sm font-medium text-dashboard-base-content">No hotels yet.</p>
              <a href="/dashboard/hotels/new" className="text-xs text-dashboard-primary hover:underline">
                Add your first hotel →
              </a>
            </div>
          ) : (
            <div>
              {d.recentHotels.map((h) => (
                <a key={h.id} href={`/dashboard/hotels/${h.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 10%, transparent)" }}>
                    {h.roomCount > 0
                      ? <DoorOpen className="h-3.5 w-3.5 text-dashboard-primary" />
                      : <DoorOpen className="h-3.5 w-3.5 text-dashboard-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">{h.name}</p>
                    <p className="text-xs text-dashboard-base-content/45">
                      {h.destination}
                      {h.category ? ` · ${CATEGORY_LABELS[h.category] ?? h.category}` : ""}
                      {" · "}{fmt(h.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StatusPill active={h.is_active} />
                    {h.roomCount === 0
                      ? <span className="text-[9px] text-dashboard-warning">No rooms</span>
                      : <span className="text-[9px] text-dashboard-base-content/40">{h.roomCount} room{h.roomCount > 1 ? "s" : ""}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </DashCard>

        {/* My vehicles + drivers stacked */}
        <div className="flex flex-col gap-4">

          {/* My recent vehicles */}
          <DashCard>
            <DashCardHeader href="/dashboard/vehicles" linkLabel="All vehicles">
              <Car className="h-4 w-4" />
              <p className="text-sm font-semibold">My recent vehicles</p>
            </DashCardHeader>

            {d.recentVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center px-6">
                <span className="text-2xl">🚗</span>
                <p className="text-sm font-medium text-dashboard-base-content">No vehicles yet.</p>
                <a href="/dashboard/vehicles" className="text-xs text-dashboard-primary hover:underline">Add a vehicle →</a>
              </div>
            ) : (
              <div>
                {d.recentVehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-dashboard-base-300">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-info) 10%, transparent)" }}>
                      <Car className="h-3 w-3 text-dashboard-info" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-dashboard-base-content">{v.name}</p>
                      <p className="text-xs text-dashboard-base-content/45">
                        {v.type} · {v.passenger_capacity}P{v.has_ac ? " · AC" : ""} · {fmt(v.created_at)}
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

          {/* My recent drivers */}
          <DashCard>
            <DashCardHeader href="/dashboard/cab-drivers" linkLabel="All drivers">
              <User2 className="h-4 w-4" />
              <p className="text-sm font-semibold">My recent drivers</p>
            </DashCardHeader>

            {d.recentDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center px-6">
                <span className="text-2xl">🧑‍✈️</span>
                <p className="text-sm font-medium text-dashboard-base-content">No drivers yet.</p>
                <a href="/dashboard/cab-drivers" className="text-xs text-dashboard-primary hover:underline">Add a driver →</a>
              </div>
            ) : (
              <div>
                {d.recentDrivers.map((dr) => (
                  <div key={dr.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-dashboard-base-300">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-secondary) 10%, transparent)" }}>
                      <User2 className="h-3 w-3 text-dashboard-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-dashboard-base-content">{dr.name}</p>
                      <p className="text-xs text-dashboard-base-content/45">
                        {dr.city ?? "—"}{dr.vehicle ? ` · ${dr.vehicle}` : ""} · {fmt(dr.created_at)}
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
                            <ShieldAlert className="h-2.5 w-2.5" /> Pending
                          </span>}
                      <StatusPill active={dr.is_active} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashCard>
        </div>
      </div>

      {/* ── Contribution share ───────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-dashboard-success" />
          <p className="text-sm font-semibold text-dashboard-base-content">My contribution</p>
          <span className="ml-auto text-xs text-dashboard-base-content/40">My uploads vs system total</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
          <ContributionBar label="Hotels"   mine={d.mine.totalHotels}   total={d.global.totalHotels}   color="bg-dashboard-primary" />
          <ContributionBar label="Vehicles" mine={d.mine.totalVehicles} total={d.global.totalVehicles} color="bg-dashboard-info" />
          <ContributionBar label="Drivers"  mine={d.mine.totalDrivers}  total={d.global.totalDrivers}  color="bg-dashboard-secondary" />
        </div>
      </DashCard>

      {/* ── This week ────────────────────────────────────────────────────── */}
      {myWeekTotal > 0 ? (
        <DashCard className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-dashboard-success" />
            <p className="text-sm font-semibold text-dashboard-base-content">Added this week</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Hotels",   count: d.mineThisWeek.hotels,   color: "text-dashboard-primary"   },
              { label: "Vehicles", count: d.mineThisWeek.vehicles, color: "text-dashboard-info"      },
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
          <p className="text-sm text-dashboard-base-content/40">Nothing added this week yet — time to add some inventory! 🏨🚗</p>
        </div>
      )}

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard/hotels/new",    icon: Building2,  label: "New Hotel",      iconColor: "bg-dashboard-primary/15",   iconText: "text-dashboard-primary"   },
            { href: "/dashboard/vehicles",       icon: Car,        label: "Add Vehicle",    iconColor: "bg-dashboard-info/15",      iconText: "text-dashboard-info"      },
            { href: "/dashboard/cab-drivers",    icon: User2,      label: "Add Driver",     iconColor: "bg-dashboard-secondary/15", iconText: "text-dashboard-secondary" },
            { href: "/dashboard/cab-pricing",    icon: Wrench,     label: "Cab Pricing",    iconColor: "bg-dashboard-warning/15",   iconText: "text-dashboard-warning"   },
            { href: "/dashboard/hotels",         icon: Building2,  label: "My Hotels",      iconColor: "bg-dashboard-primary/15",   iconText: "text-dashboard-primary"   },
            { href: "/dashboard/vehicles",       icon: Car,        label: "My Vehicles",    iconColor: "bg-dashboard-info/15",      iconText: "text-dashboard-info"      },
            { href: "/dashboard/cab-drivers",    icon: User2,      label: "My Drivers",     iconColor: "bg-dashboard-secondary/15", iconText: "text-dashboard-secondary" },
            { href: "/dashboard/verify-cabs",    icon: PlusCircle, label: "Verify Cabs",    iconColor: "bg-dashboard-base-200",     iconText: "text-dashboard-neutral"   },
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

function InventoryManagerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-72 rounded-xl animate-pulse bg-dashboard-base-300" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
            <Skeleton className="h-3 w-20 bg-dashboard-base-300" />
            <Skeleton className="h-7 w-12 bg-dashboard-base-300" />
            <Skeleton className="h-3 w-28 bg-dashboard-base-300" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-dashboard-base-300 bg-dashboard-base-100">
            <div className="px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200">
              <Skeleton className="h-4 w-32 bg-dashboard-base-300" />
            </div>
            {[...Array(4)].map((_, j) => (
              <div key={j} className={cn("flex items-center gap-3 px-4 py-3", j > 0 && "border-t border-dashboard-base-300")}>
                <Skeleton className="h-8 w-8 rounded-lg bg-dashboard-base-300" />
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
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-4 space-y-4">
        <Skeleton className="h-4 w-36 bg-dashboard-base-300" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-dashboard-base-300" />
                <Skeleton className="h-3 w-12 bg-dashboard-base-300" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full bg-dashboard-base-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function InventoryManagerDashboard({ member }: { member: CurrentMember }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<InventoryManagerSkeleton />}>
        <InventoryManagerDashboardContent member={member} />
      </Suspense>
    </div>
  );
}
