// app/dashboard/components/SalesDashboard.tsx
import { Suspense } from "react";
import {
  Phone,
  Target,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Inbox,
  ArrowRight,
  CalendarClock,
  Flame,
  Zap,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import type { CurrentMember } from "@/app/types/members";
import { GreetingBanner } from "./Greetingbanner";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import { SalesStatusToggle } from "./Salesstatustoggle";
import { getSalesDashboardData } from "../../actions/sales-dashboard-actions.ts";
import { cn } from "@/app/lib/utils";

interface SalesDashboardProps {
  member: CurrentMember;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  VERIFIED:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ASSIGNED:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  REJECTED:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(date)
  );
}

function formatTime(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

function progressWidth(confirmed: number, target: number): string {
  const pct = Math.min(100, Math.round((confirmed / Math.max(1, target)) * 100));
  return `${pct}%`;
}

function getProgressColor(pct: number): string {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 70)  return "bg-primary";
  if (pct >= 40)  return "bg-yellow-500";
  return "bg-red-500";
}

function getMotivationLine(confirmed: number, target: number): string {
  const pct = Math.round((confirmed / Math.max(1, target)) * 100);
  if (pct >= 100) return "TARGET CRUSHED. You're in beast mode. 🦁";
  if (pct >= 80)  return "Almost there. Don't you dare slow down now. 🔥";
  if (pct >= 50)  return "Halfway through. The second half is where legends are made. ⚡";
  if (pct >= 25)  return "Warming up or cooking? Either way, dial faster. ☕";
  return "Every call is a step closer. Pick up the phone. 📞";
}

// ── Async content block ───────────────────────────────────────────────────────

async function SalesDashboardContent({ member }: { member: CurrentMember }) {
  const data = await getSalesDashboardData(member.id);

  const targetPct = Math.min(
    100,
    Math.round((data.confirmedThisMonth / Math.max(1, data.monthlyTarget)) * 100)
  );
  const progressColor = getProgressColor(targetPct);

  return (
    <div className="space-y-6">
      {/* ── Fun notification (client, conditional) ── */}
      <FunNotification memberId={member.id} />

      {/* ── KPI stats ── */}
      <StatGrid cols={4}>
        <StatCard
          label="Assigned to you"
          value={data.assignedTotal}
          sub="Total open queries"
          icon={Inbox}
          iconColor="bg-blue-500/10"
          iconText="text-blue-600"
        />
        <StatCard
          label="New this week"
          value={data.newThisWeek}
          sub="Assigned since Monday"
          icon={Zap}
          iconColor="bg-yellow-500/10"
          iconText="text-yellow-600"
          trend={data.newThisWeek > 0 ? { value: `+${data.newThisWeek}`, positive: true } : undefined}
        />
        <StatCard
          label="Follow-ups overdue"
          value={data.followUpsOverdue}
          sub="Should've called already"
          icon={AlertCircle}
          iconColor={data.followUpsOverdue > 0 ? "bg-red-500/10" : "bg-muted"}
          iconText={data.followUpsOverdue > 0 ? "text-red-600" : "text-muted-foreground"}
          muted={data.followUpsOverdue === 0}
        />
        <StatCard
          label="Confirmed this month"
          value={data.confirmedThisMonth}
          sub={`Target: ${data.monthlyTarget}`}
          icon={CheckCircle2}
          iconColor="bg-green-500/10"
          iconText="text-green-600"
          highlight={data.confirmedThisMonth >= data.monthlyTarget}
          trend={
            data.confirmedThisMonth > 0
              ? {
                  value: `${targetPct}% of target`,
                  positive: targetPct >= 50,
                }
              : undefined
          }
        />
      </StatGrid>

      {/* ── Monthly target progress bar ── */}
      <div className="rounded-xl border bg-card px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Monthly target</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">
              {data.confirmedThisMonth}
              <span className="text-muted-foreground font-normal"> / {data.monthlyTarget}</span>
            </span>
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                targetPct >= 100
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : targetPct >= 50
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}
            >
              {targetPct}%
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", progressColor)}
            style={{ width: progressWidth(data.confirmedThisMonth, data.monthlyTarget) }}
          />
        </div>
        {/* Motivation line */}
        <p className="text-xs text-muted-foreground italic">
          {getMotivationLine(data.confirmedThisMonth, data.monthlyTarget)}
        </p>
      </div>

      {/* ── Two column: Today's follow-ups + Recent queries ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Today's follow-ups */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Follow-ups today</p>
              {data.followUpsDueToday > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {data.followUpsDueToday}
                </span>
              )}
            </div>
            <a
              href="/dashboard/follow-ups"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          {data.todayFollowUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">🎉</span>
              <p className="text-sm font-medium">Clear schedule today.</p>
              <p className="text-xs text-muted-foreground">
                No follow-ups due. Either you're ahead of the game or you forgot to set them. Please be the first.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.todayFollowUps.map((q) => (
                <a
                  key={q.id}
                  href={`/dashboard/queries/${q.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {q.destination ?? "No destination"} · {q.phone}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-primary">
                      {formatTime(q.nextFollowUpAt)}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        STATUS_STYLES[q.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {q.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Recent assigned queries */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Recently assigned</p>
            </div>
            <a
              href="/dashboard/queries"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          {data.recentQueries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-medium">Nothing assigned yet.</p>
              <p className="text-xs text-muted-foreground">
                Marketing is warming up the leads. They'll land here any moment.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.recentQueries.map((q) => (
                <a
                  key={q.id}
                  href={`/dashboard/queries/${q.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.destination ?? "—"} · Travel {formatDate(q.travelDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full block",
                        STATUS_STYLES[q.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {q.status}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(q.assignedAt)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Overdue warning banner ── */}
      {data.followUpsOverdue > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10 px-4 py-3.5">
          <Flame className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {data.followUpsOverdue} overdue follow-up{data.followUpsOverdue > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
              These clients were supposed to hear from you. They didn't. Go fix that — before they book with someone else.
            </p>
          </div>
          <a
            href="/dashboard/follow-ups?filter=overdue"
            className="shrink-0 text-xs font-medium text-red-700 dark:text-red-400 hover:underline mt-0.5"
          >
            Fix now →
          </a>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="rounded-xl border bg-card px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Quick actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard/queries",     icon: Inbox,        label: "All queries",     color: "text-blue-600",   bg: "bg-blue-500/10" },
            { href: "/dashboard/follow-ups",  icon: Clock,        label: "Follow-ups",      color: "text-yellow-600", bg: "bg-yellow-500/10" },
            { href: "/dashboard/packages/new",icon: Zap,          label: "Build package",   color: "text-purple-600", bg: "bg-purple-500/10" },
            { href: "/dashboard/packages",    icon: TrendingUp,   label: "My packages",     color: "text-green-600",  bg: "bg-green-500/10" },
          ].map(({ href, icon: Icon, label, color, bg }) => (
            <a
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 px-3 py-4 hover:bg-muted/60 hover:border-border transition-all duration-150 group text-center"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="text-xs font-medium">{label}</p>
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SalesDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-72 rounded-xl bg-muted animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <Skeleton className="h-4 w-32" />
            </div>
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex items-center gap-3 px-4 py-3 border-t">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function SalesDashboard({ member }: SalesDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Async data section */}
      <Suspense fallback={<SalesDashboardSkeleton />}>
        <SalesDashboardContent member={member} />
      </Suspense>

    </div>
  );
}