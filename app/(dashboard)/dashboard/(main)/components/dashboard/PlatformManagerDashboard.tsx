import { Suspense } from "react";
import {
  Building2, Car, User2, Package, MapPin, Globe2, Sparkles,
  ArrowRight, AlertTriangle, Activity as ActivityIcon,
  PlusCircle, Pencil, Trash2, Users,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/app/lib/utils";
import type { CurrentMember } from "@/app/types/members";
import { StatCard, StatGrid } from "./Statcard";
import { getPlatformManagerDashboardData } from "../../actions/platform-manager-dashboard-actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(date));
}

function timeAgo(date: Date | null): string {
  if (!date) return "Never active";
  const d = new Date(date);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmt(d);
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ── Card shells (same pattern as InventoryManagerDashboard) ───────────────────

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50 mb-2">{children}</p>;
}

// ── Activity feed icon mapping ──────────────────────────────────────────────

const ACTION_ICON: Record<string, React.ElementType> = {
  CREATE: PlusCircle,
  UPDATE: Pencil,
  DELETE: Trash2,
};
const ACTION_STYLE: Record<string, string> = {
  CREATE: "bg-dashboard-success/10 text-dashboard-success",
  UPDATE: "bg-dashboard-info/10 text-dashboard-info",
  DELETE: "bg-dashboard-error/10 text-dashboard-error",
};

// ── Main async content ────────────────────────────────────────────────────────

