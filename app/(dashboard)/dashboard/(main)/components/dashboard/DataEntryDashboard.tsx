import { Suspense } from "react";
import {
  PackageOpen, MapPin, Building2, Zap, ArrowRight,
  AlertTriangle, CheckCircle2, PlusCircle, ImageOff,
  DoorOpen, Camera, TrendingUp, Eye, EyeOff,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import type { CurrentMember } from "@/app/types/members";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import { getDataEntryDashboardData } from "../../actions/data-entry-dashboard-actions";
import { cn } from "@/app/lib/utils";

interface DataEntryDashboardProps {
  member: CurrentMember;
}

function fmt(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(date)
  );
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
  children,
  href,
  linkLabel = "View all",
}: {
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
      <div className="flex items-center gap-2">{children}</div>
      {href && (
        <a
          href={href}
          className="flex items-center gap-1 text-xs text-dashboard-base-content/45 hover:text-dashboard-primary transition-colors"
        >
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)",
        color: "var(--color-dashboard-success)",
      }}
    >
      <Eye className="h-2.5 w-2.5" /> Live
    </span>
  ) : (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 15%, transparent)",
        color: "var(--color-dashboard-warning)",
      }}
    >
      <EyeOff className="h-2.5 w-2.5" /> Draft
    </span>
  );
}

