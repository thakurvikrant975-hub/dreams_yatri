"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Users, MapPin, PieChart as PieChartIcon, TrendingUp, Download, Phone, CalendarClock,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DateRangePicker } from "../ui/date-range-picker";
import { StatCard, StatGrid } from "./Statcard";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { BreakdownPieChart } from "./charts/BreakdownPieChart";
import { RankedBarChart } from "./charts/RankedBarChart";
import { DataTable, type ColumnDef } from "./Datatable";
import type { LeadManagerAnalyticsData, LeadRow } from "../../actions/lead-manager-analytics-actions";

type Props = {
  data: LeadManagerAnalyticsData;
  from: string;
  to: string;
  generatedByName?: string;
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
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

  const todaysLeadCols: ColumnDef<LeadRow>[] = [
    { header: "Time", width: "w-[70px]", cell: (r) => <span className="text-xs text-dashboard-base-content/60 whitespace-nowrap">{fmtTime(r.createdAt)}</span> },
    { header: "Name", cell: (r) => (
      <div>
        <div className="text-sm font-medium text-dashboard-base-content">{r.name}</div>
        <div className="text-xs text-dashboard-neutral">{r.phone}</div>
      </div>
    ) },
    { header: "Destination", cell: (r) => <span className="text-sm text-dashboard-base-content">{r.destination?.trim() || "—"}</span> },
    { header: "Source", cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.channel}</span> },
    { header: "Status", align: "right", cell: (r) => <StatusPill status={r.status} /> },
  ];

  const reportCols: ColumnDef<LeadRow>[] = [
    { header: "Date", width: "w-[100px]", sortKey: (r) => r.createdAt, cell: (r) => (
      <div className="text-xs text-dashboard-base-content/70 whitespace-nowrap">
        {fmtDate(r.createdAt)} · {fmtTime(r.createdAt)}
      </div>
    ) },
    { header: "Lead", sortKey: (r) => r.name.toLowerCase(), cell: (r) => (
      <div>
        <div className="text-sm font-medium text-dashboard-base-content">{r.name}</div>
        <div className="text-xs text-dashboard-neutral">{r.phone}</div>
      </div>
    ) },
    { header: "Destination", sortKey: (r) => r.destination?.toLowerCase() ?? "", cell: (r) => <span className="text-sm text-dashboard-base-content">{r.destination?.trim() || "—"}</span> },
    { header: "Source", sortKey: (r) => r.channel, cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.channel}</span> },
    { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
    { header: "Assigned To", cell: (r) => <span className="text-sm text-dashboard-base-content/80">{r.assignedToName ?? "Unassigned"}</span> },
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

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <StatGrid cols={5}>
        <StatCard
          label="Today's Leads" value={data.summary.todayLeads} icon={CalendarClock}
          iconColor="bg-dashboard-primary/10" iconText="text-dashboard-primary"
          sub={new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}
        />
        <StatCard
          label="Total Leads" value={data.summary.totalLeads} icon={Users}
          iconColor="bg-dashboard-info/10" iconText="text-dashboard-info"
          sub={rangeLabel}
        />
        <StatCard
          label="Converted" value={data.summary.converted} icon={TrendingUp}
          iconColor="bg-dashboard-success/10" iconText="text-dashboard-success"
          sub="this range"
        />
        <StatCard
          label="Conv. Rate" value={`${data.summary.convRate}%`} icon={PieChartIcon}
          iconColor="bg-dashboard-warning/10" iconText="text-dashboard-warning"
          sub="converted / total leads"
        />
        <StatCard
          label="Destinations" value={data.summary.uniqueDestinations} icon={MapPin}
          iconColor="bg-dashboard-secondary/10" iconText="text-dashboard-secondary"
          sub="distinct destinations reached"
        />
      </StatGrid>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard>
          <DashCardHeader>
            <TrendingUp className="h-4 w-4" />
            <p className="text-sm font-semibold">Leads over time</p>
          </DashCardHeader>
          <div className="p-4">
            <TrendAreaChart
              data={data.dailyTrend}
              series={[{ key: "leads", label: "Leads", color: "var(--color-dashboard-primary)" }]}
            />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <PieChartIcon className="h-4 w-4" />
            <p className="text-sm font-semibold">Leads by source</p>
          </DashCardHeader>
          <div className="p-4">
            <BreakdownPieChart data={data.byChannel} showLabels />
          </div>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader>
            <MapPin className="h-4 w-4" />
            <p className="text-sm font-semibold">Leads by destination ({data.byDestination.length})</p>
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
          <p className="text-sm font-semibold">Today&apos;s leads ({data.todaysLeads.length})</p>
        </DashCardHeader>
        <DataTable
          data={data.todaysLeads}
          columns={todaysLeadCols}
          rowKey={(r) => r.id}
          emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">No leads have come in today yet.</p>}
        />
      </DashCard>

      {/* ── Full report ───────────────────────────────────────────────────── */}
      <DashCard>
        <DashCardHeader>
          <Users className="h-4 w-4" />
          <p className="text-sm font-semibold">Full lead report — {rangeLabel} ({data.reportRows.length})</p>
        </DashCardHeader>
        <DataTable
          data={pagedReportRows}
          columns={reportCols}
          rowKey={(r) => r.id}
          emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">No leads in this range.</p>}
          pagination={{
            currentPage: reportPage,
            totalPages: reportTotalPages,
            onPageChange: setReportPage,
            pageSize: reportPageSize,
            onPageSizeChange: (n) => { setReportPageSize(n); setReportPage(1); },
            label: `Showing ${data.reportRows.length === 0 ? 0 : (reportPage - 1) * reportPageSize + 1}–${Math.min(reportPage * reportPageSize, data.reportRows.length)} of ${data.reportRows.length} leads`,
          }}
        />
      </DashCard>
    </div>
  );
}
