"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Target, Users, UserRound, CheckCircle2 } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  setMemberTarget, setTeamTarget,
  type SalesTargetsPageData, type MemberTargetRow, type TeamTargetRow,
} from "./actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : Math.max(0, n);
}

/** One row's local edit state, saved on blur — same convention as
 * AutoAssignSettingsDialog's MemberRow: responsive typing, no save on every
 * keystroke. */
function TargetRow({
  icon: Icon, title, subtitle, target, onSave,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  target: { revenueTarget: number | null; conversionTarget: number | null };
  onSave: (values: { revenueTarget: number | null; conversionTarget: number | null }) => Promise<{ success: boolean; error?: string }>;
}) {
  const [revenue, setRevenue] = useState(target.revenueTarget?.toString() ?? "");
  const [conversions, setConversions] = useState(target.conversionTarget?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  async function save() {
    setSaving(true);
    const result = await onSave({ revenueTarget: num(revenue), conversionTarget: num(conversions) });
    setSaving(false);
    if (result.success) setSavedAt(Date.now());
    else toast.error(result.error ?? "Failed to save target");
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-dashboard-base-300 last:border-b-0">
      <span className="shrink-0 flex items-center justify-center size-8 rounded-full bg-dashboard-primary/10 text-dashboard-primary">
        <Icon className="size-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-dashboard-base-content truncate">{title}</p>
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

      <Section title="Sales Teams" icon={Users}>
        {data.teams.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-dashboard-base-content/45">
            No sales teams yet — create one from Sales Teams first.
          </p>
        ) : (
          data.teams.map((t: TeamTargetRow) => (
            <TargetRow
              key={t.id}
              icon={Users}
              title={t.name}
              subtitle={`${t.memberCount} member${t.memberCount !== 1 ? "s" : ""}${t.leaderName ? ` · led by ${t.leaderName}` : ""}`}
              target={t.target}
              onSave={(values) => setTeamTarget(t.id, { year, month, ...values })}
            />
          ))
        )}
      </Section>

      <Section title="Sales Executives" icon={UserRound}>
        {data.members.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-dashboard-base-content/45">
            No sales executives found.
          </p>
        ) : (
          data.members.map((m: MemberTargetRow) => (
            <TargetRow
              key={m.id}
              icon={UserRound}
              title={m.name}
              subtitle={`${m.employeeId}${m.roleName ? ` · ${m.roleName}` : ""}`}
              target={m.target}
              onSave={(values) => setMemberTarget(m.id, { year, month, ...values })}
            />
          ))
        )}
      </Section>

      <p className="flex items-center gap-1.5 text-[11px] text-dashboard-base-content/45">
        <Target className="size-3" />
        Team and individual targets are independent — a team&apos;s number isn&apos;t auto-computed from its members.
        Changes save as soon as you leave the field.
      </p>
    </div>
  );
}
