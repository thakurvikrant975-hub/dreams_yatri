"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Users, MapPin, PieChart as PieChartIcon, TrendingUp, Download, Phone, CalendarClock,
  UserCheck, Handshake,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { istDayOffset } from "../../lead-report/ist";
import { DateRangePicker } from "../ui/date-range-picker";
import { StatCard, StatGrid } from "./Statcard";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { BreakdownPieChart } from "./charts/BreakdownPieChart";
import { RankedBarChart } from "./charts/RankedBarChart";
import { DataTable, type ColumnDef } from "./Datatable";
import type { AssigneeRow, LeadManagerAnalyticsData, LeadRow } from "../../actions/lead-manager-analytics-actions";

type Props = {
  data: LeadManagerAnalyticsData;
  from: string;
  to: string;
  generatedByName?: string;
};

// IST calendar days. toISOString() gives the UTC date, so before 5:30am the
// "Today" button asked for yesterday — and then didn't light up, because the
// range it had just set no longer matched what it computed.
function todayStr() {
  return istDayOffset(0);
}
function daysAgoStr(n: number) {
  return istDayOffset(-n);
}
function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
}
function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

const STATUS_STYLES: Record<string, string> = {
  CONVERTED: "bg-green-100 text-green-700",
  PAYMENT_INITIATED: "bg-green-100 text-green-700",
  CLIENT_ACCEPTED: "bg-emerald-100 text-emerald-700",
  CLIENT_DECLINED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  CLOSED: "bg-dashboard-base-300 text-dashboard-base-content",
  FOLLOW_UP: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-dashboard-base-300 text-dashboard-base-content",
  VERIFIED: "bg-cyan-100 text-cyan-700",
  PACKAGE_SENT: "bg-indigo-100 text-indigo-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[status] ?? "bg-dashboard-base-300 text-dashboard-base-content")}>
      {statusLabel(status)}
    </span>
  );
}

function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl overflow-hidden bg-dashboard-base-100 border border-dashboard-base-300", className)}>
      {children}
    </div>
  );
}
function DashCardHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
      <div className="flex items-center gap-2">{children}</div>
      {action}
    </div>
  );
}

/** One block of "who got them" — a ranked list with the subtotal stated on
 * the header, so the split can be read without adding the rows up. Bars are
 * scaled within the block: the two blocks answer different questions and a
 * shared scale would flatten the smaller one into invisibility. */
