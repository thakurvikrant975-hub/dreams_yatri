"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { copyFilteredLeads } from "./copy-all";
import { fmtDate, fmtDateTime, leadToText, leadsToText, type PartnerLeadRow } from "./lead-format";

/**
 * Put text on the clipboard.
 *
 * The async API is the path everywhere it exists; the hidden-textarea fallback
 * is for the older Android WebViews a small agency still runs, where losing
 * the copy silently would be worse than an old-fashioned execCommand.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function LeadsTable({
  rows,
  total,
  firstIndex,
}: {
  rows: PartnerLeadRow[];
  /** How many leads the current filters match, across every page. */
  total: number;
  /** 1-based position of this page's first row, for the row numbers. */
  firstIndex: number;
}) {
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isCopyingAll, startCopyAll] = useTransition();

  // A new page (or a new filter) is a new set of leads; a tick left over from
  // the previous list would copy rows the partner can no longer see. Dropped
  // during the render that brings the new rows in, so the checkboxes are never
  // painted stale for a frame.
  const pageKey = useMemo(() => rows.map((r) => r.id).join(","), [rows]);
  const [shownKey, setShownKey] = useState(pageKey);
  if (shownKey !== pageKey) {
    setShownKey(pageKey);
    setSelected(new Set());
  }

  // Both transient labels clear themselves, so the bar never sits on a stale
  // "Copied" from a minute ago.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (id: string | null, message: string | null) => {
    setCopiedId(id);
    setNote(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setCopiedId(null); setNote(null); }, 2500);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPage = selected.size > 0 && !allOnPage;
  const headBox = useRef<HTMLInputElement>(null);
  useEffect(() => { if (headBox.current) headBox.current.indeterminate = someOnPage; }, [someOnPage]);

  const copyOne = async (l: PartnerLeadRow) => {
    const ok = await writeClipboard(leadToText(l));
    flash(ok ? l.id : null, ok ? null : "Could not copy — your browser blocked it.");
  };

  const copySelected = async () => {
    const picked = rows.filter((r) => selected.has(r.id));
    if (!picked.length) return;
    const ok = await writeClipboard(leadsToText(picked));
    flash(null, ok
      ? `Copied ${picked.length} lead${picked.length === 1 ? "" : "s"}.`
      : "Could not copy — your browser blocked it.");
  };

  /** Everything the filters match, fetched fresh — the other pages are not
   * in the browser, so this one goes back to the server for them. */
  const copyAll = () => startCopyAll(async () => {
    const result = await copyFilteredLeads(Object.fromEntries(params.entries()));
    if (!result.ok) { flash(null, result.error); return; }
    const ok = await writeClipboard(result.text);
    if (!ok) { flash(null, "Could not copy — your browser blocked it."); return; }
    flash(null, result.truncated
      ? `Copied the first ${result.count} of ${result.total} leads. Narrow the filters to copy the rest.`
      : `Copied ${result.count} lead${result.count === 1 ? "" : "s"}.`);
  });

  const box = "size-4 cursor-pointer accent-neutral-900";

  return (
    <div className="space-y-2">
      {/* Copy bar — always offers "all", and the selection when there is one. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copySelected}
          disabled={selected.size === 0}
          className="cursor-pointer rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-white"
        >
          Copy selected{selected.size ? ` (${selected.size})` : ""}
        </button>
        <button
          type="button"
          onClick={copyAll}
          disabled={total === 0 || isCopyingAll}
          className="cursor-pointer rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-white"
        >
          {isCopyingAll ? "Copying…" : `Copy all ${total}`}
        </button>
        {note && <span aria-live="polite" className="text-xs text-neutral-500">{note}</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs text-neutral-500">
              <th className="w-10 px-3 py-2.5 text-left font-normal">
                <input
                  ref={headBox}
                  type="checkbox"
                  className={box}
                  checked={allOnPage}
                  onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
                  aria-label="Select every lead on this page"
                  disabled={rows.length === 0}
                />
              </th>
              <th className="w-10 px-2 py-2.5 text-right font-normal">#</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-normal">Received</th>
              <th className="px-3 py-2.5 text-left font-normal">Name</th>
              <th className="px-3 py-2.5 text-left font-normal">Phone</th>
              <th className="px-3 py-2.5 text-left font-normal">Email</th>
              <th className="px-3 py-2.5 text-left font-normal">Destination</th>
              <th className="px-3 py-2.5 text-right font-normal">People</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-normal">Travel date</th>
              <th className="w-16 px-3 py-2.5 text-right font-normal">Copy</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-neutral-500">
                  No leads match these filters.
                </td>
              </tr>
            ) : rows.map((l, i) => (
              <tr
                key={l.id}
                className={`border-b border-neutral-100 last:border-0 ${selected.has(l.id) ? "bg-neutral-50" : ""}`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    className={box}
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                    aria-label={`Select ${l.name}`}
                  />
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-xs text-neutral-400">{firstIndex + i}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{fmtDateTime(l.receivedAt)}</td>
                <td className="px-3 py-3 font-medium text-neutral-900">{l.name}</td>
                {/* Tappable on a phone — this is a list to be called from. */}
                <td className="whitespace-nowrap px-3 py-3">
                  <a href={`tel:${l.phone}`} className="text-neutral-900 hover:underline">{l.phone}</a>
                </td>
                <td className="px-3 py-3 text-neutral-600">
                  {l.email ? <a href={`mailto:${l.email}`} className="hover:underline">{l.email}</a> : "—"}
                </td>
                <td className="px-3 py-3 text-neutral-600">{l.destination ?? "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums text-neutral-600">{l.groupSize ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{fmtDate(l.travelDate)}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => copyOne(l)}
                    className="cursor-pointer rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                    aria-label={`Copy ${l.name}'s details`}
                  >
                    {copiedId === l.id ? "Copied" : "Copy"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
