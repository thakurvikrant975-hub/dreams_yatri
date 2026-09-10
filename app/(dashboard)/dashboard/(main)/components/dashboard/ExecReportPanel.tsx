"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, RotateCcw, UsersRound } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { MinNumberFilter } from "./MinNumberFilter";
import type { LeadRow } from "../../actions/lead-manager-analytics-actions";
import {
  GROUP_MIN_PERSONS, NO_FILTERS, describeExecFilters, destinationLabel, execReportTitle, filterExecLeads,
  tallyLeads, type AssigneeFilter, type ExecReportFilters, type LeadOutcome,
} from "../../actions/leadReportTotals";

const ALL = "all";

type Option = { value: string; label: string };

/** One dropdown in the filter row — styled like TableFilters' selects so this
 * reads as the same filter bar the Queries tables use. */
function FilterSelect({
  value, onChange, allLabel, options, width,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: Option[];
  width: string;
}) {
  const active = value !== ALL;
  const itemClass = "text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          width,
          "h-10 text-sm rounded-lg cursor-pointer transition-colors",
          "border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70",
          "focus:ring-dashboard-primary/30 focus:border-dashboard-primary",
          active && "border-dashboard-primary/50 bg-dashboard-primary/5 text-dashboard-primary",
        )}
      >
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
        <SelectItem value={ALL} className={cn(itemClass, "text-dashboard-base-content/55")}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className={itemClass}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The lead manager's exec report: filter the range's handovers, see how many
 * match, download them as a PDF. Different filters make different reports —
 * one exec gives that exec's report, a minimum of 6 persons gives the group
 * report, a destination gives who was handed that destination's leads — with
 * the PDF dropping whichever breakdown a filter has collapsed to one row.
 *
 * Works on the rows the page already holds, so filtering is instant and the
 * report is exactly the population the rest of the page counts.
 */
