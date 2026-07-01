import { Suspense } from "react";
import {
  Building2, DoorOpen, ArrowRight, AlertTriangle, Eye, EyeOff,
  TrendingUp, CheckCircle2, PlusCircle, LayoutGrid, ShieldCheck, ShieldAlert,
  Clock, XCircle, SendHorizonal, Star,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/app/lib/utils";
import type { CurrentMember } from "@/app/types/members";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import {
  getHotelDepartmentDashboardData,
  HOTEL_CATEGORY_LABEL,
} from "../../actions/hotel-department-dashboard-actions";

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

// ── Listing status badge ──────────────────────────────────────────────────────

const LISTING_STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:        { label: "Draft",        icon: Clock,         color: "var(--color-dashboard-base-content)", bg: "var(--color-dashboard-base-300)" },
  SUBMITTED:    { label: "Submitted",    icon: SendHorizonal, color: "var(--color-dashboard-info)",         bg: "color-mix(in oklch, var(--color-dashboard-info) 15%, transparent)" },
  UNDER_REVIEW: { label: "Under Review", icon: ShieldAlert,   color: "var(--color-dashboard-warning)",      bg: "color-mix(in oklch, var(--color-dashboard-warning) 15%, transparent)" },
  APPROVED:     { label: "Approved",     icon: ShieldCheck,   color: "var(--color-dashboard-success)",      bg: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)" },
  REJECTED:     { label: "Rejected",     icon: XCircle,       color: "var(--color-dashboard-error)",        bg: "color-mix(in oklch, var(--color-dashboard-error) 15%, transparent)" },
  LIVE:         { label: "Live",         icon: Eye,           color: "var(--color-dashboard-success)",      bg: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)" },
};

