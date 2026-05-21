"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  MapPinIcon, SearchIcon, Loader2Icon, XIcon,
  PlusIcon, GlobeIcon, ClockIcon, ChevronDownIcon,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import type {
  ExternalResult, LocalResult, LocationSearchSelectProps,
  LocationType, LocationValue,
} from "./location.types";
import { LOCATION_COLORS, LOCATION_LABELS } from "./location.types";

const LocationManualModal = dynamic(
  () => import("./LocationManualModal").then((m) => ({ default: m.LocationManualModal })),
  { ssr: false },
);

// ── localStorage helpers ──────────────────────────────────────────────────────
const RECENT_KEY = "location_recent";
const MAX_RECENT = 5;

function readRecent(): LocationValue[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function writeRecent(loc: LocationValue) {
  const prev = readRecent().filter((r) => r.id !== loc.id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([loc, ...prev].slice(0, MAX_RECENT)));
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: LocationType }) {
  return (
    <span className={cn(
      "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
      LOCATION_COLORS[type],
    )}>
      {LOCATION_LABELS[type]}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
      {children}
    </div>
  );
}

function Row({
  icon, primary, secondary, badge, highlighted, saving, onClick,
}: {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  badge?: React.ReactNode;
  highlighted: boolean;
  saving?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); if (!saving) onClick(); }}
      className={cn(
        "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors",
        highlighted ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-foreground",
        saving && "pointer-events-none opacity-60",
      )}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 truncate text-xs font-medium">
          <span className="truncate">{primary}</span>
          {badge}
        </span>
        {secondary && (
          <span className="truncate text-[10px] text-muted-foreground">{secondary}</span>
        )}
      </span>
    </button>
  );
}

// ── Flat navigation list builder ──────────────────────────────────────────────
type NavItem =
  | { kind: "recent";   item: LocationValue }
  | { kind: "local";    item: LocalResult }
  | { kind: "external"; item: ExternalResult }
  | { kind: "worldwide" }
  | { kind: "manual" };

function buildNav(
  query: string,
  recent: LocationValue[],
  localResults: LocalResult[],
  externalResults: ExternalResult[],
  externalSearched: boolean,
): NavItem[] {
  const items: NavItem[] = [];
  if (!query.trim()) {
    for (const r of recent) items.push({ kind: "recent", item: r });
  }
  for (const r of localResults)    items.push({ kind: "local",    item: r });
  for (const r of externalResults) items.push({ kind: "external", item: r });
  if (query.trim() && !externalSearched) items.push({ kind: "worldwide" });
  items.push({ kind: "manual" });
  return items;
}

