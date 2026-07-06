import { Suspense } from "react";
import {
  PackageOpen, MapPin, Globe2, Building2, Zap,
  ArrowRight, AlertTriangle, ImageOff, Eye, EyeOff,
  TrendingUp, PlusCircle, CheckCircle2,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/app/lib/utils";
import type { CurrentMember } from "@/app/types/members";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import { getTravelExpertDashboardData } from "../../actions/travel-expert-dashboard-actions";

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
}: {
  children: React.ReactNode; href?: string; linkLabel?: string;
}) {
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
      <Eye className="h-2.5 w-2.5" /> Live
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 15%, transparent)", color: "var(--color-dashboard-warning)" }}>
      <EyeOff className="h-2.5 w-2.5" /> Draft
    </span>
  );
}

// ── Contribution bar ──────────────────────────────────────────────────────────

function ContributionBar({
  label, mine, total, color,
}: { label: string; mine: number; total: number; color: string }) {
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
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${share}%` }}
        />
      </div>
      <p className="text-[10px] text-dashboard-base-content/40">{share}% of all {label.toLowerCase()}</p>
    </div>
  );
}

// ── Main async content ────────────────────────────────────────────────────────

async function TravelExpertDashboardContent({ member }: { member: CurrentMember }) {
  const d = await getTravelExpertDashboardData(member.id);

  const myAttention = d.mine.inactivePackages + d.mine.packagesNoThumb;
  const myWeekTotal = d.mineThisWeek.packages + d.mineThisWeek.regions + d.mineThisWeek.destinations + d.mineThisWeek.hotels;

  return (
    <div className="space-y-6">
      <FunNotification memberId={member.id} />

      {/* ── My content KPI stats ─────────────────────────────────────────── */}
      <StatGrid cols={5}>
        <StatCard
          label="My packages"
          value={d.mine.totalPackages}
          sub={`${d.mine.activePackages} live · ${pct(d.mine.totalPackages, d.global.totalPackages)}% of all`}
          icon={PackageOpen}
          iconColor="bg-dashboard-primary/10"
          iconText="text-dashboard-primary"
          trend={
            d.mineThisWeek.packages > 0
              ? { value: `+${d.mineThisWeek.packages} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="My regions"
          value={d.mine.totalRegions}
          sub={`${pct(d.mine.totalRegions, d.global.totalRegions)}% of all regions`}
          icon={Globe2}
          iconColor="bg-dashboard-info/10"
          iconText="text-dashboard-info"
          trend={
            d.mineThisWeek.regions > 0
              ? { value: `+${d.mineThisWeek.regions} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="My destinations"
          value={d.mine.totalDestinations}
          sub={`${pct(d.mine.totalDestinations, d.global.totalDestinations)}% of all`}
          icon={MapPin}
          iconColor="bg-dashboard-secondary/10"
          iconText="text-dashboard-secondary"
          trend={
            d.mineThisWeek.destinations > 0
              ? { value: `+${d.mineThisWeek.destinations} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="My hotels"
          value={d.mine.totalHotels}
          sub={`${pct(d.mine.totalHotels, d.global.totalHotels)}% of all`}
          icon={Building2}
          iconColor="bg-dashboard-warning/10"
          iconText="text-dashboard-warning"
          trend={
            d.mineThisWeek.hotels > 0
              ? { value: `+${d.mineThisWeek.hotels} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="Activities"
          value={d.global.totalActivities}
          sub="System-wide (all team)"
          icon={Zap}
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
            {myAttention} of your item{myAttention > 1 ? "s" : ""} need attention —{" "}
            <span className="font-normal opacity-80">
              {[
                d.mine.inactivePackages > 0 && `${d.mine.inactivePackages} package${d.mine.inactivePackages > 1 ? "s" : ""} not live`,
                d.mine.packagesNoThumb > 0  && `${d.mine.packagesNoThumb} package${d.mine.packagesNoThumb > 1 ? "s" : ""} missing thumbnail`,
              ].filter(Boolean).join(", ")}
            </span>
          </p>
          <a href="/dashboard/packages" className="text-xs font-semibold text-dashboard-warning underline underline-offset-2 shrink-0 hover:opacity-70 transition-opacity">
            Review →
          </a>
        </div>
      )}

      {/* ── Main two-column layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* My recent packages */}
        <DashCard>
          <DashCardHeader href="/dashboard/packages" linkLabel="All packages">
            <PackageOpen className="h-4 w-4" />
            <p className="text-sm font-semibold">My recent packages</p>
          </DashCardHeader>

          {d.recentPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">📦</span>
              <p className="text-sm font-medium text-dashboard-base-content">No packages yet.</p>
              <a href="/dashboard/packages/new" className="text-xs text-dashboard-primary hover:underline">
                Create your first package →
              </a>
            </div>
          ) : (
            <div>
              {d.recentPackages.map((pkg) => (
                <a key={pkg.id} href={`/dashboard/packages/${pkg.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 10%, transparent)" }}>
                    {pkg.hasThumbnail
                      ? <PackageOpen className="h-3.5 w-3.5 text-dashboard-primary" />
                      : <ImageOff className="h-3.5 w-3.5 text-dashboard-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">{pkg.title}</p>
                    <p className="text-xs text-dashboard-base-content/45">{pkg.destination} · {fmt(pkg.created_at)}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StatusPill active={pkg.is_active} />
                    {!pkg.hasThumbnail && <span className="text-[9px] text-dashboard-warning">No image</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </DashCard>

        {/* My regions + destinations stacked */}
        <div className="flex flex-col gap-4">

          {/* My recent regions */}
          <DashCard>
            <DashCardHeader href="/dashboard/regions" linkLabel="All regions">
              <Globe2 className="h-4 w-4" />
              <p className="text-sm font-semibold">My recent regions</p>
            </DashCardHeader>

            {d.recentRegions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center px-6">
                <span className="text-2xl">🗺️</span>
                <p className="text-sm font-medium text-dashboard-base-content">No regions yet.</p>
                <a href="/dashboard/regions" className="text-xs text-dashboard-primary hover:underline">Add a region →</a>
              </div>
            ) : (
              <div>
                {d.recentRegions.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-dashboard-base-300">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-info) 10%, transparent)" }}>
                      <Globe2 className="h-3 w-3 text-dashboard-info" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-dashboard-base-content">{r.name}</p>
                      <p className="text-xs text-dashboard-base-content/45">
                        {r.country} · {r.destCount} dest{r.destCount !== 1 ? "s" : ""} · {fmt(r.created_at)}
                      </p>
                    </div>
                    <StatusPill active={r.is_active} />
                  </div>
                ))}
              </div>
            )}
          </DashCard>

          {/* My recent destinations */}
          <DashCard>
            <DashCardHeader href="/dashboard/destinations" linkLabel="All destinations">
              <MapPin className="h-4 w-4" />
              <p className="text-sm font-semibold">My recent destinations</p>
            </DashCardHeader>

            {d.recentDestinations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center px-6">
                <span className="text-2xl">📍</span>
                <p className="text-sm font-medium text-dashboard-base-content">No destinations yet.</p>
                <a href="/dashboard/destinations" className="text-xs text-dashboard-primary hover:underline">Add a destination →</a>
              </div>
            ) : (
              <div>
                {d.recentDestinations.map((dest) => (
                  <div key={dest.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-dashboard-base-300">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-secondary) 10%, transparent)" }}>
                      <MapPin className="h-3 w-3 text-dashboard-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-dashboard-base-content">{dest.name}</p>
                      <p className="text-xs text-dashboard-base-content/45">{dest.region} · {fmt(dest.created_at)}</p>
                    </div>
                    <StatusPill active={dest.is_active} />
                  </div>
                ))}
              </div>
            )}
          </DashCard>
        </div>
      </div>

      {/* ── My contribution share ────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-dashboard-success" />
          <p className="text-sm font-semibold text-dashboard-base-content">My contribution</p>
          <span className="ml-auto text-xs text-dashboard-base-content/40">My uploads vs system total</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <ContributionBar label="Packages"     mine={d.mine.totalPackages}     total={d.global.totalPackages}     color="bg-dashboard-primary" />
          <ContributionBar label="Regions"      mine={d.mine.totalRegions}      total={d.global.totalRegions}      color="bg-dashboard-info" />
          <ContributionBar label="Destinations" mine={d.mine.totalDestinations} total={d.global.totalDestinations} color="bg-dashboard-secondary" />
          <ContributionBar label="Hotels"       mine={d.mine.totalHotels}       total={d.global.totalHotels}       color="bg-dashboard-warning" />
        </div>
      </DashCard>

      {/* ── This week my additions ───────────────────────────────────────── */}
      {myWeekTotal > 0 ? (
        <DashCard className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-dashboard-success" />
            <p className="text-sm font-semibold text-dashboard-base-content">Added this week</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Packages",     count: d.mineThisWeek.packages,     color: "text-dashboard-primary"   },
              { label: "Regions",      count: d.mineThisWeek.regions,      color: "text-dashboard-info"      },
              { label: "Destinations", count: d.mineThisWeek.destinations, color: "text-dashboard-secondary" },
              { label: "Hotels",       count: d.mineThisWeek.hotels,       color: "text-dashboard-warning"   },
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
          <p className="text-sm text-dashboard-base-content/40">Nothing added this week yet — go make some content! 🚀</p>
        </div>
      )}

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard/packages/new",   icon: PackageOpen, label: "New Package",     iconColor: "bg-dashboard-primary/15",   iconText: "text-dashboard-primary"   },
            { href: "/dashboard/regions",         icon: Globe2,      label: "Add Region",      iconColor: "bg-dashboard-info/15",      iconText: "text-dashboard-info"      },
            { href: "/dashboard/destinations",    icon: MapPin,      label: "Add Destination", iconColor: "bg-dashboard-secondary/15", iconText: "text-dashboard-secondary" },
            { href: "/dashboard/activities/new",  icon: Zap,         label: "New Activity",    iconColor: "bg-dashboard-warning/15",   iconText: "text-dashboard-warning"   },
            { href: "/dashboard/packages",        icon: PackageOpen, label: "My Packages",     iconColor: "bg-dashboard-primary/15",   iconText: "text-dashboard-primary"   },
            { href: "/dashboard/regions",         icon: Globe2,      label: "My Regions",      iconColor: "bg-dashboard-info/15",      iconText: "text-dashboard-info"      },
            { href: "/dashboard/destinations",    icon: MapPin,      label: "My Destinations", iconColor: "bg-dashboard-secondary/15", iconText: "text-dashboard-secondary" },
            { href: "/dashboard/activities",      icon: PlusCircle,  label: "Activities",      iconColor: "bg-dashboard-base-200",     iconText: "text-dashboard-neutral"   },
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

function TravelExpertDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-72 rounded-xl animate-pulse bg-dashboard-base-300" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
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
                <Skeleton className="h-5 w-12 rounded-full bg-dashboard-base-300" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-4 space-y-4">
        <Skeleton className="h-4 w-36 bg-dashboard-base-300" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {[...Array(4)].map((_, i) => (
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

export function TravelExpertDashboard({ member }: { member: CurrentMember }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<TravelExpertDashboardSkeleton />}>
        <TravelExpertDashboardContent member={member} />
      </Suspense>
    </div>
  );
}