export function ExecReportPanel({
  rows, from, to, generatedByName,
}: {
  rows: LeadRow[];
  from: string;
  to: string;
  generatedByName?: string;
}) {
  const [picked, setPicked] = useState<ExecReportFilters>(NO_FILTERS);
  const [includeLeadList, setIncludeLeadList] = useState(true);
  const [busy, setBusy] = useState(false);

  // Choices come from the range itself, so every option matches something.
  const choices = useMemo(() => {
    const execs = new Map<string, { name: string; isPartner: boolean }>();
    const destinations = new Set<string>();
    const sources = new Set<string>();
    for (const q of rows) {
      if (q.assignedTo && !execs.has(q.assignedTo)) {
        execs.set(q.assignedTo, { name: q.assignedToName?.trim() || "Unnamed", isPartner: q.isPartnerAgency });
      }
      destinations.add(destinationLabel(q.destination));
      sources.add(q.channel);
    }
    const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
    return {
      execs,
      assignees: [
        { value: "inhouse", label: "All our execs" },
        { value: "partners", label: "All partner agencies" },
        ...[...execs.entries()]
          .sort(([, a], [, b]) => Number(a.isPartner) - Number(b.isPartner) || a.name.localeCompare(b.name))
          .map(([id, e]) => ({ value: `exec:${id}`, label: e.isPartner ? `${e.name} (agency)` : e.name })),
      ],
      destinations: sorted(destinations),
      sources: sorted(sources),
    };
  }, [rows]);

  // A pick that the new range no longer contains (someone who got nothing
  // this week) falls back to "all" rather than silently matching nothing.
  const pickedExecId = picked.assignee.startsWith("exec:") ? picked.assignee.slice(5) : null;
  const filters: ExecReportFilters = {
    ...picked,
    assignee: pickedExecId && !choices.execs.has(pickedExecId) ? "all" : picked.assignee,
    destination: picked.destination && choices.destinations.includes(picked.destination) ? picked.destination : null,
    source: picked.source && choices.sources.includes(picked.source) ? picked.source : null,
  };
  const assigneeName = filters.assignee.startsWith("exec:") ? choices.execs.get(filters.assignee.slice(5))?.name : undefined;

  const matched = filterExecLeads(rows, filters);
  const tally = tallyLeads(matched);
  const title = execReportTitle(filters, assigneeName);
  const applied = describeExecFilters(filters, assigneeName);
  const groupsOnly = filters.minPersons === GROUP_MIN_PERSONS;

  const set = (patch: Partial<ExecReportFilters>) => setPicked((p) => ({ ...p, ...patch }));

  async function download() {
    setBusy(true);
    try {
      const { buildExecReportPdf } = await import("./execReportPdf");
      const pdf = buildExecReportPdf(matched, { filters, assigneeName, range: { from, to }, includeLeadList, generatedByName });
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      pdf.save(`${slug}-${from}_to_${to}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate the exec report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          width="w-52" allLabel="Everyone assigned" options={choices.assignees}
          value={filters.assignee}
          onChange={(v) => set({ assignee: v as AssigneeFilter })}
        />
        <FilterSelect
          width="w-44" allLabel="All destinations"
          options={choices.destinations.map((d) => ({ value: d, label: d }))}
          value={filters.destination ?? ALL}
          onChange={(v) => set({ destination: v === ALL ? null : v })}
        />
        <FilterSelect
          width="w-40" allLabel="All sources"
          options={choices.sources.map((s) => ({ value: s, label: s }))}
          value={filters.source ?? ALL}
          onChange={(v) => set({ source: v === ALL ? null : v })}
        />
        <FilterSelect
          width="w-36" allLabel="Any outcome"
          options={[{ value: "open", label: "Open" }, { value: "converted", label: "Converted" }, { value: "lost", label: "Lost" }]}
          value={filters.outcome ?? ALL}
          onChange={(v) => set({ outcome: v === ALL ? null : (v as LeadOutcome) })}
        />
        <MinNumberFilter
          label="Min persons" placeholder="Any" width="w-36"
          value={filters.minPersons}
          onChange={(v) => set({ minPersons: v === 0 ? null : v })}
        />
        <button
          type="button"
          onClick={() => set({ minPersons: groupsOnly ? null : GROUP_MIN_PERSONS })}
          aria-pressed={groupsOnly}
          className={cn(
            "inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm transition-colors cursor-pointer",
            groupsOnly
              ? "border-dashboard-primary/50 bg-dashboard-primary/5 text-dashboard-primary"
              : "border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 hover:bg-dashboard-base-200",
          )}
        >
          <UsersRound className="h-4 w-4" />
          Groups only ({GROUP_MIN_PERSONS}+)
        </button>
        {applied.length > 0 && (
          <button
            type="button"
            onClick={() => setPicked(NO_FILTERS)}
            className="inline-flex items-center gap-1 h-10 px-2 text-xs text-dashboard-base-content/55 hover:text-dashboard-base-content cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-lg bg-dashboard-base-200/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dashboard-base-content">{title}</p>
          <p className="text-xs text-dashboard-base-content/65 tabular-nums">
            {tally.leads} lead{tally.leads === 1 ? "" : "s"} · {tally.groups} group{tally.groups === 1 ? "" : "s"} ({GROUP_MIN_PERSONS}+ persons) · {tally.persons} persons · {tally.converted} converted
            {applied.length > 0 && <span className="text-dashboard-base-content/45"> — {applied.join(" · ")}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Checkbox
            checked={includeLeadList}
            onChange={() => setIncludeLeadList((v) => !v)}
            label={<span className="text-xs text-dashboard-base-content/70">List every lead</span>}
          />
          <button
            type="button"
            onClick={download}
            disabled={busy || matched.length === 0}
            title={matched.length === 0 ? "No leads match these filters" : undefined}
            className="inline-flex items-center gap-1.5 rounded-md bg-dashboard-primary px-3 py-2 text-xs font-semibold text-dashboard-primary-content hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            {busy ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
