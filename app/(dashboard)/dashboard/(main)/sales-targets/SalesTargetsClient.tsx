"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Target, Users, UserRound, Crown, UserX, CheckCircle2, History } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/app/lib/utils";
import {
  setMemberTarget, setTeamTarget, getTargetHistory,
  type SalesTargetsPageData, type MemberTargetRow, type TeamTargetRow, type TargetHistoryEntry,
} from "./actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : Math.max(0, n);
}

const fmtInr = (n: number | null) => n === null ? "—" : `₹${n.toLocaleString("en-IN")}`;

/** One change to one row's target, e.g. "Bookings target 12 → 16" — the
 * example that prompted this whole timeline. Two separate lines when both
 * revenue and bookings moved in the same save. */
function historyLines(e: TargetHistoryEntry): string[] {
  const lines: string[] = [];
  if (e.previousConversionTarget !== e.newConversionTarget) {
    lines.push(
      e.previousConversionTarget === null ? `Set bookings target to ${e.newConversionTarget ?? "—"}`
      : e.newConversionTarget === null ? `Cleared bookings target (was ${e.previousConversionTarget})`
      : `Bookings target ${e.previousConversionTarget} → ${e.newConversionTarget}`,
    );
  }
  if (e.previousRevenueTarget !== e.newRevenueTarget) {
    lines.push(
      e.previousRevenueTarget === null ? `Set revenue target to ${fmtInr(e.newRevenueTarget)}`
      : e.newRevenueTarget === null ? `Cleared revenue target (was ${fmtInr(e.previousRevenueTarget)})`
      : `Revenue target ${fmtInr(e.previousRevenueTarget)} → ${fmtInr(e.newRevenueTarget)}`,
    );
  }
  return lines;
}

/** Fetches on first open rather than up front for every row on the page —
 * most rows are never inspected, and this is a secondary/audit view, not
 * the primary thing the page renders. Refetches after this row's own save
 * so the change just made shows up without having to close and reopen. */