// ── Main async content ────────────────────────────────────────────────────────
async function DataEntryDashboardContent({ member }: { member: CurrentMember }) {
  const d = await getDataEntryDashboardData();

  const totalAttention =
    d.inactivePackages + d.hotelsWithoutRooms + d.activitiesWithoutImages;

  const totalThisWeek =
    d.addedThisWeek.packages +
    d.addedThisWeek.hotels +
    d.addedThisWeek.destinations +
    d.addedThisWeek.activities;

  return (
    <div className="space-y-6">
      <FunNotification memberId={member.id} />

      {/* KPI stats */}
      <StatGrid cols={5}>
        <StatCard
          label="Total packages"
          value={d.totalPackages}
          sub={`${d.activePackages} live`}
          icon={PackageOpen}
          iconColor="bg-dashboard-primary/10"
          iconText="text-dashboard-primary"
          trend={
            d.addedThisWeek.packages > 0
              ? { value: `+${d.addedThisWeek.packages} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="Destinations"
          value={d.totalDestinations}
          sub="Active locations"
          icon={MapPin}
          iconColor="bg-dashboard-info/10"
          iconText="text-dashboard-info"
          trend={
            d.addedThisWeek.destinations > 0
              ? { value: `+${d.addedThisWeek.destinations} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="Hotels"
          value={d.totalHotels}
          sub="Active properties"
          icon={Building2}
          iconColor="bg-dashboard-secondary/10"
          iconText="text-dashboard-secondary"
          trend={
            d.addedThisWeek.hotels > 0
              ? { value: `+${d.addedThisWeek.hotels} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="Activities"
          value={d.totalActivities}
          sub="Active listings"
          icon={Zap}
          iconColor="bg-dashboard-warning/10"
          iconText="text-dashboard-warning"
          trend={
            d.addedThisWeek.activities > 0
              ? { value: `+${d.addedThisWeek.activities} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="Need attention"
          value={totalAttention}
          sub="Incomplete items"
          icon={AlertTriangle}
          iconColor={
            totalAttention > 0
              ? "bg-dashboard-error/10"
              : "bg-dashboard-base-200"
          }
          iconText={
            totalAttention > 0 ? "text-dashboard-error" : "text-dashboard-neutral"
          }
          muted={totalAttention === 0}
          highlight={totalAttention === 0}
        />
      </StatGrid>

      {/* Attention banner */}
      {totalAttention > 0 && (
        <div
          className="rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--color-dashboard-warning) 8%, transparent)",
            border:
              "1px solid color-mix(in oklch, var(--color-dashboard-warning) 25%, transparent)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-dashboard-warning" />
          <p className="text-sm font-medium text-dashboard-warning flex-1">
            {totalAttention} item{totalAttention > 1 ? "s" : ""} need attention —
            <span className="font-normal opacity-80">
              {[
                d.inactivePackages > 0 &&
                  `${d.inactivePackages} package${d.inactivePackages > 1 ? "s" : ""} inactive`,
                d.hotelsWithoutRooms > 0 &&
                  `${d.hotelsWithoutRooms} hotel${d.hotelsWithoutRooms > 1 ? "s" : ""} without rooms`,
                d.activitiesWithoutImages > 0 &&
                  `${d.activitiesWithoutImages} activit${d.activitiesWithoutImages > 1 ? "ies" : "y"} without images`,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </p>
        </div>
      )}

      {/* Two columns: recent packages + recent hotels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent packages */}
        <DashCard>
          <DashCardHeader href="/dashboard/packages" linkLabel="All packages">
            <PackageOpen className="h-4 w-4" />
            <p className="text-sm font-semibold">Recent packages</p>
          </DashCardHeader>

          {d.recentPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">📦</span>
              <p className="text-sm font-medium text-dashboard-base-content">No packages yet.</p>
              <a
                href="/dashboard/packages/new"
                className="text-xs text-dashboard-primary hover:underline"
              >
                Create your first package →
              </a>
            </div>
          ) : (
            <div>
              {d.recentPackages.map((pkg) => (
                <a
                  key={pkg.id}
                  href={`/dashboard/packages/${pkg.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors"
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor:
                        "color-mix(in oklch, var(--color-dashboard-primary) 10%, transparent)",
                    }}
                  >
                    {pkg.hasThumbnail ? (
                      <PackageOpen className="h-3.5 w-3.5 text-dashboard-primary" />
                    ) : (
                      <ImageOff className="h-3.5 w-3.5 text-dashboard-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">
                      {pkg.title}
                    </p>
                    <p className="text-xs text-dashboard-base-content/45">
                      {pkg.destination} · {fmt(pkg.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StatusPill active={pkg.is_active} />
                    {!pkg.hasThumbnail && (
                      <span className="text-[9px] text-dashboard-warning">No image</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </DashCard>

        {/* Recent hotels */}
        <DashCard>
          <DashCardHeader href="/dashboard/hotels" linkLabel="All hotels">
            <Building2 className="h-4 w-4" />
            <p className="text-sm font-semibold">Recent hotels</p>
          </DashCardHeader>

          {d.recentHotels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">🏨</span>
              <p className="text-sm font-medium text-dashboard-base-content">No hotels yet.</p>
              <a
                href="/dashboard/hotels/new"
                className="text-xs text-dashboard-primary hover:underline"
              >
                Add your first hotel →
              </a>
            </div>
          ) : (
            <div>
              {d.recentHotels.map((hotel) => (
                <a
                  key={hotel.id}
                  href={`/dashboard/hotels/${hotel.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors"
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor:
                        "color-mix(in oklch, var(--color-dashboard-secondary) 10%, transparent)",
                    }}
                  >
                    {hotel.roomCount > 0 ? (
                      <DoorOpen className="h-3.5 w-3.5 text-dashboard-secondary" />
                    ) : (
                      <DoorOpen className="h-3.5 w-3.5 text-dashboard-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">
                      {hotel.name}
                    </p>
                    <p className="text-xs text-dashboard-base-content/45">
                      {hotel.destination} · {fmt(hotel.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StatusPill active={hotel.is_active} />
                    {hotel.roomCount === 0 && (
                      <span className="text-[9px] text-dashboard-warning">No rooms</span>
                    )}
                    {hotel.roomCount > 0 && (
                      <span className="text-[9px] text-dashboard-base-content/40">
                        {hotel.roomCount} room{hotel.roomCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </DashCard>
      </div>

      {/* This week summary */}
      {totalThisWeek > 0 && (
        <DashCard className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-dashboard-success" />
            <p className="text-sm font-semibold text-dashboard-base-content">Added this week</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Packages", count: d.addedThisWeek.packages, color: "text-dashboard-primary" },
              { label: "Hotels", count: d.addedThisWeek.hotels, color: "text-dashboard-secondary" },
              { label: "Destinations", count: d.addedThisWeek.destinations, color: "text-dashboard-info" },
              { label: "Activities", count: d.addedThisWeek.activities, color: "text-dashboard-warning" },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-lg border border-dashboard-base-300 bg-dashboard-base-200 py-3 gap-0.5"
              >
                <p className={cn("text-xl font-bold", color)}>{count}</p>
                <p className="text-xs text-dashboard-base-content/50">{label}</p>
              </div>
            ))}
          </div>
        </DashCard>
      )}

      {/* Quick actions */}
      <DashCard className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content">
          Quick actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {
              href: "/dashboard/packages",
              icon: PackageOpen,
              label: "Packages",
              iconColor: "bg-dashboard-primary/15",
              iconText: "text-dashboard-primary",
            },
            {
              href: "/dashboard/hotels",
              icon: Building2,
              label: "Hotels",
              iconColor: "bg-dashboard-secondary/15",
              iconText: "text-dashboard-secondary",
            },
            {
              href: "/dashboard/activities",
              icon: Zap,
              label: "Activities",
              iconColor: "bg-dashboard-warning/15",
              iconText: "text-dashboard-warning",
            },
            {
              href: "/dashboard/destinations",
              icon: MapPin,
              label: "Destinations",
              iconColor: "bg-dashboard-info/15",
              iconText: "text-dashboard-info",
            },
            {
              href: "/dashboard/regions",
              icon: TrendingUp,
              label: "Regions",
              iconColor: "bg-dashboard-success/15",
              iconText: "text-dashboard-success",
            },
            {
              href: "/dashboard/categories",
              icon: CheckCircle2,
              label: "Categories",
              iconColor: "bg-dashboard-primary/15",
              iconText: "text-dashboard-primary",
            },
            {
              href: "/dashboard/policies",
              icon: PlusCircle,
              label: "Policies",
              iconColor: "bg-dashboard-secondary/15",
              iconText: "text-dashboard-secondary",
            },
            {
              href: "/dashboard/blogs",
              icon: Camera,
              label: "Blog",
              iconColor: "bg-dashboard-warning/15",
              iconText: "text-dashboard-warning",
            },
          ].map(({ href, icon: Icon, label, iconColor, iconText }) => (
            <a
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashboard-base-300 bg-dashboard-base-200 hover:bg-dashboard-base-300 px-3 py-4 transition-all duration-150 text-center"
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  iconColor
                )}
              >
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
function DataEntryDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-72 rounded-xl animate-pulse bg-dashboard-base-300" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3"
          >
            <Skeleton className="h-3 w-20 bg-dashboard-base-300" />
            <Skeleton className="h-7 w-12 bg-dashboard-base-300" />
            <Skeleton className="h-3 w-28 bg-dashboard-base-300" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden border border-dashboard-base-300 bg-dashboard-base-100"
          >
            <div className="px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200">
              <Skeleton className="h-4 w-32 bg-dashboard-base-300" />
            </div>
            {[...Array(5)].map((_, j) => (
              <div
                key={j}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  j > 0 && "border-t border-dashboard-base-300"
                )}
              >
                <Skeleton className="h-8 w-8 rounded-lg bg-dashboard-base-300" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36 bg-dashboard-base-300" />
                  <Skeleton className="h-3 w-24 bg-dashboard-base-300" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full bg-dashboard-base-300" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export function DataEntryDashboard({ member }: DataEntryDashboardProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<DataEntryDashboardSkeleton />}>
        <DataEntryDashboardContent member={member} />
      </Suspense>
    </div>
  );
}
