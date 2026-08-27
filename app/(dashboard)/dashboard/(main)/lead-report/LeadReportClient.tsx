"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock, Download, Loader2, Plus, X, Wallet, TriangleAlert,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { cpl, EMPTY_SPEND, type SpendInput } from "./leadSheetPdf";
import type { LeadReportData, Platform, Medium } from "./actions";

type Props = {
  data: LeadReportData;
  generatedByName?: string;
};

// ── Time helpers ───────────────────────────────────────────────────────────
// Everything the picker deals in is IST wall-clock text ("2026-08-27T13:00").
// Building the presets from the formatted IST parts rather than from the
// browser's own clock keeps the page honest for anyone running it from a
// different timezone.

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
  return `${fmt(fromLocal, false)} → ${fmt(toLocal, true)}`;
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ, day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const money = (n: number) => `₹${inr.format(Math.round(n))}`;

// ── Spend persistence ──────────────────────────────────────────────────────
// The spend figures aren't in the database yet (they live in the ad
// consoles), so they're typed in here and remembered per-day in this
// browser. That means re-running the same day's report doesn't mean
// re-typing the same numbers, without pretending this is shared state —
// a second person opening the report sees empty spend fields.

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

// ── Small presentational pieces ────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden", className)}>
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, children, hint }: { icon?: React.ElementType; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-dashboard-base-300">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-dashboard-primary shrink-0" />}
        <h2 className="text-sm font-semibold text-dashboard-base-content">{children}</h2>
      </div>
      {hint && <span className="text-[11px] text-dashboard-base-content/50 text-right">{hint}</span>}
    </div>
  );
}

function NumberField({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">{label}</span>
      <div className="flex items-center gap-1 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 h-9 focus-within:ring-2 focus-within:ring-dashboard-primary/40">
        <span className="text-dashboard-base-content/40 text-sm">₹</span>
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
    </label>
  );
}

const PLATFORM_STYLE: Record<Platform, { ring: string; text: string; bar: string }> = {
  GOOGLE: { ring: "border-t-[#EA4335]", text: "text-[#EA4335]", bar: "bg-[#EA4335]" },
  META: { ring: "border-t-[#1877F2]", text: "text-[#1877F2]", bar: "bg-[#1877F2]" },
  OTHER: { ring: "border-t-dashboard-base-300", text: "text-dashboard-base-content/60", bar: "bg-dashboard-base-content/40" },
};

const MEDIUM_LABEL: Record<Medium, string> = { FORM: "form", CALL: "call", WHATSAPP: "WhatsApp" };

