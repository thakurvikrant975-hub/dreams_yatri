"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { cpl, EMPTY_SPEND, type SpendInput } from "./leadSheetPdf";
import type { LeadReportData, PaymentRow, Platform, Medium } from "./actions";

type Props = {
  data: LeadReportData;
  generatedByName?: string;
};

// ── Time helpers ───────────────────────────────────────────────────────────
// The picker deals only in IST wall-clock text ("2026-08-27T13:00"). Presets
// are built from formatted IST parts rather than the browser's own clock, so
// the page reads the same from anywhere.

const IST_TZ = "Asia/Kolkata";

function istLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function istDayOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return istLocal(d).slice(0, 10);
}

function fmtRangeLabel(fromLocal: string, toLocal: string): string {
  const fmt = (v: string, withYear: boolean) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(`${v}:00`));
  return `${fmt(fromLocal, false)} to ${fmt(toLocal, true)}`;
}

function fmtClock(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

/** "Today" / "Yesterday" / a plain date, for the payment day headings. The
 * comparison is against the IST day so a report read late at night still
 * calls the right bucket today. */
function dayLabel(dayKey: string): string {
  const today = istLocal(new Date()).slice(0, 10);
  const yesterday = istDayOffset(-1);
  if (dayKey === today) return "Today";
  if (dayKey === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${dayKey}T00:00:00`));
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const money = (n: number) => `₹${inr.format(Math.round(n))}`;

// ── Spend persistence ──────────────────────────────────────────────────────
// Spend isn't in the database (it lives in the ad consoles), so it's typed in
// here and remembered per-day in this browser — re-running the same day's
// report shouldn't mean re-typing the same numbers. Deliberately not shared
// state: another person opening the report sees empty fields.

const SPEND_KEY_PREFIX = "dy_lead_report_spend:";

function loadSpend(dayKey: string): SpendInput {
  try {
    const raw = localStorage.getItem(SPEND_KEY_PREFIX + dayKey);
    if (!raw) return EMPTY_SPEND;
    const parsed = JSON.parse(raw) as SpendInput;
    return {
      google: { budget: parsed.google?.budget ?? null, spent: parsed.google?.spent ?? null },
      meta: { budget: parsed.meta?.budget ?? null, spent: parsed.meta?.spent ?? null },
      perDestination: parsed.perDestination ?? {},
    };
  } catch {
    return EMPTY_SPEND;
  }
}

function saveSpend(dayKey: string, spend: SpendInput) {
  try {
    localStorage.setItem(SPEND_KEY_PREFIX + dayKey, JSON.stringify(spend));
  } catch {
    // Private windows and blocked site data just mean the numbers aren't
    // remembered — never a reason to break the report.
  }
}

function hasAnySpend(spend: SpendInput): boolean {
  return spend.google.spent != null || spend.meta.spent != null
    || Object.values(spend.perDestination).some((v) => v > 0);
}

// ── Shared bits ────────────────────────────────────────────────────────────

const PLATFORM_TEXT: Record<Platform, string> = {
  GOOGLE: "text-[#EA4335]",
  META: "text-[#1877F2]",
  OTHER: "text-dashboard-base-content/60",
};

const MEDIUM_LABEL: Record<Medium, string> = { FORM: "form", CALL: "call", WHATSAPP: "WhatsApp" };

function sourcePhrase(platform: Platform | null, medium: Medium | null): string {
  if (!platform || !medium) return "Direct";
  const p = platform === "OTHER" ? "Untagged" : platform === "GOOGLE" ? "Google" : "Meta";
  return `${p} ${MEDIUM_LABEL[medium]}`;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-dashboard-base-content">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashboard-base-300 bg-dashboard-base-100", className)}>
      {children}
    </div>
  );
}

/** A bare rupee input. Used only inside the spend drawer, so it stays small
 * and unlabelled-by-default — the surrounding row carries the label. */
function MoneyInput({
  value, onChange, placeholder, className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-1 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 h-8",
      "focus-within:border-dashboard-primary", className,
    )}>
      <span className="text-dashboard-base-content/40 text-xs">₹</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v === "" ? null : Math.max(0, Number(v)));
        }}
        className="w-full bg-transparent outline-none text-sm tabular-nums"
      />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function LeadReportClient({ data, generatedByName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const [from, setFrom] = useState(data.range.fromLocal);
  const [to, setTo] = useState(data.range.toLocal);
  const [customOpen, setCustomOpen] = useState(false);
  const [destSpendOpen, setDestSpendOpen] = useState(false);
  const [spend, setSpend] = useState<SpendInput>(EMPTY_SPEND);

  // The window's start date keys the remembered spend — a report running from
  // yesterday 11am belongs to yesterday's ad spend.
  const spendDayKey = data.range.fromLocal.slice(0, 10);

  // Read in an effect, not in useState's initialiser: localStorage doesn't
  // exist during the server render and reading it inline would mismatch on
  // hydration. The per-destination list unfolds itself when it already holds
  // figures, so she isn't opening it to find her own numbers.
  useEffect(() => {
    const loaded = loadSpend(spendDayKey);
    setSpend(loaded);
    if (Object.keys(loaded.perDestination).length > 0) setDestSpendOpen(true);
  }, [spendDayKey]);

  useEffect(() => {
    setFrom(data.range.fromLocal);
    setTo(data.range.toLocal);
  }, [data.range.fromLocal, data.range.toLocal]);

  const updateSpend = useCallback((next: SpendInput) => {
    setSpend(next);
    saveSpend(spendDayKey, next);
  }, [spendDayKey]);

  const applyRange = useCallback((nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo || nextFrom > nextTo) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  }, [router, searchParams]);

  const presets = useMemo(() => {
    const now = istLocal(new Date());
    const today = now.slice(0, 10);
    const yesterday = istDayOffset(-1);
    // `endsNow` presets run to the current minute, which has moved on by the
    // time the page renders — so they're matched on their start alone. Their
    // starts are distinct, so there's no ambiguity.
    return [
      { label: "Today", from: `${today}T00:00`, to: now, endsNow: true },
      { label: "Yesterday", from: `${yesterday}T00:00`, to: `${yesterday}T23:59`, endsNow: false },
      { label: "Since yesterday 11 AM", from: `${yesterday}T11:00`, to: now, endsNow: true },
    ];
  }, []);

  const invalid = Boolean(from && to && from > to);
  const google = data.platforms[0];
  const meta = data.platforms[1];
  const other = data.platforms[2];

  const showCpl = hasAnySpend(spend);
  const totalSpent = (spend.google.spent ?? 0) + (spend.meta.spent ?? 0);
  const blendedCpl = showCpl ? cpl(totalSpent, data.totals.leads) : null;

  // Destinations offered for spend entry are the ones that actually got leads.
  const destNames = useMemo(
    () => data.destinations.filter((d) => d.destination !== "Not specified").map((d) => d.destination),
    [data.destinations],
  );

  const destSpendCount = Object.values(spend.perDestination).filter((v) => v > 0).length;

  function setDestSpend(destination: string, value: number | null) {
    const next = { ...spend, perDestination: { ...spend.perDestination } };
    const key = destination.toLowerCase();
    if (value == null) delete next.perDestination[key];
    else next.perDestination[key] = value;
    updateSpend(next);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const { buildLeadSheetPdf } = await import("./leadSheetPdf");
      const pdf = buildLeadSheetPdf(data, spend, { generatedByName });
      pdf.save(`lead-report-${data.range.fromLocal}_to_${data.range.toLocal}.pdf`.replace(/:/g, ""));
      toast.success("Report downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  // Payments grouped by IST day — "yesterday night" and "today" are separate
  // boxes on the handwritten sheet, and on a window that spans midnight one
  // undifferentiated list loses that.
  const paymentDays = useMemo(() => {
    const groups = new Map<string, PaymentRow[]>();
    for (const p of data.payments) {
      const bucket = groups.get(p.dayKey) ?? [];
      bucket.push(p);
      groups.set(p.dayKey, bucket);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dayKey, rows]) => ({
        dayKey,
        label: dayLabel(dayKey),
        rows,
        total: rows.reduce((sum, r) => sum + r.amount, 0),
      }));
  }, [data.payments]);

  return (
    <div className="space-y-7 max-w-5xl">

      {/* ── Everything needed to produce the report, in one card ───────── */}
      {/* Spend lives here rather than further down the page: it feeds the
          cost-per-lead figures the report is partly about, so it belongs
          beside the button that generates it, not below the output. */}
      <Panel className="divide-y divide-dashboard-base-300">

        {/* Time window */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-dashboard-base-content/50">Time window</p>
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => {
              const active = !customOpen
                && data.range.fromLocal === p.from
                && (p.endsNow || data.range.toLocal === p.to);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setCustomOpen(false); applyRange(p.from, p.to); }}
                  className={cn(
                    "h-9 px-3.5 rounded-md text-sm transition-colors cursor-pointer border",
                    active
                      ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary font-medium"
                      : "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomOpen((v) => !v)}
              className={cn(
                "h-9 px-3.5 rounded-md text-sm border transition-colors cursor-pointer",
                customOpen
                  ? "border-dashboard-primary text-dashboard-primary font-medium"
                  : "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200",
              )}
            >
              Custom range
            </button>
          </div>

          {customOpen && (
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-dashboard-base-content/60">From</span>
                <input
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 text-sm outline-none focus:border-dashboard-primary cursor-pointer"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-dashboard-base-content/60">To</span>
                <input
                  type="datetime-local"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className={cn(
                    "h-9 rounded-md border bg-dashboard-base-100 px-2.5 text-sm outline-none cursor-pointer",
                    invalid ? "border-red-400" : "border-dashboard-base-300 focus:border-dashboard-primary",
                  )}
                />
              </label>
              <button
                type="button"
                disabled={invalid || isPending}
                onClick={() => applyRange(from, to)}
                className="h-9 px-4 rounded-md bg-dashboard-primary text-dashboard-primary-content text-sm font-medium disabled:opacity-40 hover:opacity-90 cursor-pointer"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Show"}
              </button>
              {invalid && <span className="text-xs text-red-500 self-center">Start is after end.</span>}
            </div>
          )}

          <p className="text-sm text-dashboard-base-content/60">
            Showing {fmtRangeLabel(data.range.fromLocal, data.range.toLocal)} · all times IST
          </p>
        </div>

        {/* Ad spend */}
        <div className="p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-dashboard-base-content/50">
              Ad spend
              <span className="ml-2 normal-case tracking-normal text-dashboard-base-content/45 font-normal">
                optional — fills in cost per lead
              </span>
            </p>
            {showCpl && (
              <span className="text-xs text-dashboard-base-content/50">
                saved in this browser for {spendDayKey}
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {([["Google", "google"], ["Meta", "meta"]] as const).map(([label, key]) => {
              const sp = spend[key];
              const block = key === "google" ? google : meta;
              const value = sp.spent != null ? cpl(sp.spent, block.total) : null;
              return (
                <div key={key} className="flex items-end gap-2">
                  <span className={cn("text-sm font-medium w-14 shrink-0 pb-2", PLATFORM_TEXT[key === "google" ? "GOOGLE" : "META"])}>
                    {label}
                  </span>
                  <label className="flex-1 min-w-0 space-y-1">
                    <span className="text-xs text-dashboard-base-content/60">Budget</span>
                    <MoneyInput
                      value={sp.budget}
                      placeholder="5783"
                      onChange={(v) => updateSpend({ ...spend, [key]: { ...sp, budget: v } })}
                    />
                  </label>
                  <label className="flex-1 min-w-0 space-y-1">
                    <span className="text-xs text-dashboard-base-content/60">Spent</span>
                    <MoneyInput
                      value={sp.spent}
                      placeholder="4852"
                      onChange={(v) => updateSpend({ ...spend, [key]: { ...sp, spent: v } })}
                    />
                  </label>
                  <span className="w-20 shrink-0 pb-2 text-right text-xs tabular-nums text-dashboard-base-content/60">
                    {value != null ? <>CPL <span className="font-semibold text-dashboard-base-content">{money(value)}</span></> : null}
                  </span>
                </div>
              );
            })}
          </div>

          {destNames.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setDestSpendOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-dashboard-base-content/60 hover:text-dashboard-base-content cursor-pointer"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", destSpendOpen && "rotate-180")} />
                Spend per destination
                {destSpendCount > 0 && <span className="text-dashboard-base-content/45">· {destSpendCount} filled</span>}
              </button>
              {destSpendOpen && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2.5">
                  {destNames.map((dest) => (
                    <label key={dest} className="flex items-center gap-2">
                      <span className="text-xs text-dashboard-base-content/70 flex-1 truncate">{dest}</span>
                      <MoneyInput
                        className="w-24 shrink-0"
                        value={spend.perDestination[dest.toLowerCase()] ?? null}
                        onChange={(v) => setDestSpend(dest, v)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generate */}
        <div className="px-4 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-dashboard-primary text-dashboard-primary-content text-sm font-medium hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </button>
        </div>
      </Panel>

      {/* ── The numbers ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-dashboard-base-300 rounded-lg border border-dashboard-base-300 bg-dashboard-base-100">
        {[
          { label: "Leads received", value: String(data.totals.leads), sub: null },
          { label: "Given to team", value: String(data.totals.assignedInWindow), sub: null },
          {
            label: "Cost per lead",
            value: blendedCpl != null ? money(blendedCpl) : "—",
            sub: blendedCpl != null ? `${money(totalSpent)} spent` : "add ad spend",
          },
          {
            label: "Payments",
            value: String(data.payments.length),
            sub: data.payments.length > 0 ? money(data.paymentsTotal) : null,
          },
        ].map((st) => (
          <div key={st.label} className="px-4 py-4">
            <p className="text-2xl font-semibold tabular-nums text-dashboard-base-content">{st.value}</p>
            <p className="text-xs text-dashboard-base-content/60 mt-1">
              {st.label}
              {st.sub && <span className="text-dashboard-base-content/80 font-medium"> · {st.sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* ── Step 3: where they came from ───────────────────────────────── */}
      {/* No cost-per-lead readout here — it's one of the four headline numbers
          above, and repeating it read as two different figures at a glance. */}
      <Section title="Where the leads came from">
        <div className="grid sm:grid-cols-2 gap-3">
          {[google, meta].map((block) => {
            const key = block.platform === "GOOGLE" ? "google" : "meta";
            const s = spend[key as "google" | "meta"];
            const value = s.spent != null ? cpl(s.spent, block.total) : null;
            return (
              <Panel key={block.platform} className="p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className={cn("text-sm font-semibold", PLATFORM_TEXT[block.platform])}>{block.label}</h3>
                  <span className="text-2xl font-semibold tabular-nums text-dashboard-base-content">{block.total}</span>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  {([
                    ["Form / mail", block.formLeads],
                    ["Calling", block.callLeads],
                    ["WhatsApp", block.whatsappLeads],
                  ] as const).map(([label, v]) => (
                    <div key={label} className="flex items-center justify-between">
                      <dt className="text-dashboard-base-content/60">{label}</dt>
                      <dd className="tabular-nums text-dashboard-base-content">{v}</dd>
                    </div>
                  ))}
                </dl>
                {value != null && (
                  <p className="mt-3 pt-2.5 border-t border-dashboard-base-300 text-sm flex items-center justify-between">
                    <span className="text-dashboard-base-content/60">Cost per lead</span>
                    <span className="font-semibold tabular-nums text-dashboard-base-content">{money(value)}</span>
                  </p>
                )}
              </Panel>
            );
          })}
        </div>

        {/* One quiet line rather than a warning card — it's a caveat, not an
            error, and it should read as a footnote to the two panels above. */}
        {other.total > 0 && (
          <p className="text-xs text-dashboard-base-content/50">
            {other.total} more lead{other.total === 1 ? "" : "s"} had no source tag
            ({other.formLeads} form · {other.callLeads} calling · {other.whatsappLeads} WhatsApp)
            {data.totals.untaggedCalls > 0 && <> — the calling counts above are understated by {data.totals.untaggedCalls}.</>}
          </p>
        )}
      </Section>

      {/* ── Step 4: destinations ───────────────────────────────────────── */}
      <Section title="Destinations">
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-dashboard-base-content/50 border-b border-dashboard-base-300">
                <th className="text-left font-normal px-4 py-2.5">Destination</th>
                <th className="text-right font-normal px-3 py-2.5">Leads</th>
                <th className="text-right font-normal px-3 py-2.5">Google</th>
                <th className="text-right font-normal px-3 py-2.5">Meta</th>
                {showCpl && <th className="text-right font-normal px-4 py-2.5">Cost per lead</th>}
              </tr>
            </thead>
            <tbody>
              {data.destinations.length === 0 ? (
                <tr>
                  <td colSpan={showCpl ? 5 : 4} className="px-4 py-8 text-center text-dashboard-base-content/50">
                    No leads in this window.
                  </td>
                </tr>
              ) : data.destinations.map((row) => {
                const destCpl = cpl(spend.perDestination[row.destination.toLowerCase()] ?? null, row.total);
                return (
                  <tr key={row.destination} className="border-b border-dashboard-base-300/50 last:border-0">
                    <td className="px-4 py-2.5 text-dashboard-base-content">{row.destination}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-dashboard-base-content">{row.total}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-dashboard-base-content/60">{row.google}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-dashboard-base-content/60">{row.meta}</td>
                    {showCpl && (
                      <td className="px-4 py-2.5 text-right tabular-nums text-dashboard-base-content/60">
                        {destCpl != null ? money(destCpl) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </Section>

      {/* ── Payments, split by day ────────────────────────────────────── */}
      {/* One list per IST day rather than one flat table: on a window that
          runs from last night to this afternoon, "what came in overnight" and
          "what came in today" are two different answers, and the sheet this
          replaces always kept them in separate boxes. */}
      <Section
        title="Payments"
        action={data.payments.length > 0
          ? <span className="text-xs text-dashboard-base-content/60">{money(data.paymentsTotal)} total</span>
          : undefined}
      >
        {paymentDays.length === 0 ? (
          <Panel className="px-4 py-8 text-center text-sm text-dashboard-base-content/50">
            No payments in this window.
          </Panel>
        ) : paymentDays.map((day) => (
          <Panel key={day.dayKey} className="overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 bg-dashboard-base-200/60 border-b border-dashboard-base-300">
              <span className="text-sm font-medium text-dashboard-base-content">{day.label}</span>
              <span className="text-xs text-dashboard-base-content/60">
                {day.rows.length} payment{day.rows.length === 1 ? "" : "s"} · {money(day.total)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-dashboard-base-content/50 border-b border-dashboard-base-300">
                    <th className="text-left font-normal px-4 py-2">Time</th>
                    <th className="text-left font-normal px-3 py-2">Client</th>
                    <th className="text-left font-normal px-3 py-2">Sales exec</th>
                    <th className="text-left font-normal px-3 py-2">Destination</th>
                    <th className="text-left font-normal px-3 py-2">Source</th>
                    <th className="text-right font-normal px-4 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {day.rows.map((p) => (
                    <tr key={p.id} className="border-b border-dashboard-base-300/50 last:border-0">
                      <td className="px-4 py-2.5 text-dashboard-base-content/60 whitespace-nowrap">{fmtClock(p.paidAt)}</td>
                      <td className="px-3 py-2.5 text-dashboard-base-content">{p.clientName}</td>
                      <td className="px-3 py-2.5 text-dashboard-base-content/60">{p.agentName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-dashboard-base-content/60">{p.destination ?? "—"}</td>
                      <td className="px-3 py-2.5 text-dashboard-base-content/60">{sourcePhrase(p.platform, p.medium)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-dashboard-base-content">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      </Section>
    </div>
  );
}
