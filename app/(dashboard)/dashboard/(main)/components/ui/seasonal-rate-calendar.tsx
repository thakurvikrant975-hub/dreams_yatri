"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown, X, Plus, Pencil, Trash2, AlertCircle,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  type RateSeasonBase,
  type RateGroup,
  trimOverlaps,
  groupSeasonsByRate,
  resolveColorOptions,
  rangesOverlap,
  formatDateLabel,
  defaultRangeLabel,
  darkenColor,
} from "./seasonal-rate-calendar-logic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** New id generator kept in one place so both split-pieces (from trimming)
 * and brand-new seasons get the same id shape. */
function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `season-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface SeasonalRateCalendarItem {
  id: string;
  label: string;
  baseRate: number;
  /** Optional weekend override for the base rate — if set and different from
   * baseRate, Saturdays/Sundays are shown in a distinct (still neutral) gray
   * on the calendar wherever no explicit season covers that date. */
  baseWeekendRate?: number | null;
}

// Neutral, deliberately unsaturated fills for "this date has no explicit
// season yet — it's priced at the base rate" — kept visually quiet so the
// calendar isn't overwhelming before any real seasons exist, and so real
// season colors (from the curated palette) stay visually distinct.
const BASE_RATE_WEEKDAY_COLOR = "#e5e7eb";
const BASE_RATE_WEEKEND_COLOR = "#cbd5e1";

export interface SeasonalRateCalendarProps<T extends RateSeasonBase> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** e.g. "The Grand Hotel · Kochi" */
  subtitle?: string;
  items: SeasonalRateCalendarItem[];
  activeItemId: string;
  onActiveItemChange: (itemId: string) => void;
  /** Every season for EVERY item — the component only ever writes back the
   * full array (see onSave), since trimming can touch several records at once.
   * Only the entries belonging to `changedItemId` can actually differ from
   * what was passed in via `seasons` — every other item's entries are passed
   * through unchanged, so callers managing multiple real (already-persisted)
   * items only need to act on that one item's slice. */
  seasons: T[];
  onSave: (next: T[], changedItemId: string) => void | Promise<void>;
  currencySymbol?: string;
  /** e.g. "per night", "per day" — shown after the base rate in the item dropdown. */
  unitLabel?: string;
  /** Extra domain-specific inputs (e.g. weekend price, extra bed rate, per-km
   * vs per-day) rendered inside the add/edit form, between the rate field and
   * the color picker. Merge any changes into the draft via `onChange`. */
  renderExtraFields?: (ctx: { draft: Partial<T>; onChange: (patch: Partial<T>) => void }) => React.ReactNode;
  /** Called only when starting a brand-new (non-editing) season for the
   * active item, to seed the draft with sensible defaults — e.g. the item's
   * own base rate/weekend rate/extra bed rate — so a new season starts equal
   * to the base pricing and the user only changes what's actually different.
   * Not called when editing an existing season. `rate` is already seeded
   * from `item.baseRate` before this runs, so this only needs to add
   * domain-specific fields (or override rate if desired). */
  getDefaultDraft?: (item: SeasonalRateCalendarItem) => Partial<T>;
  /** Derives the "pricing profile" key deciding whether two seasons share a
   * color/group in the sidebar — defaults to just the headline `rate`.
   * Widen this (e.g. to fold in weekend rate / extra bed rates) so seasons
   * only share a color when their FULL pricing profile matches. */
  getGroupKey?: (season: T) => string;
  /** A season's own weekend override for its headline rate, if it has one —
   * when this differs from the season's `rate`, Saturdays/Sundays within
   * that season's range are shown in a darker shade of its color. */
  getSeasonWeekendRate?: (season: T) => number | null | undefined;
  /** Extra summary rendered under a rate group's headline price in the
   * sidebar (e.g. weekend rate, extra bed rate) — receives one representative
   * season from the group, since a group only forms when `getGroupKey` agrees
   * every entry's full pricing profile matches. */
  renderGroupExtra?: (representativeSeason: T) => React.ReactNode;
}

// Deliberately non-generic: TS can't verify plain field updates (e.g.
// `{ label: "x" }`) are assignable to `Partial<T>` when T is an unconstrained
// generic, even though every T extends RateSeasonBase. The draft is cast to
// T only once, at save time, and to `Partial<T>` only where handed to the
// caller-supplied renderExtraFields render-prop.
type Draft = Partial<RateSeasonBase> & Record<string, unknown>;

// Client-only-mounted flag without a setState-in-effect, so createPortal
// never fires during SSR/hydration but still updates for the first client render.
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function SeasonalRateCalendar<T extends RateSeasonBase>({
  open, onOpenChange, title = "Seasonal Rate Calendar", subtitle,
  items, activeItemId, onActiveItemChange, seasons, onSave,
  currencySymbol = "₹", unitLabel, renderExtraFields, getDefaultDraft,
  getGroupKey = (s: T) => String(s.rate),
  getSeasonWeekendRate,
  renderGroupExtra,
}: SeasonalRateCalendarProps<T>) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const mounted = useMounted();

  const activeItem = items.find((i) => i.id === activeItemId);
  const seasonsForItem = useMemo(
    () => seasons.filter((s) => s.itemId === activeItemId),
    [seasons, activeItemId],
  );
  const groups = useMemo(
    () => groupSeasonsByRate(seasonsForItem, getGroupKey),
    [seasonsForItem, getGroupKey],
  );
  const totalRanges = seasonsForItem.length;

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft({});
  }

  function openAddForm(startDate?: string) {
    setEditingId(null);
    const seed: Draft = activeItem ? { rate: activeItem.baseRate } : {};
    const extra = activeItem && getDefaultDraft ? getDefaultDraft(activeItem) : {};
    setDraft({ ...seed, ...extra, ...(startDate ? { startDate } : {}) } as Draft);
    setFormOpen(true);
  }

  function openEditForm(season: T) {
    setEditingId(season.id);
    setDraft({ ...season } as Draft);
    setFormOpen(true);
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  // Color ↔ rate locking — recomputed against every OTHER season for this
  // item (excluding whichever one is currently being edited).
  const otherSeasonsForItem = useMemo(
    () => seasonsForItem.filter((s) => s.id !== editingId),
    [seasonsForItem, editingId],
  );
  const draftGroupKey = draft.rate != null ? getGroupKey(draft as T) : null;
  const colorAssignment = resolveColorOptions(draftGroupKey, otherSeasonsForItem, getGroupKey);

  // Keeps draft.color valid automatically — locked to the shared color for a
  // known rate, or defaulted to the first still-available color for a new one.
  useEffect(() => {
    if (!formOpen) return;
    if (colorAssignment.locked) {
      if (draft.color !== colorAssignment.lockedColor) updateDraft({ color: colorAssignment.lockedColor });
    } else if (!draft.color || !colorAssignment.availableColors.includes(draft.color)) {
      updateDraft({ color: colorAssignment.availableColors[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, colorAssignment.locked, colorAssignment.lockedColor, colorAssignment.availableColors.join("|")]);

  const overlapWarning = useMemo(() => {
    if (!draft.startDate || !draft.endDate) return null;
    const range = { startDate: draft.startDate, endDate: draft.endDate };
    const overlapping = otherSeasonsForItem.filter((s) => rangesOverlap(s, range));
    if (overlapping.length === 0) return null;
    const names = overlapping.map((s) => s.label || defaultRangeLabel(s.startDate, s.endDate));
    return `Overlaps ${names.join(", ")} — they will be trimmed automatically so dates never overlap.`;
  }, [draft.startDate, draft.endDate, otherSeasonsForItem]);

  // In-progress picked range, for highlighting on the calendar before it's saved.
  const pickingRange = formOpen && draft.startDate
    ? { start: draft.startDate, end: draft.endDate ?? draft.startDate }
    : null;

  function handleDayClick(iso: string) {
    if (!formOpen) {
      openAddForm(iso);
      return;
    }
    setDraft((prev) => {
      if (!prev.startDate || (prev.startDate && prev.endDate)) {
        return { ...prev, startDate: iso, endDate: undefined };
      }
      if (iso < prev.startDate) {
        return { ...prev, startDate: iso, endDate: prev.startDate };
      }
      return { ...prev, endDate: iso };
    });
  }

  function handleSaveSeason() {
    if (!draft.startDate || !draft.endDate || draft.rate == null) return;
    const range = { startDate: draft.startDate, endDate: draft.endDate };
    const trimmed = trimOverlaps(seasonsForItem, range, editingId ?? undefined, newId);
    const finalSeason = {
      ...draft,
      id: editingId ?? newId(),
      itemId: activeItemId,
    } as T;
    const seasonsForOtherItems = seasons.filter((s) => s.itemId !== activeItemId);
    onSave([...seasonsForOtherItems, ...trimmed, finalSeason], activeItemId);
    closeForm();
  }

  function handleDeleteSeason(season: T) {
    if (!window.confirm("Remove this date range?")) return;
    onSave(seasons.filter((s) => s.id !== season.id), season.itemId);
    if (editingId === season.id) closeForm();
  }

  function handleActiveItemChange(id: string) {
    closeForm();
    onActiveItemChange(id);
  }

  function handleOpenChange(next: boolean) {
    if (!next) closeForm();
    onOpenChange(next);
  }

  const canSave = !!draft.startDate && !!draft.endDate && draft.rate != null;

  // Escape-to-close + lock page scroll while the modal is up.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => handleOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-300 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center size-11 rounded-2xl bg-orange-100 text-orange-600 shrink-0">
              <CalendarDays size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-neutral-900 leading-tight truncate">{title}</h2>
              {subtitle && <p className="text-xs text-neutral-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="size-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-500 transition-colors"
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-base font-bold text-neutral-900 w-14 text-center tabular-nums">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="size-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-500 transition-colors"
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="size-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-500 transition-colors ml-2"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Base-rate legend */}
        {activeItem && (
          <div className="flex items-center gap-4 px-6 py-2.5 border-b border-neutral-100 text-[11px] text-neutral-500 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: BASE_RATE_WEEKDAY_COLOR }} />
              Base rate · {currencySymbol}{activeItem.baseRate.toLocaleString("en-IN")}
            </span>
            {activeItem.baseWeekendRate != null && activeItem.baseWeekendRate !== activeItem.baseRate && (
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: BASE_RATE_WEEKEND_COLOR }} />
                Weekend · {currencySymbol}{activeItem.baseWeekendRate.toLocaleString("en-IN")}
              </span>
            )}
            <span className="text-neutral-400">Colored dates below are custom seasons</span>
          </div>
        )}

        {/* Body */}
        <div className="flex gap-6 p-6 overflow-y-auto">
          {/* 12-month grid */}
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-4">
            {Array.from({ length: 12 }, (_, month) => (
              <MonthGrid
                key={month}
                year={year}
                month={month}
                seasons={seasonsForItem}
                pickingRange={pickingRange}
                onDayClick={handleDayClick}
                baseRate={activeItem?.baseRate}
                baseWeekendRate={activeItem?.baseWeekendRate}
                getSeasonWeekendRate={getSeasonWeekendRate}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="w-95 shrink-0 flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5 block">
                Viewing Rates For
              </label>
              <div className="relative">
                <select
                  value={activeItemId}
                  onChange={(e) => handleActiveItemChange(e.target.value)}
                  className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.label} — {currencySymbol}{it.baseRate.toLocaleString("en-IN")}{unitLabel ? ` ${unitLabel}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>

            {formOpen ? (
              <SeasonForm
                draft={draft}
                isEditing={!!editingId}
                onChange={updateDraft}
                onSave={handleSaveSeason}
                onCancel={closeForm}
                canSave={canSave}
                colorAssignment={colorAssignment}
                overlapWarning={overlapWarning}
                currencySymbol={currencySymbol}
                renderExtraFields={renderExtraFields}
              />
            ) : (
              <button
                type="button"
                onClick={() => openAddForm()}
                className="w-full h-12 rounded-xl font-semibold gap-2 bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Plus size={16} /> Add Season
              </button>
            )}

            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">
              {groups.length} Rate{groups.length !== 1 ? "s" : ""} · {totalRanges} Range{totalRanges !== 1 ? "s" : ""}
              {activeItem ? ` · ${activeItem.label}` : ""} · {year}
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 -mr-2 pr-2">
              {activeItem && activeItem.baseRate > 0 && (
                <BaseRateCard item={activeItem} currencySymbol={currencySymbol} unitLabel={unitLabel} year={year} />
              )}
              {groups.length === 0 ? (
                <p className="text-xs text-neutral-400 italic px-1">
                  No custom seasons yet — click a day on the calendar or use Add Season to override specific dates.
                </p>
              ) : (
                groups.map((g) => (
                  <RateGroupCard
                    key={g.key}
                    group={g}
                    currencySymbol={currencySymbol}
                    unitLabel={unitLabel}
                    onEdit={openEditForm}
                    onDelete={handleDeleteSeason}
                    renderGroupExtra={renderGroupExtra}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Month grid ────────────────────────────────────────────────────────────

function MonthGrid<T extends RateSeasonBase>({
  year, month, seasons, pickingRange, onDayClick, baseRate, baseWeekendRate, getSeasonWeekendRate,
}: {
  year: number;
  month: number;
  seasons: T[];
  pickingRange: { start: string; end: string } | null;
  onDayClick: (iso: string) => void;
  /** The active item's own base rate — filled in light gray on every date
   * with no explicit season, so the calendar never looks empty. */
  baseRate?: number;
  baseWeekendRate?: number | null;
  getSeasonWeekendRate?: (season: T) => number | null | undefined;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const hasDistinctWeekend = baseWeekendRate != null && baseWeekendRate !== baseRate;

  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="text-center text-sm font-bold text-neutral-800 mb-2">{MONTH_NAMES[month]}</p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAY_LETTERS.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-neutral-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const iso = `${year}-${pad2(month + 1)}-${pad2(d)}`;
          const season = seasons.find((s) => s.startDate <= iso && iso <= s.endDate);
          const picking = pickingRange && iso >= pickingRange.start && iso <= pickingRange.end;
          const dow = new Date(year, month, d).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const baseFill = !season && baseRate
            ? (isWeekend && hasDistinctWeekend ? BASE_RATE_WEEKEND_COLOR : BASE_RATE_WEEKDAY_COLOR)
            : undefined;
          const seasonWeekendRate = season ? getSeasonWeekendRate?.(season) : undefined;
          const seasonHasDistinctWeekend = seasonWeekendRate != null && seasonWeekendRate !== season?.rate;
          const seasonColor = season
            ? (isWeekend && seasonHasDistinctWeekend ? darkenColor(season.color) : season.color)
            : undefined;
          const bg = seasonColor ?? baseFill;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(iso)}
              className={cn(
                "aspect-square rounded-md text-[10px] font-semibold flex items-center justify-center transition-colors cursor-pointer",
                season ? "text-white" : "text-neutral-700",
                bg ? "hover:brightness-95" : "hover:bg-neutral-100",
                picking && "ring-2 ring-offset-1 ring-orange-500",
              )}
              style={bg ? { backgroundColor: bg } : undefined}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Base rate card ────────────────────────────────────────────────────────
// A read-only, gray-coded entry representing "every date not covered by a
// real season" — so the list never looks empty once a base rate is set, and
// visually matches the gray fill shown on the calendar itself.

function BaseRateCard({
  item, currencySymbol, unitLabel, year,
}: {
  item: SeasonalRateCalendarItem;
  currencySymbol: string;
  unitLabel?: string;
  year: number;
}) {
  const hasDistinctWeekend = item.baseWeekendRate != null && item.baseWeekendRate !== item.baseRate;
  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-neutral-50 border-b border-neutral-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: BASE_RATE_WEEKDAY_COLOR }} />
          <span className="text-sm font-bold text-neutral-900 whitespace-nowrap">
            {currencySymbol}{item.baseRate.toLocaleString("en-IN")}{unitLabel ? <span className="font-normal text-neutral-400 text-xs"> {unitLabel}</span> : null}
          </span>
          <span className="text-xs text-neutral-400 truncate">— Base Rate</span>
        </div>
        <span className="text-[10px] text-neutral-400 font-medium shrink-0">Default</span>
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs text-neutral-600">
        <span className="truncate">{formatDateLabel(`${year}-01-01`)} → Ongoing</span>
        {hasDistinctWeekend && (
          <span className="flex items-center gap-1.5 text-[10px] text-neutral-400 shrink-0">
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: BASE_RATE_WEEKEND_COLOR }} />
            Weekend {currencySymbol}{item.baseWeekendRate!.toLocaleString("en-IN")}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Grouped rate list ─────────────────────────────────────────────────────

function RateGroupCard<T extends RateSeasonBase>({
  group, currencySymbol, unitLabel, onEdit, onDelete, renderGroupExtra,
}: {
  group: RateGroup<T>;
  currencySymbol: string;
  unitLabel?: string;
  onEdit: (season: T) => void;
  onDelete: (season: T) => void;
  renderGroupExtra?: (representativeSeason: T) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-3.5 py-2.5 bg-neutral-50 border-b border-neutral-200 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
            <span className="text-sm font-bold text-neutral-900 whitespace-nowrap">
              {currencySymbol}{group.rate.toLocaleString("en-IN")}{unitLabel ? <span className="font-normal text-neutral-400 text-xs"> {unitLabel}</span> : null}
            </span>
            {group.label && <span className="text-xs text-neutral-400 truncate">— {group.label}</span>}
          </div>
          <span className="text-[10px] text-neutral-400 font-medium shrink-0">
            {group.entries.length} range{group.entries.length !== 1 ? "s" : ""}
          </span>
        </div>
        {renderGroupExtra?.(group.entries[0])}
      </div>
      <div className="divide-y divide-neutral-100">
        {group.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs text-neutral-600">
            <span className="truncate">{formatDateLabel(e.startDate)} → {formatDateLabel(e.endDate)}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(e)}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                aria-label="Edit date range"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(e)}
                className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                aria-label="Delete date range"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Add/edit form ─────────────────────────────────────────────────────────

const fieldClass =
  "h-8 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-900 " +
  "placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

function SeasonForm<T extends RateSeasonBase>({
  draft, isEditing, onChange, onSave, onCancel, canSave, colorAssignment, overlapWarning, currencySymbol, renderExtraFields,
}: {
  draft: Draft;
  isEditing: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
  colorAssignment: ReturnType<typeof resolveColorOptions>;
  overlapWarning: string | null;
  currencySymbol: string;
  renderExtraFields?: (ctx: { draft: Partial<T>; onChange: (patch: Partial<T>) => void }) => React.ReactNode;
}) {
  const hint = !draft.startDate
    ? "Click a start date on the calendar"
    : !draft.endDate
      ? `Start: ${formatDateLabel(draft.startDate)} — now click an end date`
      : null;

  return (
    <div className="rounded-xl border-2 border-orange-200 bg-orange-50/40 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-neutral-800">{isEditing ? "Edit Season" : "New Season"}</p>
        <button type="button" onClick={onCancel} className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer" aria-label="Cancel">
          <X size={14} />
        </button>
      </div>

      <input
        placeholder="Label (optional) — e.g. Peak Season"
        value={draft.label ?? ""}
        onChange={(e) => onChange({ label: e.target.value })}
        className={fieldClass}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-neutral-500 mb-0.5 block">Start date</label>
          <input
            type="date"
            value={draft.startDate ?? ""}
            onChange={(e) => onChange({ startDate: e.target.value, endDate: undefined })}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="text-[10px] text-neutral-500 mb-0.5 block">End date</label>
          <input
            type="date"
            value={draft.endDate ?? ""}
            onChange={(e) => onChange({ endDate: e.target.value })}
            disabled={!draft.startDate}
            min={draft.startDate}
            className={fieldClass}
          />
        </div>
      </div>

      {hint && (
        <p className="text-[11px] text-orange-600 font-medium flex items-center gap-1.5">
          <CalendarDays size={11} className="shrink-0" /> {hint}
        </p>
      )}

      <div>
        <label className="text-[10px] text-neutral-500 mb-0.5 block">Rate ({currencySymbol})</label>
        <input
          type="number"
          min={0}
          value={draft.rate ?? ""}
          onChange={(e) => onChange({ rate: e.target.value ? Number(e.target.value) : undefined })}
          className={fieldClass}
        />
      </div>

      {renderExtraFields?.({ draft: draft as Partial<T>, onChange: onChange as (patch: Partial<T>) => void })}

      <div>
        <label className="text-[10px] text-neutral-500 mb-1 block">Color</label>
        {colorAssignment.locked ? (
          <div className="flex items-center gap-2">
            <span className="size-6 rounded-full border-2 border-white shadow shrink-0" style={{ backgroundColor: colorAssignment.lockedColor }} />
            <p className="text-[10px] text-neutral-500 leading-snug">
              Locked — every season priced at {currencySymbol}{(draft.rate ?? 0).toLocaleString("en-IN")} shares this color.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {colorAssignment.availableColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ color: c })}
                  className={cn(
                    "size-6 rounded-full border-2 transition-transform cursor-pointer",
                    draft.color === c ? "border-neutral-800 scale-110" : "border-white shadow",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Use color ${c}`}
                />
              ))}
            </div>
            {colorAssignment.hiddenCount > 0 && (
              <p className="text-[10px] text-neutral-400 mt-1">
                {colorAssignment.hiddenCount} color{colorAssignment.hiddenCount !== 1 ? "s" : ""} hidden — already assigned to a different rate.
              </p>
            )}
          </>
        )}
      </div>

      {overlapWarning && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" /> {overlapWarning}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className="flex-1 h-8 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isEditing ? "Save Changes" : "Add Season"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