// ── Main component ────────────────────────────────────────────────────────────
export function LocationSearchSelect({
  value,
  onChange,
  placeholder = "Search location…",
  types,
  className,
  disabled,
  label,
  required,
  id,
  error,
}: LocationSearchSelectProps) {
  const [open, setOpen]                       = useState(false);
  const [query, setQuery]                     = useState("");
  const [recent, setRecent]                   = useState<LocationValue[]>([]);
  const [localResults, setLocalResults]       = useState<LocalResult[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalResult[]>([]);
  const [localLoading, setLocalLoading]       = useState(false);
  const [extLoading, setExtLoading]           = useState(false);
  const [extSearched, setExtSearched]         = useState(false);
  const [savingId, setSavingId]               = useState<string | null>(null);
  const [activeIdx, setActiveIdx]             = useState(-1);
  const [manualOpen, setManualOpen]           = useState(false);
  const [manualInitial, setManualInitial]     = useState("");

  const inputRef      = useRef<HTMLInputElement>(null);
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load recents on mount ─────────────────────────────────────────────────
  useEffect(() => { setRecent(readRecent()); }, []);

  // ── Reset external when query changes ─────────────────────────────────────
  useEffect(() => {
    setExtSearched(false);
    setExternalResults([]);
  }, [query]);

  // ── Reset active index when results change ────────────────────────────────
  useEffect(() => { setActiveIdx(-1); }, [localResults, externalResults, query]);

  // ── Debounced local search ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (!query.trim()) { setLocalResults([]); return; }

    localTimerRef.current = setTimeout(async () => {
      try {
        setLocalLoading(true);
        const qs = new URLSearchParams({ q: query.trim(), limit: "8" });
        if (types?.length) qs.set("types", types.join(","));
        const res = await fetch(`/api/locations/search?${qs}`);
        if (res.ok) setLocalResults((await res.json()) as LocalResult[]);
      } finally {
        setLocalLoading(false);
      }
    }, 300);

    return () => { if (localTimerRef.current) clearTimeout(localTimerRef.current); };
  }, [query, open, types]);

  // ── External (Mapbox) search ──────────────────────────────────────────────
  const searchExternal = useCallback(async () => {
    if (!query.trim() || extLoading) return;
    try {
      setExtLoading(true);
      setExtSearched(true);
      const qs = new URLSearchParams({ q: query.trim() });
      if (types?.length) qs.set("types", types.join(","));
      const res = await fetch(`/api/locations/external?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setExternalResults(data.results ?? []);
      }
    } finally {
      setExtLoading(false);
    }
  }, [query, extLoading, types]);

  // ── Save external result to local DB ─────────────────────────────────────
  async function selectExternal(ext: ExternalResult) {
    try {
      setSavingId(ext.mapbox_id);
      const res = await fetch("/api/locations/save-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapbox_id:   ext.mapbox_id,
          name:        ext.name,
          full_name:   ext.full_name,
          place_type:  ext.place_type,
          coordinates: ext.coordinates,
          country:     ext.country,
          region:      ext.region,
        }),
      });
      if (res.ok) pick((await res.json()) as LocationValue);
    } finally {
      setSavingId(null);
    }
  }

  // ── Commit a selection ────────────────────────────────────────────────────
  function pick(loc: LocationValue) {
    onChange(loc);
    writeRecent(loc);
    setRecent(readRecent());
    setOpen(false);
    setQuery("");
    setLocalResults([]);
    setExternalResults([]);
    setExtSearched(false);
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const navItems = buildNav(query, recent, localResults, externalResults, extSearched);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, navItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      activateItem(navItems[activeIdx]);
    }
  }

  function activateItem(nav: NavItem) {
    if (nav.kind === "recent")   pick(nav.item);
    if (nav.kind === "local")    pick(nav.item as LocationValue);
    if (nav.kind === "external") selectExternal(nav.item);
    if (nav.kind === "worldwide") searchExternal();
    if (nav.kind === "manual") {
      setManualInitial(query.trim());
      setOpen(false);
      setManualOpen(true);
    }
  }

  // ── Derived display flags ─────────────────────────────────────────────────
  const showRecent   = !query.trim() && recent.length > 0;
  const showLocal    = !!query.trim();
  const showExternal = extSearched;
  const showWorldwide = !!query.trim() && !extSearched;

  let navCounter = 0;

  return (
    <>
      <div className={cn("flex flex-col gap-1", className)}>
        {label && (
          <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
            {label}{required && <span className="ml-0.5 text-destructive">*</span>}
          </label>
        )}

        <PopoverPrimitive.Root
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          {/* ── Trigger ─────────────────────────────────────────────────── */}
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              id={id}
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={open}
              className={cn(
                "flex h-10 w-full items-center rounded-lg border px-3 text-left transition-colors",
                "bg-dashboard-base-100 border-dashboard-base-content/85",
                "focus-visible:outline-none focus-visible:border-dashboard-primary focus-visible:ring-1 focus-visible:ring-dashboard-primary/30",
                open && "border-dashboard-primary ring-1 ring-dashboard-primary/30",
                error && "border-dashboard-error ring-1 ring-dashboard-error/20",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <MapPinIcon className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
              {value ? (
                <span className="flex flex-1 min-w-0 items-center gap-1.5 truncate">
                  <span className="truncate text-xs text-dashboard-base-content">{value.name}</span>
                  <TypeBadge type={value.type} />
                  {value.breadcrumb && value.breadcrumb !== value.name && (
                    <span className="hidden truncate text-[10px] text-muted-foreground sm:block">
                      · {value.breadcrumb.split(", ").slice(1).join(", ")}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex-1 truncate text-xs text-dashboard-base-content/35">
                  {placeholder}
                </span>
              )}
              <span className="ml-2 flex shrink-0 items-center gap-1">
                {value && (
                  <span
                    role="button"
                    aria-label="Clear selection"
                    tabIndex={-1}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </span>
                )}
                <ChevronDownIcon className={cn(
                  "size-3.5 text-muted-foreground transition-transform duration-150",
                  open && "rotate-180",
                )} />
              </span>
            </button>
          </PopoverPrimitive.Trigger>

          {/* ── Dropdown content ─────────────────────────────────────────── */}
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              className={cn(
                "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden",
                "rounded-xl border border-border bg-popover shadow-xl shadow-black/10",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              )}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {/* Search input */}
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                />
                {(localLoading || extLoading) && (
                  <Loader2Icon className="size-3 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Results list */}
              <div role="listbox" className="max-h-72 overflow-y-auto py-1">

                {/* Recent */}
                {showRecent && (
                  <>
                    <SectionLabel>Recent</SectionLabel>
                    {recent.map((r) => {
                      const idx = navCounter++;
                      return (
                        <Row
                          key={`recent-${r.id}`}
                          icon={<ClockIcon className="size-3.5" />}
                          primary={r.name}
                          secondary={r.breadcrumb !== r.name ? r.breadcrumb : undefined}
                          badge={<TypeBadge type={r.type} />}
                          highlighted={activeIdx === idx}
                          onClick={() => pick(r)}
                        />
                      );
                    })}
                  </>
                )}

                {/* Local DB results */}
                {showLocal && (
                  <>
                    <SectionLabel>Local Results</SectionLabel>
                    {localLoading && localResults.length === 0 && (
                      <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">Searching…</p>
                    )}
                    {localResults.map((r) => {
                      const idx = navCounter++;
                      return (
                        <Row
                          key={`local-${r.id}`}
                          icon={<MapPinIcon className="size-3.5" />}
                          primary={r.name}
                          secondary={r.breadcrumb !== r.name ? r.breadcrumb : undefined}
                          badge={<TypeBadge type={r.type} />}
                          highlighted={activeIdx === idx}
                          onClick={() => pick(r as LocationValue)}
                        />
                      );
                    })}
                    {!localLoading && localResults.length === 0 && !extLoading && (
                      <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">
                        No local results — search worldwide below
                      </p>
                    )}
                  </>
                )}

                {/* External (Mapbox) results */}
                {showExternal && (
                  <>
                    <SectionLabel>Worldwide Results</SectionLabel>
                    {extLoading && externalResults.length === 0 && (
                      <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">
                        Searching worldwide…
                      </p>
                    )}
                    {externalResults.map((r) => {
                      const isSaving = savingId === r.mapbox_id;
                      const idx = navCounter++;
                      return (
                        <Row
                          key={`ext-${r.mapbox_id}`}
                          icon={isSaving
                            ? <Loader2Icon className="size-3.5 animate-spin" />
                            : <GlobeIcon className="size-3.5" />}
                          primary={r.name}
                          secondary={r.full_name !== r.name ? r.full_name : undefined}
                          badge={<TypeBadge type={r.place_type} />}
                          highlighted={activeIdx === idx}
                          saving={isSaving}
                          onClick={() => selectExternal(r)}
                        />
                      );
                    })}
                    {!extLoading && externalResults.length === 0 && (
                      <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">
                        No worldwide results found
                      </p>
                    )}
                  </>
                )}

                {/* Empty state when nothing at all */}
                {!showRecent && !query.trim() && (
                  <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                    Start typing to search locations
                  </p>
                )}

                {/* Actions footer */}
                <div className={cn(
                  "border-t border-border",
                  (showRecent || showLocal || showExternal) ? "mt-1 pt-1" : "pt-1",
                )}>
                  {/* Search worldwide */}
                  {showWorldwide && (() => {
                    const idx = navCounter++;
                    return (
                      <Row
                        icon={extLoading
                          ? <Loader2Icon className="size-3.5 animate-spin" />
                          : <GlobeIcon className="size-3.5" />}
                        primary={`Search worldwide for "${query}"`}
                        secondary="Powered by Mapbox — results are saved to local database"
                        highlighted={activeIdx === idx}
                        onClick={searchExternal}
                      />
                    );
                  })()}

                  {/* Add manually */}
                  {(() => {
                    const idx = navCounter++;
                    return (
                      <Row
                        icon={<PlusIcon className="size-3.5" />}
                        primary="Add location manually"
                        secondary="Drop a pin on the map and fill in details"
                        highlighted={activeIdx === idx}
                        onClick={() => {
                          setManualInitial(query.trim());
                          setOpen(false);
                          setManualOpen(true);
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>

        {error && <p className="text-[10px] text-destructive">{error}</p>}
      </div>

      {/* Manual creation modal — dynamically loaded */}
      <LocationManualModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        initialName={manualInitial}
        onCreated={(loc) => pick(loc)}
      />
    </>
  );
}
