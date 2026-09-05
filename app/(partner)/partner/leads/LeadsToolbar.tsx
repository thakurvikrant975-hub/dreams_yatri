"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** The IST calendar day, as the browser would have to compute it — a partner
 * on a phone set to another timezone still means our day when they tap "Today". */
function istToday(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA formats as yyyy-mm-dd, which is exactly what <input type="date"> wants
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

const inputClass =
  "h-9 rounded-md border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 " +
  "outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5";

export default function LeadsToolbar({ destinations }: { destinations: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const q = params.get("q") ?? "";
  const dateField = params.get("dateField") === "travel" ? "travel" : "received";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const destination = params.get("destination") ?? "";
  const anyFilter = Boolean(q || from || to || destination);

  /**
   * Every change writes the whole filter set back to the URL and drops `page`.
   * The URL is the state, so a partner can bookmark "Goa, this month" or send
   * it to a colleague. It replaces rather than pushes: a debounced search box
   * would otherwise leave a history entry per pause in the typing, and Back
   * would walk letter by letter instead of leaving the page.
   */
  const apply = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // a narrower list starts at its own first page
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }, [params, pathname, router]);

  // The search box types faster than the server can answer, so it holds its
  // own value and only reaches the URL once typing pauses. When `q` moves on
  // its own — "Clear filters", a shared link, a page navigation — the box
  // follows the URL rather than the other way round.
  const [draft, setDraft] = useState(q);
  const [urlQ, setUrlQ] = useState(q);
  if (urlQ !== q) {
    setUrlQ(q);
    setDraft(q);
  }
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => apply({ q: draft }), 350);
    return () => clearTimeout(t);
  }, [draft, q, apply]);

  /**
   * The quick ranges read in the direction the chosen date runs: leads *came
   * in* over the last week, and customers *travel* in the coming one. A
   * backwards-looking preset on a travel date would only ever list trips the
   * agency has already missed.
   */
  const forward = dateField === "travel";
  const preset = (days: number) => apply(
    days === 0
      ? { from: istToday(), to: istToday() }
      : forward
        ? { from: istToday(), to: istToday(days - 1) }
        : { from: istToday(-(days - 1)), to: istToday() },
  );
  const presets: [string, number][] = [
    ["Today", 0],
    [forward ? "Next 7 days" : "Last 7 days", 7],
    [forward ? "Next 30 days" : "Last 30 days", 30],
  ];

  return (
    <div className="space-y-2.5 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search name, phone, email or destination"
            aria-label="Search leads"
            className={`${inputClass} w-full pr-8`}
          />
          {isPending && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">…</span>
          )}
        </div>

        {destinations.length > 0 && (
          <select
            value={destination}
            onChange={(e) => apply({ destination: e.target.value })}
            aria-label="Filter by destination"
            className={`${inputClass} max-w-[12rem]`}
          >
            <option value="">All destinations</option>
            {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={dateField}
          onChange={(e) => apply({ dateField: e.target.value })}
          aria-label="Which date to filter on"
          className={inputClass}
        >
          <option value="received">Received date</option>
          <option value="travel">Travel date</option>
        </select>

        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => apply({ from: e.target.value })}
          aria-label="From date"
          className={inputClass}
        />
        <span className="text-xs text-neutral-400">to</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => apply({ to: e.target.value })}
          aria-label="To date"
          className={inputClass}
        />

        <div className="flex items-center gap-1.5">
          {presets.map(([label, days]) => (
            <button
              key={label}
              type="button"
              onClick={() => preset(days)}
              className="cursor-pointer rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              {label}
            </button>
          ))}
        </div>

        {anyFilter && (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
            className="ml-auto cursor-pointer text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
