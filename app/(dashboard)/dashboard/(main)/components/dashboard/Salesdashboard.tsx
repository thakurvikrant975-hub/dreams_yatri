import { Suspense } from "react";
import {
  Phone, Target, TrendingUp, Clock, AlertCircle,
  CheckCircle2, Inbox, ArrowRight, CalendarClock, Flame, Zap,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import type { CurrentMember } from "@/app/types/members";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import { getSalesDashboardData } from "../../actions/sales-dashboard-actions.ts";
import { cn } from "@/app/lib/utils";

interface SalesDashboardProps { member: CurrentMember }

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(date));
}
function formatTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(date));
}
function progressWidth(confirmed: number, target: number) {
  return `${Math.min(100, Math.round((confirmed / Math.max(1, target)) * 100))}%`;
}
function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-dashboard-success";
  if (pct >= 70)  return "bg-dashboard-primary";
  if (pct >= 40)  return "bg-dashboard-warning";
  return "bg-dashboard-error";
}
function getMotivationLine(confirmed: number, target: number) {
  const pct = Math.round((confirmed / Math.max(1, target)) * 100);
  if (pct >= 100) return "TARGET CRUSHED. You're in beast mode. 🦁";
  if (pct >= 80)  return "Almost there. Don't you dare slow down now. 🔥";
  if (pct >= 50)  return "Halfway through. The second half is where legends are made. ⚡";
  if (pct >= 25)  return "Warming up or cooking? Either way, dial faster. ☕";
  return "Every call is a step closer. Pick up the phone. 📞";
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, React.CSSProperties> = {
    SUBMITTED: { backgroundColor: "color-mix(in oklch, var(--color-dashboard-info) 15%, transparent)",    color: "var(--color-dashboard-info)" },
    VERIFIED:  { backgroundColor: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)", color: "var(--color-dashboard-success)" },
    ASSIGNED:  { backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 15%, transparent)", color: "var(--color-dashboard-warning)" },
    REJECTED:  { backgroundColor: "color-mix(in oklch, var(--color-dashboard-error) 15%, transparent)",   color: "var(--color-dashboard-error)" },
  };
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-dashboard-base-300 text-dashboard-base-content"
      style={styleMap[status]}
    >
      {status}
    </span>
  );
}

// ── Shared card shells ────────────────────────────────────────────────────────
function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl overflow-hidden bg-dashboard-base-100 border border-dashboard-base-300", className)}>
      {children}
    </div>
  );
}

function DashCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
      {children}
    </div>
  );
}

