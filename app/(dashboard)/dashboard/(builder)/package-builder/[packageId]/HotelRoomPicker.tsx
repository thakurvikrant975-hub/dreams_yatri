"use client";

import { useState, useEffect, useRef } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import Image from "next/image";
import {
  SearchIcon, Loader2, ChevronDownIcon, XIcon, CheckIcon, Hotel,
  Coffee, Sun, Moon, UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { searchHotelRoomsForBuilder, getHotelRoomByIdForBuilder, type HotelRoomResult } from "../action";

// Mirrors the admin catalog's HOTEL_CAT_LABEL (ItineraryDaySidebar.tsx) — kept
// as a separate copy since that file lives in a different feature area and
// "use server" action files can't export plain constants for both to share.
const HOTEL_CAT_LABEL: Record<string, string> = {
  hotel: "Hotel", resort: "Resort", homestay: "Homestay", apartment: "Apartment",
  villa: "Villa", guest_house: "Guest House", houseboat: "Houseboat", camp: "Camp",
  glamping: "Glamping", treehouse: "Treehouse", jungle_lodge: "Jungle Lodge",
  eco_lodge: "Eco Lodge", boutique_hotel: "Boutique", heritage_hotel: "Heritage",
  luxury_hotel: "Luxury", cottage: "Cottage", bungalow: "Bungalow", farm_stay: "Farm Stay",
};

const STAR_CHIPS = ["2 Star", "3 Star", "4 Star", "5 Star"];
const CAT_CHIPS = [
  { value: "hotel", label: "Hotel" },
  { value: "resort", label: "Resort" },
  { value: "homestay", label: "Homestay" },
  { value: "houseboat", label: "Houseboat" },
  { value: "camp", label: "Camp" },
];

const MEAL_CFG: Record<string, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  breakfast: { Icon: Coffee,          color: "text-orange-600", bg: "bg-orange-50 border-orange-200", label: "Brkfst" },
  lunch:     { Icon: Sun,             color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", label: "Lunch" },
  dinner:    { Icon: Moon,            color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", label: "Dinner" },
};
const MEAL_CFG_DEFAULT = { Icon: UtensilsCrossed, color: "text-muted-foreground", bg: "bg-muted border-muted-foreground/20", label: "Meal" };

const PAGE_SIZE = 20;

type Props = {
  value: number | null;
  initialLabel: string;
  searchCity: string;
  refCoords: { lat: number; lng: number } | null;
  onSelect: (room: HotelRoomResult) => void;
  onClear: () => void;
  placeholder?: string;
};

export function HotelRoomPicker({ value, initialLabel, searchCity, refCoords, onSelect, onClear, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<HotelRoomResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [starFilter, setStarFilter] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [currentRoom, setCurrentRoom] = useState<HotelRoomResult | null>(null);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSelectedLabel(initialLabel); }, [initialLabel]);

  // Prices the currently-selected room so results can show a "+4000 / -200"
  // delta against it — refetched (not just cached from the last pick) so a
  // reopened draft still shows accurate deltas.
  useEffect(() => {
    if (value == null) { setCurrentRoom(null); return; }
    let cancelled = false;
    getHotelRoomByIdForBuilder(value, refCoords).then((room) => {
      if (!cancelled) setCurrentRoom(room);
    });
    return () => { cancelled = true; };
  }, [value, refCoords]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(""); setItems([]); }
  }, [open]);

  useEffect(() => {
    if (!open || !searchCity) { setItems([]); return; }
    let cancelled = false;
    setLoading(true);
    const delay = query === "" ? 0 : 300;
    const timer = setTimeout(async () => {
      try {
        const results = await searchHotelRoomsForBuilder(searchCity, query, refCoords, 1, starFilter, catFilter);
        if (!cancelled) {
          setItems(results);
          setPage(1);
          setHasMore(results.length >= PAGE_SIZE);
        }
      } catch {
        if (!cancelled) { setItems([]); setHasMore(false); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, searchCity, starFilter, catFilter]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const results = await searchHotelRoomsForBuilder(searchCity, query, refCoords, nextPage, starFilter, catFilter);
      setItems((prev) => [...prev, ...results]);
      setPage(nextPage);
      setHasMore(results.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSelect(room: HotelRoomResult) {
    setSelectedLabel(`${room.hotelName} — ${room.roomName}`);
    onSelect(room);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedLabel("");
    onClear();
  }

  const hasValue = value != null;
  const triggerLabel = hasValue && selectedLabel ? selectedLabel : undefined;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs",
            "ring-offset-background transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            open && "border-ring ring-2 ring-ring ring-offset-2",
          )}
        >
          <span className={cn("flex-1 truncate text-left", !triggerLabel && "text-muted-foreground")}>
            {triggerLabel ?? (placeholder ?? "Search hotel rooms…")}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {hasValue && (
              <span
                role="button"
                aria-label="Clear"
                onClick={handleClear}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="h-3 w-3" />
              </span>
            )}
            <ChevronDownIcon className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={5}
          align="start"
          avoidCollisions
          className={cn(
            "z-50 w-[min(560px,92vw)] overflow-hidden rounded-xl border border-border/80 bg-background shadow-lg outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          )}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by hotel name…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b bg-muted/20">
            {STAR_CHIPS.map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setStarFilter((f) => (f === star ? null : star))}
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                  starFilter === star
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-background text-muted-foreground border-border hover:border-amber-400 hover:text-amber-700",
                )}
              >
                ★ {star}
              </button>
            ))}
            {CAT_CHIPS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCatFilter((f) => (f === c.value ? null : c.value))}
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                  catFilter === c.value
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-background text-muted-foreground border-border hover:border-violet-400 hover:text-violet-700",
                )}
              >
                {c.label}
              </button>
            ))}
            {(starFilter || catFilter) && (
              <button
                type="button"
                onClick={() => { setStarFilter(null); setCatFilter(null); }}
                className="text-[10px] text-destructive/70 hover:text-destructive px-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[440px] overflow-y-auto divide-y">
            {!searchCity ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Enter a city above to search</p>
            ) : loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching hotels…
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <p className="text-xs text-muted-foreground">No hotels found</p>
                {(starFilter || catFilter) && <p className="text-[10px] text-muted-foreground/60">Try removing a filter</p>}
              </div>
            ) : (
              items.map((room) => {
                const isSelected = value === room.id;
                const delta = (!isSelected && currentRoom) ? room.pricePerNight - currentRoom.pricePerNight : null;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(room); }}
                    className={cn(
                      "w-full text-left px-3 py-3 flex gap-3 items-start transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-violet-50/60",
                    )}
                  >
                    {room.thumbnail ? (
                      <Image
                        src={room.thumbnail}
                        alt={room.hotelName}
                        width={72}
                        height={54}
                        className="h-[54px] w-[72px] rounded-lg object-cover shrink-0 border"
                      />
                    ) : (
                      <div className="h-[54px] w-[72px] rounded-lg bg-muted border flex items-center justify-center shrink-0">
                        <Hotel className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Name + distance */}
                      <div className="flex items-start gap-1.5 justify-between">
                        <p className="text-xs font-semibold leading-snug text-foreground">
                          {room.hotelName} <span className="font-normal text-muted-foreground">— {room.roomName}</span>
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {isSelected && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
                          {room.distanceKm != null && (
                            <span className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {room.distanceKm} km
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Star + category */}
                      <div className="flex flex-wrap items-center gap-1">
                        {room.starRating && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                            ★ {room.starRating}
                          </span>
                        )}
                        {room.category && (
                          <span className="text-[9px] font-medium bg-muted text-muted-foreground border px-1.5 py-0.5 rounded">
                            {HOTEL_CAT_LABEL[room.category] ?? room.category}
                          </span>
                        )}
                      </div>

                      {/* Location */}
                      {room.location && (
                        <p className="text-[10px] text-muted-foreground/70 leading-snug">{room.location}</p>
                      )}

                      {/* Room specs */}
                      {room.roomSpecs && (
                        <p className="text-[10px] text-muted-foreground leading-snug">{room.roomSpecs}</p>
                      )}

                      {/* Meals + price */}
                      <div className="flex items-center justify-between gap-2">
                        {room.coveredMeals.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {room.coveredMeals.map((meal) => {
                              const cfg = MEAL_CFG[meal] ?? MEAL_CFG_DEFAULT;
                              const Icon = cfg.Icon;
                              return (
                                <span key={meal} className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-semibold", cfg.bg)}>
                                  <Icon className={cn("h-2.5 w-2.5 shrink-0", cfg.color)} />
                                  <span className={cfg.color}>{cfg.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : room.mealPlanName ? (
                          <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                            {room.mealPlanName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50 italic">No meals</span>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {delta != null && delta !== 0 && (
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap",
                                delta > 0 ? "text-red-700 bg-red-50 border border-red-200" : "text-green-700 bg-green-50 border border-green-200",
                              )}
                            >
                              {delta > 0 ? "+" : ""}{delta.toLocaleString("en-IN")}
                            </span>
                          )}
                          <span className="text-xs font-bold text-violet-700 whitespace-nowrap">
                            ₹{room.pricePerNight.toLocaleString("en-IN")}
                            <span className="text-[10px] font-normal text-muted-foreground">/night</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-primary hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="h-3 w-3 animate-spin" />}
                Load more
              </button>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