function sourcePhrase(platform: Platform | null, medium: Medium | null): string {
  if (!platform || !medium) return "Direct / no lead";
  const p = platform === "OTHER" ? "Untagged" : platform === "GOOGLE" ? "Google" : "Meta";
  return `${p} ${MEDIUM_LABEL[medium]}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

export function LeadReportClient({ data, generatedByName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const [from, setFrom] = useState(data.range.fromLocal);
  const [to, setTo] = useState(data.range.toLocal);
  const [spend, setSpend] = useState<SpendInput>(EMPTY_SPEND);
  const [extraDest, setExtraDest] = useState("");

  // The window's start date keys the remembered spend — a report that runs
  // from yesterday 11am belongs to yesterday's ad spend.
  const spendDayKey = data.range.fromLocal.slice(0, 10);

  // Loaded in an effect rather than in useState's initializer: localStorage
  // doesn't exist during the server render, and reading it inline would
  // produce a hydration mismatch.
  useEffect(() => {
    setSpend(loadSpend(spendDayKey));
  }, [spendDayKey]);

  const updateSpend = useCallback((next: SpendInput) => {
    setSpend(next);
    saveSpend(spendDayKey, next);
  }, [spendDayKey]);

  useEffect(() => {
    setFrom(data.range.fromLocal);
    setTo(data.range.toLocal);
  }, [data.range.fromLocal, data.range.toLocal]);

  const dirty = from !== data.range.fromLocal || to !== data.range.toLocal;
  const invalid = Boolean(from && to && from > to);

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
    return [
      { label: "Today so far", from: `${today}T00:00`, to: now },
      { label: "Yesterday", from: `${yesterday}T00:00`, to: `${yesterday}T23:59` },
      { label: "Since yesterday 11 AM", from: `${yesterday}T11:00`, to: now },
      { label: "Last night onwards", from: `${yesterday}T20:00`, to: now },
    ];
  }, []);

  const google = data.platforms[0];
  const meta = data.platforms[1];
  const other = data.platforms[2];

  const totalSpent = (spend.google.spent ?? 0) + (spend.meta.spent ?? 0);
  const anySpend = spend.google.spent != null || spend.meta.spent != null;
  const blendedCpl = anySpend ? cpl(totalSpent, data.totals.leads) : null;

  // Destinations offered for spend entry: the ones that actually got leads,
  // plus any the user added by hand for spend that produced none.
  const destKeys = useMemo(() => {
    const keys = data.destinations
      .filter((d) => d.destination !== "Not specified")
      .map((d) => d.destination);
    const known = new Set(keys.map((k) => k.toLowerCase()));
    for (const key of Object.keys(spend.perDestination)) {
      if (!known.has(key.toLowerCase())) {
        keys.push(key.replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
    return keys;
  }, [data.destinations, spend.perDestination]);

  function setDestSpend(destination: string, value: number | null) {
    const next = { ...spend, perDestination: { ...spend.perDestination } };
    const key = destination.toLowerCase();
    if (value == null) delete next.perDestination[key];
    else next.perDestination[key] = value;
    updateSpend(next);
  }

  function addDestination() {
    const name = extraDest.trim();
    if (!name) return;
    setDestSpend(name, 0);
    setExtraDest("");
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

  const leadCount = data.totals.leads;

  return (
    <div className="space-y-5">
      {/* ── Range bar ──────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-dashboard-base-200">
            {presets.map((p) => {
              const active = data.range.fromLocal === p.from && data.range.toLocal === p.to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setFrom(p.from); setTo(p.to); applyRange(p.from, p.to); }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                    active
                      ? "bg-dashboard-primary text-dashboard-primary-content shadow-sm"
                      : "text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-100",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">From</span>
              <div className="flex items-center gap-1.5 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 h-9">
                <CalendarClock className="h-3.5 w-3.5 text-dashboard-base-content/40 shrink-0" />
                <input
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="bg-transparent outline-none text-sm cursor-pointer"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">To</span>
              <div className={cn(
                "flex items-center gap-1.5 rounded-md border bg-dashboard-base-100 px-2 h-9",
                invalid ? "border-red-400" : "border-dashboard-base-300",
              )}>
                <CalendarClock className="h-3.5 w-3.5 text-dashboard-base-content/40 shrink-0" />
                <input
                  type="datetime-local"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="bg-transparent outline-none text-sm cursor-pointer"
                />
              </div>
            </label>
            <button
              type="button"
              disabled={invalid || !dirty || isPending}
              onClick={() => applyRange(from, to)}
              className={cn(
                "h-9 px-4 rounded-md text-xs font-semibold transition-colors",
                invalid || !dirty
                  ? "bg-dashboard-base-200 text-dashboard-base-content/40 cursor-not-allowed"
                  : "bg-dashboard-primary text-dashboard-primary-content hover:opacity-90 cursor-pointer",
              )}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-dashboard-base-content/50 hidden lg:inline">
              All times IST
            </span>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-dashboard-primary text-dashboard-primary-content text-xs font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download PDF
            </button>
          </div>
        </div>

        {invalid && (
          <p className="px-4 pb-3 text-xs text-red-500">
            The “from” time is after the “to” time.
          </p>
        )}
      </Card>

      {/* ── Summary strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total leads", value: String(leadCount) },
          { label: "Given to team", value: String(data.totals.assignedInWindow) },
          { label: "Payments", value: String(data.payments.length) },
          { label: "Payment value", value: money(data.paymentsTotal) },
          { label: "Blended CPL", value: blendedCpl != null ? money(blendedCpl) : "—" },
        ].map((s) => (
          <Card key={s.label} className="px-4 py-3">
            <p className="text-xl font-semibold text-dashboard-base-content tabular-nums">{s.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-dashboard-base-content/50 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      <p className="text-xs text-dashboard-base-content/50 -mt-2">
        Window: {fmtRangeLabel(data.range.fromLocal, data.range.toLocal)}
      </p>

      {/* ── Ad spend entry ─────────────────────────────────────────────── */}
      <Card>
        <CardTitle icon={Wallet} hint="Not stored in the database yet — remembered in this browser for this date">
          Ad spend for this window
        </CardTitle>
        <div className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {([
              ["Google", "google"],
              ["Meta", "meta"],
            ] as const).map(([label, key]) => {
              const block = key === "google" ? google : meta;
              const s = spend[key];
              const value = s.spent != null ? cpl(s.spent, block.total) : null;
              return (
                <div key={key} className="rounded-lg border border-dashboard-base-300 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-semibold", PLATFORM_STYLE[key === "google" ? "GOOGLE" : "META"].text)}>
                      {label}
                    </span>
                    <span className="text-xs text-dashboard-base-content/50">{block.total} leads</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="Budget"
                      value={s.budget}
                      placeholder="5783"
                      onChange={(v) => updateSpend({ ...spend, [key]: { ...s, budget: v } })}
                    />
                    <NumberField
                      label="Spent"
                      value={s.spent}
                      placeholder="4852"
                      onChange={(v) => updateSpend({ ...spend, [key]: { ...s, spent: v } })}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-dashboard-base-300">
                    <span className="text-dashboard-base-content/50 pt-2">
                      {s.budget != null && s.spent != null
                        ? `Budget left ${money(Math.max(0, s.budget - s.spent))}`
                        : "Enter budget and spend"}
                    </span>
                    <span className="font-semibold text-dashboard-base-content pt-2 tabular-nums">
                      CPL {value != null ? money(value) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-destination spend */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">
              Spend by destination (optional)
            </p>
            {destKeys.length === 0 ? (
              <p className="text-xs text-dashboard-base-content/50">
                No destinations in this window yet.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {destKeys.map((dest) => {
                  const row = data.destinations.find((d) => d.destination.toLowerCase() === dest.toLowerCase());
                  const leads = row?.total ?? 0;
                  const value = spend.perDestination[dest.toLowerCase()] ?? null;
                  const destCpl = cpl(value, leads);
                  return (
                    <div key={dest} className="flex items-center gap-2 rounded-md border border-dashboard-base-300 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate text-dashboard-base-content">{dest}</p>
                        <p className="text-[11px] text-dashboard-base-content/50 tabular-nums">
                          {leads} lead{leads === 1 ? "" : "s"}
                          {destCpl != null && <> · CPL {money(destCpl)}</>}
                          {value != null && leads === 0 && <span className="text-red-500"> · no leads</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 rounded border border-dashboard-base-300 px-1.5 h-8 w-24 shrink-0">
                        <span className="text-dashboard-base-content/40 text-xs">₹</span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            setDestSpend(dest, v === "" ? null : Math.max(0, Number(v)));
                          }}
                          className="w-full bg-transparent outline-none text-xs tabular-nums"
                        />
                      </div>
                      {value != null && (
                        <button
                          type="button"
                          onClick={() => setDestSpend(dest, null)}
                          className="text-dashboard-base-content/30 hover:text-red-500 transition-colors shrink-0"
                          aria-label={`Clear spend for ${dest}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* A destination can take budget and return nothing — it won't be
                in the lead data, so it has to be addable by hand. */}
            <div className="flex items-center gap-2 pt-1">
              <input
                value={extraDest}
                onChange={(e) => setExtraDest(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDestination(); } }}
                placeholder="Add a destination with spend but no leads…"
                className="h-8 flex-1 max-w-xs rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 text-xs outline-none focus:ring-2 focus:ring-dashboard-primary/40"
              />
              <button
                type="button"
                onClick={addDestination}
                disabled={!extraDest.trim()}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-dashboard-base-300 text-xs font-medium hover:bg-dashboard-base-200 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Platform panels ────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {[google, meta].map((block) => {
          const key = block.platform === "GOOGLE" ? "google" : "meta";
          const s = spend[key as "google" | "meta"];
          const style = PLATFORM_STYLE[block.platform];
          const value = s.spent != null ? cpl(s.spent, block.total) : null;
          return (
            <Card key={block.platform} className={cn("border-t-2", style.ring)}>
              <div className="p-4 space-y-3">
                <h3 className={cn("text-sm font-semibold", style.text)}>Leads by {block.label}</h3>
                <dl className="space-y-1.5 text-sm">
                  {[
                    ["Form / mail leads", block.formLeads],
                    ["Calling leads", block.callLeads],
                    ["WhatsApp leads", block.whatsappLeads],
                  ].map(([label, v]) => (
                    <div key={String(label)} className="flex items-center justify-between">
                      <dt className="text-dashboard-base-content/60">{label}</dt>
                      <dd className="font-semibold tabular-nums text-dashboard-base-content">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-center justify-between rounded-md bg-dashboard-base-200 px-3 py-2">
                  <span className="text-sm font-semibold text-dashboard-base-content">Total {block.label} leads</span>
                  <span className="text-sm font-bold tabular-nums text-dashboard-base-content">{block.total}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-dashboard-base-content/60">
                  <span>{block.assigned} assigned · {block.unassigned} unassigned</span>
                  {value != null && (
                    <span className={cn("font-semibold", style.text)}>CPL {money(value)}</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {other.total > 0 && (
        <Card className="border-amber-300/60">
          <div className="flex items-start gap-2.5 px-4 py-3">
            <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-dashboard-base-content">
                {other.total} lead{other.total === 1 ? "" : "s"} not attributed to a platform
              </p>
              <p className="text-dashboard-base-content/60 mt-0.5">
                {other.formLeads} form · {other.callLeads} calling · {other.whatsappLeads} WhatsApp.
                {data.totals.untaggedCalls > 0 && (
                  <> {data.totals.untaggedCalls} of these {data.totals.untaggedCalls === 1 ? "is a phone lead" : "are phone leads"} entered without a source tag, so the calling counts above are understated.</>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Destination table ──────────────────────────────────────────── */}
      <Card>
        <CardTitle hint="CPL uses the spend entered above">Leads by destination</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashboard-base-300 text-[11px] uppercase tracking-wide text-dashboard-base-content/50">
                <th className="text-left font-medium px-4 py-2">Destination</th>
                <th className="text-right font-medium px-3 py-2">Leads</th>
                <th className="text-right font-medium px-3 py-2">Google</th>
                <th className="text-right font-medium px-3 py-2">Meta</th>
                <th className="text-right font-medium px-3 py-2">Other</th>
                <th className="text-right font-medium px-3 py-2">Assigned</th>
                <th className="text-right font-medium px-4 py-2">CPL</th>
              </tr>
            </thead>
            <tbody>
              {data.destinations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-dashboard-base-content/50 text-xs">
                    No leads in this window.
                  </td>
                </tr>
              ) : data.destinations.map((row) => {
                const destSpend = spend.perDestination[row.destination.toLowerCase()] ?? null;
                const destCpl = cpl(destSpend, row.total);
                return (
                  <tr key={row.destination} className="border-b border-dashboard-base-300/60 last:border-0">
                    <td className="px-4 py-2 font-medium text-dashboard-base-content">{row.destination}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{row.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-dashboard-base-content/60">{row.google}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-dashboard-base-content/60">{row.meta}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-dashboard-base-content/60">{row.other}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-dashboard-base-content/60">{row.assigned}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {destCpl != null ? money(destCpl) : <span className="text-dashboard-base-content/30">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Payments ───────────────────────────────────────────────────── */}
      <Card>
        <CardTitle hint={data.payments.length > 0 ? `${money(data.paymentsTotal)} total` : undefined}>
          Payments received
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashboard-base-300 text-[11px] uppercase tracking-wide text-dashboard-base-content/50">
                <th className="text-left font-medium px-4 py-2">Time</th>
                <th className="text-left font-medium px-3 py-2">Client</th>
                <th className="text-left font-medium px-3 py-2">Sales exec</th>
                <th className="text-left font-medium px-3 py-2">Destination</th>
                <th className="text-left font-medium px-3 py-2">Source</th>
                <th className="text-right font-medium px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-dashboard-base-content/50 text-xs">
                    No payments captured in this window.
                  </td>
                </tr>
              ) : data.payments.map((p) => (
                <tr key={p.id} className="border-b border-dashboard-base-300/60 last:border-0">
                  <td className="px-4 py-2 text-dashboard-base-content/60 whitespace-nowrap">{fmtTime(p.paidAt)}</td>
                  <td className="px-3 py-2 font-medium text-dashboard-base-content">{p.clientName}</td>
                  <td className="px-3 py-2 text-dashboard-base-content/60">{p.agentName ?? "—"}</td>
                  <td className="px-3 py-2 text-dashboard-base-content/60">{p.destination ?? "—"}</td>
                  <td className="px-3 py-2 text-dashboard-base-content/60">{sourcePhrase(p.platform, p.medium)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-600">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