// ── Main async content ────────────────────────────────────────────────────────
async function SalesDashboardContent({ member }: { member: CurrentMember }) {
  const data = await getSalesDashboardData(member.id);

  const targetPct    = Math.min(100, Math.round((data.confirmedThisMonth / Math.max(1, data.monthlyTarget)) * 100));
  const progressColor = getProgressColor(targetPct);

  return (
    <div className="space-y-6">
      <FunNotification memberId={member.id} />

      {/* KPI stats */}
      <StatGrid cols={4}>
        <StatCard
          label="Assigned to you" value={data.assignedTotal} sub="Total open queries"
          icon={Inbox} iconColor="bg-dashboard-info/10" iconText="text-dashboard-info"
        />
        <StatCard
          label="New this week" value={data.newThisWeek} sub="Assigned since Monday"
          icon={Zap} iconColor="bg-dashboard-warning/10" iconText="text-dashboard-warning"
          trend={data.newThisWeek > 0 ? { value: `+${data.newThisWeek}`, positive: true } : undefined}
        />
        <StatCard
          label="Follow-ups overdue" value={data.followUpsOverdue} sub="Should've called already"
          icon={AlertCircle}
          iconColor={data.followUpsOverdue > 0 ? "bg-dashboard-error/10" : "bg-dashboard-base-200"}
          iconText={data.followUpsOverdue > 0 ? "text-dashboard-error" : "text-dashboard-neutral"}
          muted={data.followUpsOverdue === 0}
        />
        <StatCard
          label="Confirmed this month" value={data.confirmedThisMonth} sub={`Target: ${data.monthlyTarget}`}
          icon={CheckCircle2} iconColor="bg-dashboard-success/10" iconText="text-dashboard-success"
          highlight={data.confirmedThisMonth >= data.monthlyTarget}
          trend={data.confirmedThisMonth > 0 ? { value: `${targetPct}% of target`, positive: targetPct >= 50 } : undefined}
        />
      </StatGrid>

      {/* Monthly target progress */}
      <DashCard className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-dashboard-primary" />
            <p className="text-sm font-semibold text-dashboard-base-content">Monthly target</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-dashboard-base-content">
              {data.confirmedThisMonth}
              <span className="font-normal text-dashboard-base-content/45"> / {data.monthlyTarget}</span>
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={
                targetPct >= 100
                  ? { backgroundColor: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)", color: "var(--color-dashboard-success)" }
                  : targetPct >= 50
                  ? { backgroundColor: "color-mix(in oklch, var(--color-dashboard-warning) 15%, transparent)", color: "var(--color-dashboard-warning)" }
                  : { backgroundColor: "color-mix(in oklch, var(--color-dashboard-error) 15%, transparent)",   color: "var(--color-dashboard-error)" }
              }
            >
              {targetPct}%
            </span>
          </div>
        </div>

        <div className="h-2 w-full rounded-full overflow-hidden bg-dashboard-base-300">
          <div
            className={cn("h-full rounded-full transition-all duration-700", progressColor)}
            style={{ width: progressWidth(data.confirmedThisMonth, data.monthlyTarget) }}
          />
        </div>

        <p className="text-xs italic text-dashboard-base-content/45">
          {getMotivationLine(data.confirmedThisMonth, data.monthlyTarget)}
        </p>
      </DashCard>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Today's follow-ups */}
        <DashCard>
          <DashCardHeader>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              <p className="text-sm font-semibold">Follow-ups today</p>
              {data.followUpsDueToday > 0 && (
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 12%, transparent)",
                    color: "var(--color-dashboard-primary)",
                  }}
                >
                  {data.followUpsDueToday}
                </span>
              )}
            </div>
            <a
              href="/dashboard/follow-ups"
              className="flex items-center gap-1 text-xs text-dashboard-base-content/45 hover:text-dashboard-primary transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </DashCardHeader>

          {data.todayFollowUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">🎉</span>
              <p className="text-sm font-medium text-dashboard-base-content">Clear schedule today.</p>
              <p className="text-xs text-dashboard-base-content/45">
                No follow-ups due. Either you're ahead of the game or you forgot to set them.
              </p>
            </div>
          ) : (
            <div>
              {data.todayFollowUps.map((q) => (
                <a
                  key={q.id}
                  href={`/dashboard/queries/${q.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors"
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 12%, transparent)" }}
                  >
                    <Phone className="h-3.5 w-3.5 text-dashboard-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">{q.name}</p>
                    <p className="text-xs truncate text-dashboard-base-content/45">
                      {q.destination ?? "No destination"} · {q.phone}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-xs font-medium text-dashboard-primary">{formatTime(q.nextFollowUpAt)}</p>
                    <StatusBadge status={q.status} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </DashCard>

        {/* Recently assigned */}
        <DashCard>
          <DashCardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <p className="text-sm font-semibold">Recently assigned</p>
            </div>
            <a
              href="/dashboard/queries"
              className="flex items-center gap-1 text-xs text-dashboard-base-content/45 hover:text-dashboard-primary transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </DashCardHeader>

          {data.recentQueries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-medium text-dashboard-base-content">Nothing assigned yet.</p>
              <p className="text-xs text-dashboard-base-content/45">
                Marketing is warming up the leads. They'll land here any moment.
              </p>
            </div>
          ) : (
            <div>
              {data.recentQueries.map((q) => (
                <a
                  key={q.id}
                  href={`/dashboard/queries/${q.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-t border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-dashboard-base-content">{q.name}</p>
                    <p className="text-xs text-dashboard-base-content/45">
                      {q.destination ?? "—"} · Travel {formatDate(q.travelDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <StatusBadge status={q.status} />
                    <p className="text-[10px] text-dashboard-base-content/35">{formatDate(q.assignedAt)}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </DashCard>
      </div>

      {/* Overdue banner */}
      {data.followUpsOverdue > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3.5"
          style={{
            backgroundColor: "color-mix(in oklch, var(--color-dashboard-error) 8%, transparent)",
            border: "1px solid color-mix(in oklch, var(--color-dashboard-error) 25%, transparent)",
          }}
        >
          <Flame className="h-4 w-4 shrink-0 mt-0.5 text-dashboard-error" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-dashboard-error">
              {data.followUpsOverdue} overdue follow-up{data.followUpsOverdue > 1 ? "s" : ""}
            </p>
            <p className="text-xs mt-0.5 text-dashboard-error/75">
              These clients were supposed to hear from you. They didn't. Go fix that — before they book with someone else.
            </p>
          </div>
          <a
            href="/dashboard/follow-ups?filter=overdue"
            className="shrink-0 text-xs font-medium mt-0.5 hover:underline text-dashboard-error"
          >
            Fix now →
          </a>
        </div>
      )}

      {/* Quick actions */}
      <DashCard className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content">
          Quick actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard/queries",      icon: Inbox,      label: "All queries",   iconColor: "bg-dashboard-info/15",      iconText: "text-dashboard-info" },
            { href: "/dashboard/follow-ups",   icon: Clock,      label: "Follow-ups",    iconColor: "bg-dashboard-warning/15",   iconText: "text-dashboard-warning" },
            { href: "/dashboard/packages/new", icon: Zap,        label: "Build package", iconColor: "bg-dashboard-secondary/15", iconText: "text-dashboard-secondary" },
            { href: "/dashboard/packages",     icon: TrendingUp, label: "My packages",   iconColor: "bg-dashboard-success/15",   iconText: "text-dashboard-success" },
          ].map(({ href, icon: Icon, label, iconColor, iconText }) => (
            <a
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashboard-base-300 bg-dashboard-base-200 hover:bg-dashboard-base-300 px-3 py-4 transition-all duration-150 text-center"
            >
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
function SalesDashboardSkeleton() {
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
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-3">
        <Skeleton className="h-4 w-32 bg-dashboard-base-300" />
        <Skeleton className="h-2 w-full rounded-full bg-dashboard-base-300" />
        <Skeleton className="h-3 w-48 bg-dashboard-base-300" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-dashboard-base-300 bg-dashboard-base-100">
            <div className="px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200">
              <Skeleton className="h-4 w-32 bg-dashboard-base-300" />
            </div>
            {[...Array(4)].map((_, j) => (
              <div key={j} className={cn("flex items-center gap-3 px-4 py-3", j > 0 && "border-t border-dashboard-base-300")}>
                <Skeleton className="h-8 w-8 rounded-full bg-dashboard-base-300" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32 bg-dashboard-base-300" />
                  <Skeleton className="h-3 w-24 bg-dashboard-base-300" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full bg-dashboard-base-300" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SalesDashboard({ member }: SalesDashboardProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<SalesDashboardSkeleton />}>
        <SalesDashboardContent member={member} />
      </Suspense>
    </div>
  );
}