function AssigneeCard({
  title, icon, rows, subtotal, share, empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: AssigneeRow[];
  subtotal: number;
  share: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <DashCard>
      <DashCardHeader
        action={
          <span className="text-xs font-semibold tabular-nums">
            {subtotal} <span className="font-normal opacity-70">· {share}</span>
          </span>
        }
      >
        {icon}
        <p className="text-sm font-semibold">{title}</p>
      </DashCardHeader>
      {rows.length === 0 ? (
        <p className="text-sm text-dashboard-base-content/45 py-8 px-4">{empty}</p>
      ) : (
        <ul className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-dashboard-base-content">{r.name}</span>
              <div className="flex-1 h-2 rounded-full bg-dashboard-base-200 overflow-hidden">
                <div className="h-full rounded-full bg-dashboard-primary" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-sm font-semibold text-dashboard-base-content tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}

export function LeadManagerAnalytics({ data, from, to, generatedByName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(25);

  const isToday = from === todayStr() && to === todayStr();
  const isLast7 = from === daysAgoStr(6) && to === todayStr();
  const isLast30 = from === daysAgoStr(29) && to === todayStr();

  function setRange(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  const rangeLabel = from === to
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${from}T00:00:00`))
    : `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${from}T00:00:00`))} – ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${to}T00:00:00`))}`;

  // Every share on this page is of the handover total, so the tiles and the
  // per-assignee tables can be read against each other.
  const handedOver = data.summary.handedOverInRange;
  const pct = (n: number) => (handedOver > 0 ? `${Math.round((n / handedOver) * 100)}%` : "0%");

  const reportTotalPages = Math.max(1, Math.ceil(data.reportRows.length / reportPageSize));
  const pagedReportRows = useMemo(
    () => data.reportRows.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize),
    [data.reportRows, reportPage, reportPageSize],
  );

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const { buildLeadReportPdf } = await import("./leadReportPdf");
      const pdf = buildLeadReportPdf(data, { generatedByName });
      pdf.save(`lead-report-${from}_to_${to}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate the report PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const agencyTag = (r: LeadRow) =>
    r.isPartnerAgency ? (
      <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-dashboard-secondary/15 text-dashboard-secondary">
        Agency
      </span>
    ) : null;

  const todaysLeadCols: ColumnDef<LeadRow>[] = [
    // The handover time, not the arrival time — this table is today's
    // handovers, and stamping it with when the lead first came in made rows
    // from last night look like they were logged at the wrong hour.
    { header: "Handed at", width: "w-[80px]", cell: (r) => <span className="text-xs text-dashboard-base-content/60 whitespace-nowrap">{r.assignedAt ? fmtTime(r.assignedAt) : "—"}</span> },
    { header: "Name", cell: (r) => (
      <div>
        <div className="text-sm font-medium text-dashboard-base-content">{r.name}</div>
        <div className="text-xs text-dashboard-neutral">{r.phone}</div>
      </div>
    ) },
    { header: "Assigned to", cell: (r) => (
      <span className="text-sm text-dashboard-base-content/80">
        {r.assignedToName ?? "—"}{agencyTag(r)}
      </span>
    ) },
    { header: "Destination", cell: (r) => <span className="text-sm text-dashboard-base-content">{r.destination?.trim() || "—"}</span> },
    { header: "Status", align: "right", cell: (r) => <StatusPill status={r.status} /> },
  ];

  const reportCols: ColumnDef<LeadRow>[] = [
    { header: "Handed over", width: "w-[110px]", sortKey: (r) => r.assignedAt ?? "", cell: (r) => (
      <div className="text-xs text-dashboard-base-content/70 whitespace-nowrap">
        {r.assignedAt ? `${fmtDate(r.assignedAt)} · ${fmtTime(r.assignedAt)}` : "—"}
      </div>
    ) },
    // Kept beside it so the wait is visible: this is the column that explains
    // why a handover total and an intake total never match.
    { header: "Came in", width: "w-[100px]", sortKey: (r) => r.createdAt, cell: (r) => (
      <div className="text-xs text-dashboard-base-content/45 whitespace-nowrap">
        {fmtDate(r.createdAt)} · {fmtTime(r.createdAt)}
      </div>
    ) },
    { header: "Lead", sortKey: (r) => r.name.toLowerCase(), cell: (r) => (
      <div>
        <div className="text-sm font-medium text-dashboard-base-content">{r.name}</div>
        <div className="text-xs text-dashboard-neutral">{r.phone}</div>
      </div>
    ) },
    { header: "Assigned to", sortKey: (r) => r.assignedToName?.toLowerCase() ?? "", cell: (r) => (
      <span className="text-sm text-dashboard-base-content/80">
        {r.assignedToName ?? "—"}{agencyTag(r)}
      </span>
    ) },
    { header: "Destination", sortKey: (r) => r.destination?.toLowerCase() ?? "", cell: (r) => <span className="text-sm text-dashboard-base-content">{r.destination?.trim() || "—"}</span> },
    { header: "Source", sortKey: (r) => r.channel, cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.channel}</span> },
    { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      {/* ── Range controls + download ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 justify-between">
        <div className="flex items-center gap-1.5">
          {[
            { label: "Today", active: isToday, onClick: () => setRange(todayStr(), todayStr()) },
            { label: "Last 7 days", active: isLast7, onClick: () => setRange(daysAgoStr(6), todayStr()) },
            { label: "Last 30 days", active: isLast30, onClick: () => setRange(daysAgoStr(29), todayStr()) },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.onClick}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                b.active
                  ? "bg-dashboard-primary text-dashboard-primary-content"
                  : "bg-dashboard-base-200 text-dashboard-base-content/70 hover:bg-dashboard-base-300",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker from={from} to={to} onFromChange={(v) => setRange(v, to)} onToChange={(v) => setRange(from, v)} />
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-md bg-dashboard-primary px-3 py-2 text-xs font-semibold text-dashboard-primary-content hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Generating…" : "Download Report (PDF)"}
          </button>
        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────
          Every tile counts handovers, so they reconcile with each other:
          in-house + agency = handed over in range. Intake is deliberately
          not up here — it is a different population, and standing it beside
          these was what made the report read as broken. */}
      <StatGrid cols={5}>
        <StatCard
          label="Handed over today" value={data.summary.handedOverToday} icon={CalendarClock}
          iconColor="bg-dashboard-primary/10" iconText="text-dashboard-primary"
          sub={new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date())}
        />
        <StatCard
          label="Handed over (range)" value={data.summary.handedOverInRange} icon={Users}
          iconColor="bg-dashboard-info/10" iconText="text-dashboard-info"
          sub={rangeLabel}
        />
        <StatCard
          label="To our execs" value={data.summary.inHouse} icon={UserCheck}
          iconColor="bg-dashboard-success/10" iconText="text-dashboard-success"
          sub={`${pct(data.summary.inHouse)} of handovers`}
        />
        <StatCard
          label="To partner agencies" value={data.summary.partnerAgency} icon={Handshake}
          iconColor="bg-dashboard-secondary/10" iconText="text-dashboard-secondary"
          sub={`${pct(data.summary.partnerAgency)} of handovers`}
        />
        <StatCard
          label="Converted" value={data.summary.converted} icon={TrendingUp}
          iconColor="bg-dashboard-warning/10" iconText="text-dashboard-warning"
          sub={`${data.summary.convRate}% of handovers`}
        />
      </StatGrid>

      {/* Intake, stated plainly as the different thing it is. A lead that
          came in last night and went out this morning is one arrival and one
          handover on two different days, so these two numbers are not meant
          to match — saying so is the whole point of this strip. */}
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-200/40 px-4 py-3">
        <p className="text-xs text-dashboard-base-content/70">
          <span className="font-semibold text-dashboard-base-content">For context — leads received</span>{" "}
          in this range: <span className="font-semibold tabular-nums">{data.summary.receivedInRange}</span>
          {", of which "}
          <span className="font-semibold tabular-nums">{data.summary.unassignedInRange}</span>
          {" are still waiting for an owner. "}
          <span className="text-dashboard-base-content/50">
            This will not match the handover figures above and is not meant to: a lead that arrived
            last night and was passed on this morning is counted on the night it came in here, and
            on the day it was handed over everywhere else.
          </span>
        </p>
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard>
          <DashCardHeader>
            <TrendingUp className="h-4 w-4" />
            <p className="text-sm font-semibold">Leads handed over per day</p>
          </DashCardHeader>
          <div className="p-4">
            <TrendAreaChart
              data={data.dailyTrend}
              series={[{ key: "leads", label: "Handed over", color: "var(--color-dashboard-primary)" }]}
            />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <PieChartIcon className="h-4 w-4" />
            <p className="text-sm font-semibold">Handed-over leads by source</p>
          </DashCardHeader>
          <div className="p-4">
            <BreakdownPieChart data={data.byChannel} showLabels />
          </div>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader>
            <MapPin className="h-4 w-4" />
            <p className="text-sm font-semibold">Handed-over leads by destination ({data.byDestination.length})</p>
          </DashCardHeader>
          {/* Every destination is shown (no "Other" catch-all) — capped to a
             scrollable viewport so a long tail of destinations doesn't blow
             out the card's height; sorted highest-first so the ones that
             matter are visible without scrolling. */}
          <div className="p-4 max-h-105 overflow-y-auto">
            <RankedBarChart data={data.byDestination} height={Math.max(180, data.byDestination.length * 34)} showValues />
          </div>
        </DashCard>
      </div>

      {/* ── Today's leads ─────────────────────────────────────────────────── */}
      <DashCard>
        <DashCardHeader>
          <Phone className="h-4 w-4" />
          <p className="text-sm font-semibold">Handed over today ({data.todaysLeads.length})</p>
        </DashCardHeader>
        <DataTable
          data={data.todaysLeads}
          columns={todaysLeadCols}
          rowKey={(r) => r.id}
          emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">Nothing has been handed out to anyone yet today.</p>}
        />
      </DashCard>

      {/* ── Who got them ──────────────────────────────────────────────────
          Split rather than one ranked list: in-house and sold-on are
          different outcomes, and a lead manager reads that split before the
          ranking. The two subtotals add back up to the handover total, which
          is what makes this table checkable against the day's mails. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AssigneeCard
          title="Our sales executives"
          icon={<UserCheck className="h-4 w-4" />}
          rows={data.byAssignee.inHouse}
          subtotal={data.summary.inHouse}
          share={pct(data.summary.inHouse)}
          empty="No leads went to our own execs in this range."
        />
        <AssigneeCard
          title="Partner agencies"
          icon={<Handshake className="h-4 w-4" />}
          rows={data.byAssignee.partners}
          subtotal={data.summary.partnerAgency}
          share={pct(data.summary.partnerAgency)}
          empty="No leads were sold on in this range."
        />
      </div>

      {/* ── Full report ───────────────────────────────────────────────────── */}
      <DashCard>
        <DashCardHeader>
          <Users className="h-4 w-4" />
          <p className="text-sm font-semibold">Every handover — {rangeLabel} ({data.reportRows.length})</p>
        </DashCardHeader>
        <DataTable
          data={pagedReportRows}
          columns={reportCols}
          rowKey={(r) => r.id}
          emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">Nothing was handed out in this range.</p>}
          pagination={{
            currentPage: reportPage,
            totalPages: reportTotalPages,
            onPageChange: setReportPage,
            pageSize: reportPageSize,
            onPageSizeChange: (n) => { setReportPageSize(n); setReportPage(1); },
            label: `Showing ${data.reportRows.length === 0 ? 0 : (reportPage - 1) * reportPageSize + 1}–${Math.min(reportPage * reportPageSize, data.reportRows.length)} of ${data.reportRows.length} handovers`,
          }}
        />
      </DashCard>
    </div>
  );
}
