"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, IndianRupee, Users, Send, Trophy, TriangleAlert, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { StatCard } from "../../components/dashboard/Statcard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import type { AdsDashboardData } from "./actions";
import type { AdsPerformanceRow } from "@/app/lib/ads/reporting";

/**
 * The numbers all come from the server (app/lib/ads/reporting.ts); this file
 * only arranges them. Nothing is recomputed here — a rate shown next to a
 * count must be the same rate the CLI report prints.
 */

const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : "₹" + Math.round(n).toLocaleString("en-IN");
const pct = (n: number | null) => (n === null ? "—" : (n * 100).toFixed(1) + "%");
const count = (n: number) => n.toLocaleString("en-IN");

/** Preset windows, in days, ending today. */
const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function shiftDays(to: string, back: number) {
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (back - 1));
  return d.toISOString().slice(0, 10);
}

function freshness(lastSync: AdsDashboardData["lastSync"]) {
  if (!lastSync?.finishedAt) return { text: "never synced", stale: true };
  const finished = new Date(lastSync.finishedAt);
  const hours = (Date.now() - finished.getTime()) / 3_600_000;
  const when = hours < 1 ? "less than an hour ago" : hours < 24 ? `${Math.round(hours)} h ago` : `${Math.round(hours / 24)} d ago`;
  if (lastSync.status === "FAILED") return { text: `last sync failed, ${when}`, stale: true };
  // The schedule runs nightly, so anything past ~26 h means a run was missed.
  return { text: `synced ${when}`, stale: hours > 26 };
}

export function AdsPerformanceClient({ data }: { data: AdsDashboardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState(data.from);
  const [to, setTo] = useState(data.to);

  const adGroupsByCampaign = useMemo(() => {
    const map = new Map<string, AdsPerformanceRow[]>();
    for (const g of data.adGroups) {
      if (!g.parentId) continue;
      const list = map.get(g.parentId) ?? [];
      list.push(g);
      map.set(g.parentId, list);
    }
    return map;
  }, [data.adGroups]);

  const go = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom); setTo(nextTo);
    startTransition(() => router.push(`?from=${nextFrom}&to=${nextTo}`, { scroll: false }));
  };

  const t = data.totals;
  const sync = freshness(data.lastSync);

  return (
    <div className="space-y-5">
      {/* Range + freshness, one row above everything */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const active = data.days === p.days;
            return (
              <button
                key={p.days}
                onClick={() => go(shiftDays(data.to, p.days), data.to)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-dashboard-primary bg-dashboard-primary/10 text-dashboard-primary font-medium"
                    : "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200",
                )}
              >
                {p.label}
              </button>
            );
          })}
          <span className="mx-1 text-dashboard-base-content/30">|</span>
          <input type="date" value={from} max={to} onChange={(e) => go(e.target.value, to)}
            className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-2 py-1.5 text-sm" />
          <span className="text-dashboard-base-content/50 text-sm">to</span>
          <input type="date" value={to} min={from} onChange={(e) => go(from, e.target.value)}
            className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-2 py-1.5 text-sm" />
          {pending && <Loader2 className="h-4 w-4 animate-spin text-dashboard-base-content/50" />}
        </div>
        <p className={cn("flex items-center gap-1.5 text-xs", sync.stale ? "text-amber-600 dark:text-amber-500" : "text-dashboard-base-content/50")}>
          {sync.stale && <TriangleAlert className="h-3.5 w-3.5" />}
          Google data {sync.text}
        </p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Spend" value={inr(t.spend)} sub={`${count(t.clicks)} clicks`} icon={IndianRupee} />
        <StatCard label="Leads" value={count(t.leads)} sub={`${pct(t.clickToLead)} of clicks`} icon={Users} />
        <StatCard label="Cost per lead" value={inr(t.costPerLead)} sub={`${pct(t.junkRate)} never answered`} icon={IndianRupee} highlight />
        <StatCard label="Quoted" value={count(t.quoted)} sub={`${inr(t.costPerQuoted)} each`} icon={Send} />
        <StatCard label="Won" value={count(t.won)} sub={t.won ? `${inr(t.costPerWin)} each` : "none yet in this window"} icon={Trophy} />
        <StatCard label="Deal value" value={inr(t.dealValue)} sub="quoted, not collected" icon={IndianRupee} />
      </div>

      {/* Wins lag their leads, so say so rather than let 0.5% read as failure. */}
      <p className="text-xs text-dashboard-base-content/50">
        A lead is marked converted days after it arrives, so recent windows always understate wins.
        Deal value is the quoted price of won leads — what was agreed, not what has been collected.
      </p>

      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Campaign</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Click→lead</TableHead>
              <TableHead className="text-right">Cost/lead</TableHead>
              <TableHead className="text-right">Quoted</TableHead>
              <TableHead className="text-right">Won</TableHead>
              <TableHead className="text-right">No answer</TableHead>
              <TableHead className="text-right">Deal value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-dashboard-base-content/60">
                  No spend or leads in this window.
                </TableCell>
              </TableRow>
            )}
            {data.campaigns.map((c) => {
              const groups = adGroupsByCampaign.get(c.id) ?? [];
              const expanded = open.has(c.id);
              return (
                // The fragment is what the map returns, so the key belongs here.
                <Fragment key={c.id}>
                  <TableRow
                    className={cn(groups.length > 0 && "cursor-pointer")}
                    onClick={() => {
                      if (!groups.length) return;
                      const next = new Set(open);
                      if (expanded) next.delete(c.id); else next.add(c.id);
                      setOpen(next);
                    }}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {groups.length > 0 ? (
                          <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform text-dashboard-base-content/40", expanded && "rotate-90")} />
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span className="truncate">{c.name}</span>
                        {c.status !== "ENABLED" && (
                          <span className="rounded bg-dashboard-base-200 px-1.5 py-0.5 text-[10px] uppercase text-dashboard-base-content/60">
                            {c.status.toLowerCase()}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{inr(c.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.dailyBudget === null ? "—" : (
                        <span title={`₹${Math.round(c.dailyBudget).toLocaleString("en-IN")} a day`}>
                          {inr(c.dailyBudget)}/day
                          {c.budgetLostShare !== null && c.budgetLostShare > 0.2 && (
                            <span className="ml-1.5 text-amber-600 dark:text-amber-500">
                              {pct(c.budgetLostShare)} lost
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count(c.clicks)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(c.leads)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(c.clickToLead)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{inr(c.costPerLead)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(c.quoted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(c.won)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(c.junkRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(c.dealValue)}</TableCell>
                  </TableRow>

                  {expanded && groups.map((g) => (
                    <TableRow key={`${c.id}-${g.id}`} className="bg-dashboard-base-200/40">
                      <TableCell className="pl-10 text-sm text-dashboard-base-content/80">{g.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{inr(g.spend)}</TableCell>
                      <TableCell className="text-right text-sm text-dashboard-base-content/40">—</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{count(g.clicks)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{count(g.leads)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{pct(g.clickToLead)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{inr(g.costPerLead)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{count(g.quoted)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{count(g.won)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{pct(g.junkRate)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{inr(g.dealValue)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-dashboard-base-content/50">
        Spend, clicks and budgets come from Google Ads; leads, quotes, wins and deal value from our own records.
        Ad-group figures start 11 September, when ad-group tagging went live — campaign figures reach back further.
      </p>
    </div>
  );
}