function HistoryButton({ subjectId, year, month, refreshKey }: { subjectId: string; year: number; month: number; refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<TargetHistoryEntry[] | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLoading(true);
      getTargetHistory(subjectId, year, month)
        .then(setEntries)
        .finally(() => setLoading(false));
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => { handleOpenChange(next); }}
      key={refreshKey /* force a fresh fetch next open after a save */}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Change history"
          className="shrink-0 flex items-center justify-center size-6 rounded-full text-dashboard-base-content/40 hover:bg-dashboard-base-200 hover:text-dashboard-base-content transition-colors cursor-pointer"
        >
          <History className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-dashboard-base-300 px-3 py-2">
          <p className="text-xs font-semibold text-dashboard-base-content">Target history</p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-dashboard-base-content/40" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-dashboard-base-content/45">No changes yet this month.</p>
          ) : (
            <ul className="divide-y divide-dashboard-base-300">
              {entries.map((e) => (
                <li key={e.id} className="px-3 py-2 space-y-0.5">
                  {historyLines(e).map((line, i) => (
                    <p key={i} className="text-xs text-dashboard-base-content">{line}</p>
                  ))}
                  <p className="text-[11px] text-dashboard-base-content/45">
                    {e.changedByName ?? "Someone"} · {formatDistanceToNow(new Date(e.changedAt), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** One row's local edit state, saved on blur — same convention as
 * AutoAssignSettingsDialog's MemberRow: responsive typing, no save on every
 * keystroke. */
function TargetRow({
  icon: Icon, title, subtitle, target, onSave, indent, subjectId, year, month,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  target: { revenueTarget: number | null; conversionTarget: number | null };
  onSave: (values: { revenueTarget: number | null; conversionTarget: number | null }) => Promise<{ success: boolean; error?: string }>;
  /** Nested under a team's own row — smaller icon, indented, no bottom
   * border of its own so a run of execs reads as one group under the team
   * row rather than as separate cards. */
  indent?: boolean;
  subjectId: string;
  year: number;
  month: number;
}) {
  const [revenue, setRevenue] = useState(target.revenueTarget?.toString() ?? "");
  const [conversions, setConversions] = useState(target.conversionTarget?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);

  async function save() {
    setSaving(true);
    const result = await onSave({ revenueTarget: num(revenue), conversionTarget: num(conversions) });
    setSaving(false);
    if (result.success) {
      setSavedAt(Date.now());
      setHistoryKey((k) => k + 1);
    } else {
      toast.error(result.error ?? "Failed to save target");
    }
  }

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 border-b border-dashboard-base-300 last:border-b-0",
      indent && "pl-10 bg-dashboard-base-200/20",
    )}>
      <span className={cn(
        "shrink-0 flex items-center justify-center rounded-full bg-dashboard-primary/10 text-dashboard-primary",
        indent ? "size-6" : "size-8",
      )}>
        <Icon className={indent ? "size-3.5" : "size-4"} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium text-dashboard-base-content truncate", indent ? "text-xs" : "text-sm")}>{title}</p>
        {subtitle && <p className="text-xs text-dashboard-base-content/50 truncate">{subtitle}</p>}
      </div>
      <label className="shrink-0 flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-dashboard-base-content/45 uppercase tracking-wide">Revenue ₹</span>
        <Input
          type="number" min={0} inputMode="numeric"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          onBlur={save}
          placeholder="No target"
          className="h-8 w-28 text-xs text-right px-2"
        />
      </label>
      <label className="shrink-0 flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-dashboard-base-content/45 uppercase tracking-wide">Bookings</span>
        <Input
          type="number" min={0} inputMode="numeric"
          value={conversions}
          onChange={(e) => setConversions(e.target.value)}
          onBlur={save}
          placeholder="No target"
          className="h-8 w-20 text-xs text-center px-2"
        />
      </label>
      <div className="shrink-0 w-4 flex items-center justify-center">
        {saving
          ? <Loader2 className="size-3.5 animate-spin text-dashboard-base-content/40" />
          : savedAt > 0 && <CheckCircle2 className="size-3.5 text-dashboard-success" />}
      </div>
      <HistoryButton subjectId={subjectId} year={year} month={month} refreshKey={historyKey} />
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden bg-dashboard-base-100 border border-dashboard-base-300">
      <div className="flex items-center gap-2 px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
        <Icon className="size-4" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {children}
    </div>
  );
}

/** One team's card: its own target row, then every executive on that team
 * (leader included) nested right below it — the "team wise" grouping the
 * flat list used to lose. */
function TeamGroup({ team, year, month }: { team: TeamTargetRow; year: number; month: number }) {
  return (
    <div className="rounded-xl overflow-hidden bg-dashboard-base-100 border border-dashboard-base-300">
      <div className="flex items-center gap-2 px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral">
        <Users className="size-4" />
        <p className="text-sm font-semibold">{team.name}</p>
        {team.leaderName && (
          <span className="flex items-center gap-1 text-xs opacity-75">
            <Crown className="size-3" /> {team.leaderName}
          </span>
        )}
        <span className="ml-auto text-xs opacity-75">
          {team.members.length} member{team.members.length !== 1 ? "s" : ""}
        </span>
      </div>

      <TargetRow
        icon={Users}
        title="Team target"
        target={team.target}
        onSave={(values) => setTeamTarget(team.id, { year, month, ...values })}
        subjectId={team.id}
        year={year}
        month={month}
      />

      {team.members.length === 0 ? (
        <p className="px-4 py-4 pl-10 text-xs text-dashboard-base-content/45">No executives on this team yet.</p>
      ) : (
        team.members.map((m) => (
          <TargetRow
            key={m.id}
            icon={UserRound}
            title={m.name}
            subtitle={`${m.employeeId}${m.roleName ? ` · ${m.roleName}` : ""}`}
            target={m.target}
            onSave={(values) => setMemberTarget(m.id, { year, month, ...values })}
            subjectId={m.id}
            year={year}
            month={month}
            indent
          />
        ))
      )}
    </div>
  );
}

export function SalesTargetsClient({ data }: { data: SalesTargetsPageData }) {
  const router = useRouter();
  const [year, setYear] = useState(data.year);
  const [month, setMonth] = useState(data.month);

  function changeMonth(nextYear: number, nextMonth: number) {
    setYear(nextYear);
    setMonth(nextMonth);
    router.push(`/dashboard/sales-targets?year=${nextYear}&month=${nextMonth}`);
  }

  const years = Array.from({ length: 5 }, (_, i) => data.year - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-dashboard-base-content/60">Setting targets for</Label>
        <Select value={String(month)} onValueChange={(v) => changeMonth(year, Number(v))}>
          <SelectTrigger className="h-9 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => changeMonth(Number(v), month)}>
          <SelectTrigger className="h-9 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.teams.length === 0 ? (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-8 text-center text-sm text-dashboard-base-content/45">
          No sales teams yet — create one from Sales Teams first.
        </div>
      ) : (
        <div className="space-y-4">
          {data.teams.map((t: TeamTargetRow) => (
            <TeamGroup key={t.id} team={t} year={year} month={month} />
          ))}
        </div>
      )}

      {data.unassigned.length > 0 && (
        <Section title="Not yet on a team" icon={UserX}>
          {data.unassigned.map((m: MemberTargetRow) => (
            <TargetRow
              key={m.id}
              icon={UserRound}
              title={m.name}
              subtitle={`${m.employeeId}${m.roleName ? ` · ${m.roleName}` : ""}`}
              target={m.target}
              onSave={(values) => setMemberTarget(m.id, { year, month, ...values })}
              subjectId={m.id}
              year={year}
              month={month}
            />
          ))}
        </Section>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-dashboard-base-content/45">
        <Target className="size-3" />
        Team and individual targets are independent — a team&apos;s number isn&apos;t auto-computed from its members.
        Changes save as soon as you leave the field.
      </p>
    </div>
  );
}