function ListingBadge({ status }: { status: string }) {
  const cfg = LISTING_STATUS_CONFIG[status] ?? LISTING_STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <Icon className="h-2.5 w-2.5" /> {cfg.label}
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

async function HotelDepartmentDashboardContent({ member }: { member: CurrentMember }) {
  const d = await getHotelDepartmentDashboardData(member.name);

  const attentionCount = d.mine.inactive + d.mine.noRooms + d.mine.rejected;

  const CATEGORY_COLORS: Record<string, string> = {
    budget:    "bg-dashboard-info",
    standard:  "bg-dashboard-secondary",
    deluxe:    "bg-dashboard-primary",
    luxury:    "bg-dashboard-warning",
    premium:   "bg-dashboard-success",
    boutique:  "bg-dashboard-error",
  };

  return (
    <div className="space-y-6">
      <FunNotification memberId={member.id} />

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <StatGrid cols={4}>
        <StatCard
          label="My hotels"
          value={d.mine.total}
          sub={`${d.mine.active} active · ${pct(d.mine.total, d.global.total)}% of all`}
          icon={Building2}
          iconColor="bg-dashboard-primary/10"
          iconText="text-dashboard-primary"
          trend={
            d.mineThisWeek > 0
              ? { value: `+${d.mineThisWeek} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          label="Live hotels"
          value={d.mine.live}
          sub={`${pct(d.mine.live, d.mine.total)}% of my listings`}
          icon={Eye}
          iconColor="bg-dashboard-success/10"
          iconText="text-dashboard-success"
        />
        <StatCard
          label="Pending review"
          value={d.mine.submitted + d.mine.underReview}
          sub={`${d.mine.submitted} submitted · ${d.mine.underReview} under review`}
          icon={ShieldAlert}
          iconColor="bg-dashboard-warning/10"
          iconText="text-dashboard-warning"
        />
        <StatCard
          label="System-wide live"
          value={d.global.live}
          sub={`${d.global.pendingReview} pending review`}
          icon={LayoutGrid}
          iconColor="bg-dashboard-base-200"
          iconText="text-dashboard-neutral"
          muted
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
            {attentionCount} hotel{attentionCount > 1 ? "s" : ""} need attention —{" "}
            <span className="font-normal opacity-80">
              {[
                d.mine.inactive > 0    && `${d.mine.inactive} inactive`,
                d.mine.noRooms > 0     && `${d.mine.noRooms} without rooms`,
                d.mine.rejected > 0    && `${d.mine.rejected} rejected`,
              ].filter(Boolean).join(", ")}
            </span>
          </p>
          <a href="/dashboard/hotels" className="text-xs font-semibold text-dashboard-warning underline underline-offset-2 shrink-0 hover:opacity-70 transition-opacity">
            Review →
          </a>
        </div>
      )}

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent hotels — wider column */}
        <div className="lg:col-span-2">
          <DashCard>
            <DashCardHeader href="/dashboard/hotels" linkLabel="All hotels">
              <Building2 className="h-4 w-4" />
              <p className="text-sm font-semibold">My recent hotels</p>
            </DashCardHeader>

            {d.recentHotels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
                <span className="text-4xl">🏨</span>
                <p className="text-sm font-medium text-dashboard-base-content">No hotels added yet.</p>
                <a href="/dashboard/hotels/new" className="text-xs text-dashboard-primary hover:underline">
                  Add your first hotel →
                </a>
              </div>
            ) : (
              <div>
                {d.recentHotels.map((h) => (
                  <a key={h.id} href={`/dashboard/hotels/${h.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 10%, transparent)" }}>
                      {h.roomCount > 0
                        ? <DoorOpen className="h-4 w-4 text-dashboard-primary" />
                        : <DoorOpen className="h-4 w-4 text-dashboard-warning" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-dashboard-base-content">{h.name}</p>
                      <p className="text-xs text-dashboard-base-content/45">
                        {h.destination}
                        {h.category ? ` · ${HOTEL_CATEGORY_LABEL(h.category)}` : ""}
                        {" · "}{fmt(h.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <ListingBadge status={h.listingStatus} />
                      <StatusPill active={h.is_active} />
                    </div>
                    {h.roomCount === 0 && (
                      <span className="text-[9px] text-dashboard-warning ml-0 shrink-0">No rooms</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </DashCard>
        </div>

        {/* Right column: listing status + category */}
        <div className="flex flex-col gap-4">

          {/* Listing status breakdown */}
          <DashCard className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-dashboard-primary" />
              <p className="text-sm font-semibold text-dashboard-base-content">Listing status</p>
            </div>
            <div className="space-y-2.5">
              {([
                { label: "Live",          count: d.mine.live,        color: "bg-dashboard-success",   pct: pct(d.mine.live, d.mine.total) },
                { label: "Draft",         count: d.mine.draft,       color: "bg-dashboard-base-300",  pct: pct(d.mine.draft, d.mine.total) },
                { label: "Submitted",     count: d.mine.submitted,   color: "bg-dashboard-info",      pct: pct(d.mine.submitted, d.mine.total) },
                { label: "Under Review",  count: d.mine.underReview, color: "bg-dashboard-warning",   pct: pct(d.mine.underReview, d.mine.total) },
                { label: "Rejected",      count: d.mine.rejected,    color: "bg-dashboard-error",     pct: pct(d.mine.rejected, d.mine.total) },
              ] as const).map(({ label, count, color, pct: share }) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dashboard-base-content/70">{label}</span>
                    <span className="font-semibold tabular-nums text-dashboard-base-content">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div className={cn("h-full rounded-full", color)} style={{ width: `${share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </DashCard>

          {/* Category breakdown */}
          {d.byCategory.length > 0 && (
            <DashCard className="px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-dashboard-warning" />
                <p className="text-sm font-semibold text-dashboard-base-content">By category</p>
              </div>
              <div className="space-y-2">
                {d.byCategory.map((c) => (
                  <div key={c.category} className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", CATEGORY_COLORS[c.category] ?? "bg-dashboard-primary")} />
                    <span className="text-xs text-dashboard-base-content/70 flex-1 truncate">
                      {HOTEL_CATEGORY_LABEL(c.category)}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-dashboard-base-content">{c.count}</span>
                  </div>
                ))}
              </div>
            </DashCard>
          )}
        </div>
      </div>

      {/* ── Contribution share ────────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-dashboard-success" />
          <p className="text-sm font-semibold text-dashboard-base-content">My contribution</p>
          <span className="ml-auto text-xs text-dashboard-base-content/40">My hotels vs system total</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
          <ContributionBar label="Total hotels"  mine={d.mine.total}  total={d.global.total}  color="bg-dashboard-primary" />
          <ContributionBar label="Active hotels" mine={d.mine.active} total={d.global.total}  color="bg-dashboard-success" />
          <ContributionBar label="Live listings" mine={d.mine.live}   total={d.global.live}   color="bg-dashboard-warning" />
        </div>
      </DashCard>

      {/* ── This week ─────────────────────────────────────────────────────── */}
      {d.mineThisWeek > 0 ? (
        <DashCard className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-dashboard-success" />
            <p className="text-sm font-semibold text-dashboard-base-content">Added this week</p>
          </div>
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashboard-base-300 bg-dashboard-base-200 py-4 px-10 gap-0.5">
              <p className="text-3xl font-bold text-dashboard-primary">{d.mineThisWeek}</p>
              <p className="text-xs text-dashboard-base-content/50">Hotels added</p>
            </div>
          </div>
        </DashCard>
      ) : (
        <div className="rounded-xl border border-dashed border-dashboard-base-300 px-5 py-4 text-center">
          <p className="text-sm text-dashboard-base-content/40">Nothing added this week yet — time to add some hotels! 🏨</p>
        </div>
      )}

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <DashCard className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard/hotels/new",    icon: Building2,  label: "New Hotel",      iconColor: "bg-dashboard-primary/15",   iconText: "text-dashboard-primary"   },
            { href: "/dashboard/hotels",         icon: LayoutGrid, label: "All Hotels",     iconColor: "bg-dashboard-info/15",      iconText: "text-dashboard-info"      },
            { href: "/dashboard/verify-hotels",  icon: ShieldCheck,label: "Verify Hotels",  iconColor: "bg-dashboard-success/15",   iconText: "text-dashboard-success"   },
            { href: "/dashboard/hotels",         icon: PlusCircle, label: "Manage Rooms",   iconColor: "bg-dashboard-warning/15",   iconText: "text-dashboard-warning"   },
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

function HotelDepartmentSkeleton() {
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
        <div className="lg:col-span-2 rounded-xl overflow-hidden border border-dashboard-base-300 bg-dashboard-base-100">
          <div className="px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200">
            <Skeleton className="h-4 w-32 bg-dashboard-base-300" />
          </div>
          {[...Array(5)].map((_, j) => (
            <div key={j} className={cn("flex items-center gap-3 px-4 py-3", j > 0 && "border-t border-dashboard-base-300")}>
              <Skeleton className="h-9 w-9 rounded-lg bg-dashboard-base-300" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40 bg-dashboard-base-300" />
                <Skeleton className="h-3 w-28 bg-dashboard-base-300" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-dashboard-base-300" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-4 space-y-3">
            <Skeleton className="h-4 w-28 bg-dashboard-base-300" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20 bg-dashboard-base-300" />
                  <Skeleton className="h-3 w-6 bg-dashboard-base-300" />
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

export function HotelDepartmentDashboard({ member }: { member: CurrentMember }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<HotelDepartmentSkeleton />}>
        <HotelDepartmentDashboardContent member={member} />
      </Suspense>
    </div>
  );
}
