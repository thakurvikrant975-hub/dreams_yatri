"use client";

import { useState, useTransition, useMemo } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { updatePropertyAmenities } from "../../actions";
import { toast } from "sonner";

const PROPERTY_AMENITY_GROUPS = [
  {
    group: "Mandatory",
    items: [
      "Restaurant", "CCTV", "Airport Transfers", "Wifi", "Room service",
      "Swimming Pool", "Gym / Fitness centre", "Air Conditioning", "Bar",
      "Parking", "Luggage assistance", "Wheelchair", "Reception",
      "Elevator / Lift", "Housekeeping", "Power backup",
      "Kitchen / Kitchenette", "Caretaker",
    ],
  },
  {
    group: "Security",
    items: [
      "Fire extinguishers", "Smoke detector", "Security alarms", "Security Guard",
    ],
  },
  {
    group: "General Services",
    items: [
      "First-aid services", "Newspaper", "Lounge", "Laundry", "Smoking rooms",
      "Concierge", "Doctor on call", "Pool / Beach towels", "Multilingual Staff",
    ],
  },
  {
    group: "Basic Facilities",
    items: ["Washing Machine", "Laundromat"],
  },
  {
    group: "Outdoor Sports & Activities",
    items: ["Beach", "Outdoor sports", "Skiing", "Cycling", "Golf Course"],
  },
  {
    group: "Common Area",
    items: ["Living Room", "Outdoor Furniture", "Prayer Room", "Balcony / Terrace"],
  },
  {
    group: "Food and Drink",
    items: ["Dining Area", "Barbeque"],
  },
  {
    group: "Business Center and Conferences",
    items: [
      "Business Center", "Conference room", "Printer", "Photocopier", "Projector",
    ],
  },
  {
    group: "Transfers",
    items: [
      "Pickup / Drop", "Railway Station Transfers", "Bus Station Transfers",
      "Metro Station Transfers",
    ],
  },
  {
    group: "Entertainment",
    items: [
      "Professional Photography", "Night Club", "Beach Club", "DJ", "Live Music",
    ],
  },
  {
    group: "Shopping",
    items: ["Grocery / Supermarket (Within Premise)", "Souvenir Shop", "Pharmacy"],
  },
  {
    group: "Payment Services",
    items: ["ATM", "Currency Exchange"],
  },
  {
    group: "Family and Kids",
    items: ["Kids' Club"],
  },
  {
    group: "Pet Essentials",
    items: ["Pet bowls", "Pet baskets"],
  },
  {
    group: "Spa & Wellness",
    items: [
      "Hot Spring bath (Within Premise)", "Hammam", "Jacuzzi", "Sauna",
      "Spa", "Steam Room", "Massage",
    ],
  },
  {
    group: "Water Sports & Activities",
    items: ["Kayaking", "Snorkelling", "Water sports", "Canoeing"],
  },
  {
    group: "Indoor Sports & Activities",
    items: ["Indoor games room", "Library", "Indoor games"],
  },
  {
    group: "Live Shows, Music & Entertainment",
    items: ["Casino", "Bonfire"],
  },
  {
    group: "Wildlife Safari & Exploration",
    items: ["Jungle Safari"],
  },
] as const;

type Props = {
  hotel_id: number;
  initialAmenities: string[];
};

export function AmenitiesTab({ hotel_id, initialAmenities }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialAmenities));
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Start with Mandatory open; also open any group that has pre-selected items
    const init = new Set<string>(["Mandatory"]);
    for (const { group, items } of PROPERTY_AMENITY_GROUPS) {
      if (items.some((i) => initialAmenities.includes(i))) init.add(group);
    }
    return init;
  });
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PROPERTY_AMENITY_GROUPS;
    return PROPERTY_AMENITY_GROUPS
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.toLowerCase().includes(q)) as string[],
      }))
      .filter((g) => g.items.length > 0 || g.group.toLowerCase().includes(q));
  }, [search]);

  const setYes = (item: string) =>
    setSelected((prev) => new Set([...prev, item]));

  const setNo = (item: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(item);
      return next;
    });

  const toggleGroup = (group: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const handleSave = () => {
    startTransition(async () => {
      const result = await updatePropertyAmenities(hotel_id, Array.from(selected));
      if (result.success) toast.success("Property amenities saved");
      else toast.error(result.message ?? "Failed to save");
    });
  };

  const isSearching = search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Property Amenities</h3>
          <p className="text-sm text-muted-foreground">
            {selected.size} amenit{selected.size === 1 ? "y" : "ies"} selected across{" "}
            {PROPERTY_AMENITY_GROUPS.length} categories
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search amenities…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Groups */}
      <div className="space-y-2">
        {filtered.map(({ group, items }) => {
          const groupSelected = items.filter((i) => selected.has(i));
          const isOpen = isSearching || expanded.has(group);

          return (
            <div key={group} className="border rounded-lg overflow-hidden">
              {/* Group header */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={() => !isSearching && toggleGroup(group)}
              >
                <div className="flex items-center gap-2">
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <span className="font-medium text-sm">{group}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {groupSelected.length}/{items.length}
                  </span>
                  {groupSelected.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs h-5 min-w-5 px-1.5 bg-amber-100 text-amber-700 border-amber-200"
                    >
                      {groupSelected.length}
                    </Badge>
                  )}
                </div>
              </button>

              {/* Items */}
              {isOpen && (
                <div className="divide-y">
                  {items.map((item) => {
                    const isYes = selected.has(item);
                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="text-sm">{item}</span>
                        <div className="flex rounded-md overflow-hidden border border-zinc-300 shrink-0 ml-4">
                          <button
                            type="button"
                            onClick={() => isYes && setNo(item)}
                            className={`px-3 py-1 text-xs font-semibold transition-colors ${
                              !isYes
                                ? "bg-zinc-800 text-white"
                                : "bg-white text-zinc-500 hover:bg-zinc-50"
                            }`}
                          >
                            NO
                          </button>
                          <button
                            type="button"
                            onClick={() => !isYes && setYes(item)}
                            className={`px-3 py-1 text-xs font-semibold border-l border-zinc-300 transition-colors ${
                              isYes
                                ? "bg-amber-500 text-white"
                                : "bg-white text-zinc-500 hover:bg-zinc-50"
                            }`}
                          >
                            YES
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No amenities match &quot;{search}&quot;
          </p>
        )}
      </div>
    </div>
  );
}