async function PlatformManagerDashboardContent({ member }: { member: CurrentMember }) {
  void member;
  const d = await getPlatformManagerDashboardData();

  const totalAttention =
    d.attention.hotelsNoRooms + d.attention.driversNoLicense +
    d.attention.inactivePackages + d.attention.inactiveActivities;

  return (
    <div className="space-y-6">

      {/* ── Inventory Manager team KPIs ──────────────────────────────────── */}
      <div>
        <SectionLabel>Inventory Manager team</SectionLabel>
        <StatGrid cols={4}>
          <StatCard
            label="Hotels" value={d.global.totalHotels} icon={Building2}
            iconColor="bg-dashboard-primary/10" iconText="text-dashboard-primary"
            trend={d.thisWeek.hotels > 0 ? { value: `+${d.thisWeek.hotels} this week`, positive: true } : undefined}
          />
          <StatCard
            label="Cab pricing routes" value={d.global.totalCabPricingRoutes} icon={Car}
            iconColor="bg-dashboard-info/10" iconText="text-dashboard-info"
            trend={d.thisWeek.cabPricing > 0 ? { value: `+${d.thisWeek.cabPricing} this week`, positive: true } : undefined}
          />
          <StatCard
            label="Vehicles" value={d.global.totalVehicles} icon={Car}
            iconColor="bg-dashboard-secondary/10" iconText="text-dashboard-secondary"
            trend={d.thisWeek.vehicles > 0 ? { value: `+${d.thisWeek.vehicles} this week`, positive: true } : undefined}
          />
          <StatCard
            label="Drivers" value={d.global.totalDrivers} icon={User2}
            iconColor="bg-dashboard-warning/10" iconText="text-dashboard-warning"
            trend={d.thisWeek.drivers > 0 ? { value: `+${d.thisWeek.drivers} this week`, positive: true } : undefined}
          />
        </StatGrid>
      </div>

      {/* ── Travel Expert team KPIs ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Travel Expert team</SectionLabel>
        <StatGrid cols={4}>
          <StatCard
            label="Packages" value={d.global.totalPackages} icon={Package}
            iconColor="bg-dashboard-primary/10" iconText="text-dashboard-primary"
            trend={d.thisWeek.packages > 0 ? { value: `+${d.thisWeek.packages} this week`, positive: true } : undefined}
          />
          <StatCard
            label="Activities" value={d.global.totalActivities} icon={Sparkles}
            iconColor="bg-dashboard-info/10" iconText="text-dashboard-info"
            trend={d.thisWeek.activities > 0 ? { value: `+${d.thisWeek.activities} this week`, positive: true } : undefined}
          />
          <StatCard
            label="Destinations" value={d.global.totalDestinations} icon={MapPin}
            iconColor="bg-dashboard-secondary/10" iconText="text-dashboard-secondary"
            trend={d.thisWeek.destinations > 0 ? { value: `+${d.thisWeek.destinations} this week`, positive: true } : undefined}
          />
          <StatCard
            label="Regions" value={d.global.totalRegions} icon={Globe2}
            iconColor="bg-dashboard-warning/10" iconText="text-dashboard-warning"
            trend={d.thisWeek.regions > 0 ? { value: `+${d.thisWeek.regions} this week`, positive: true } : undefined}
          />
        </StatGrid>
      </div>

      {/* ── Attention banner ──────────────────────────────────────────────── */}
      {totalAttention > 0 && (
        <div className="rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{
            backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 8%, transparent)",
            border: "1px solid color-mix(in oklch, var(--color-dashboard-warning) 25%, transparent)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-dashboard-warning" />
          <p className="text-sm font-medium text-dashboard-warning flex-1">
            {totalAttention} item{totalAttention > 1 ? "s" : ""} across the team need attention —{" "}
            <span className="font-normal opacity-80">
              {[
                d.attention.hotelsNoRooms > 0     && `${d.attention.hotelsNoRooms} hotel${d.attention.hotelsNoRooms > 1 ? "s" : ""} without rooms`,
                d.attention.driversNoLicense > 0  && `${d.attention.driversNoLicense} driver${d.attention.driversNoLicense > 1 ? "s" : ""} missing license`,
                d.attention.inactivePackages > 0  && `${d.attention.inactivePackages} inactive package${d.attention.inactivePackages > 1 ? "s" : ""}`,
                d.attention.inactiveActivities > 0 && `${d.attention.inactiveActivities} inactive activit${d.attention.inactiveActivities > 1 ? "ies" : "y"}`,
              ].filter(Boolean).join(", ")}
            </span>
          </p>
        </div>
      )}

      {/* ── Employee roster ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Inventory Managers */}
        <DashCard>
          <DashCardHeader href="/dashboard/hotels" linkLabel="All hotels">
            <Users className="h-4 w-4" />
            <p className="text-sm font-semibold">Inventory Managers</p>
          </DashCardHeader>

          {d.inventoryManagers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">📦</span>
              <p className="text-sm font-medium text-dashboard-base-content">No Inventory Managers yet.</p>
              <p className="text-xs text-dashboard-base-content/45">Assign the role from Team Members.</p>
            </div>
          ) : (
            <div>
              {d.inventoryManagers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                    style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 12%, transparent)", color: "var(--color-dashboard-primary)" }}>
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">{m.name}</p>
                    <p className="text-xs text-dashboard-base-content/45">
                      {m.hotels} hotel{m.hotels !== 1 ? "s" : ""} · {m.cabPricing} cab price{m.cabPricing !== 1 ? "s" : ""} · {m.vehicles} vehicle{m.vehicles !== 1 ? "s" : ""} · {m.drivers} driver{m.drivers !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    {m.hotelsThisWeek > 0 && (
                      <span className="text-[10px] font-semibold text-dashboard-success">+{m.hotelsThisWeek} this wk</span>
                    )}
                    <span className="text-[10px] text-dashboard-base-content/40">{timeAgo(m.lastActiveAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* Travel Experts */}
        <DashCard>
          <DashCardHeader href="/dashboard/packages" linkLabel="All packages">
            <Users className="h-4 w-4" />
            <p className="text-sm font-semibold">Travel Experts</p>
          </DashCardHeader>

          {d.travelExperts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">🗺️</span>
              <p className="text-sm font-medium text-dashboard-base-content">No Travel Experts yet.</p>
              <p className="text-xs text-dashboard-base-content/45">Assign the role from Team Members.</p>
            </div>
          ) : (
            <div>
              {d.travelExperts.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                    style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-secondary) 12%, transparent)", color: "var(--color-dashboard-secondary)" }}>
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">{m.name}</p>
                    <p className="text-xs text-dashboard-base-content/45">
                      {m.packages} package{m.packages !== 1 ? "s" : ""} · {m.activities} activit{m.activities !== 1 ? "ies" : "y"} · {m.destinations} destination{m.destinations !== 1 ? "s" : ""} · {m.regions} region{m.regions !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    {m.packagesThisWeek > 0 && (
                      <span className="text-[10px] font-semibold text-dashboard-success">+{m.packagesThisWeek} this wk</span>
                    )}
                    <span className="text-[10px] text-dashboard-base-content/40">{timeAgo(m.lastActiveAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>

      {/* ── Recent activity feed ──────────────────────────────────────────── */}
      <DashCard>
        <DashCardHeader href="/dashboard/activity-logs" linkLabel="View all logs">
          <ActivityIcon className="h-4 w-4" />
          <p className="text-sm font-semibold">Recent team activity</p>
        </DashCardHeader>

        {d.recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
            <span className="text-3xl">📋</span>
            <p className="text-sm font-medium text-dashboard-base-content">No activity recorded yet.</p>
          </div>
        ) : (
          <div>
            {d.recentActivity.map((a) => {
              const Icon = ACTION_ICON[a.action] ?? PlusCircle;
              const style = ACTION_STYLE[a.action] ?? "bg-dashboard-base-200 text-dashboard-neutral";
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-dashboard-base-300">
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", style)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dashboard-base-content truncate">
                      {a.description ?? `${a.userName ?? "Someone"} ${a.action.toLowerCase()}d ${a.entity}`}
                    </p>
                    <p className="text-xs text-dashboard-base-content/45">
                      {a.userRole ?? "—"} · {timeAgo(a.actionAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashCard>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PlatformManagerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-3 w-40 rounded animate-pulse bg-dashboard-base-300" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
            <Skeleton className="h-3 w-20 bg-dashboard-base-300" />
            <Skeleton className="h-7 w-12 bg-dashboard-base-300" />
            <Skeleton className="h-3 w-28 bg-dashboard-base-300" />
          </div>
        ))}
      </div>
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
            {[...Array(3)].map((_, j) => (
              <div key={j} className={cn("flex items-center gap-3 px-4 py-3", j > 0 && "border-t border-dashboard-base-300")}>
                <Skeleton className="h-8 w-8 rounded-full bg-dashboard-base-300" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36 bg-dashboard-base-300" />
                  <Skeleton className="h-3 w-48 bg-dashboard-base-300" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function PlatformManagerDashboard({ member }: { member: CurrentMember }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<PlatformManagerSkeleton />}>
        <PlatformManagerDashboardContent member={member} />
      </Suspense>
    </div>
  );
}
