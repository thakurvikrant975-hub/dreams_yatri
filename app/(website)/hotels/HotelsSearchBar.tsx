"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import LocationSearchSelect, { type LocationValue } from "@/app/components/ui/LocationSearchSelect";
import DatePickerField from "@/app/components/ui/DatePickerField";
import TravellersField, { type TravellersValue } from "@/app/components/ui/TravellersField";
import Button from "@/app/components/ui/Button";

export interface HotelsSearchBarProps {
  initialCity: LocationValue | null;
  initialCheckIn: Date | null;
  initialCheckOut: Date | null;
  initialGuests: TravellersValue;
}

function Label({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span id={id} className="pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
      {children}
    </span>
  );
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HotelsSearchBar({
  initialCity, initialCheckIn, initialCheckOut, initialGuests,
}: HotelsSearchBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [city, setCity] = useState<LocationValue | null>(initialCity);
  const [checkIn, setCheckIn] = useState<Date | null>(initialCheckIn);
  const [checkOut, setCheckOut] = useState<Date | null>(initialCheckOut);
  const [guests, setGuests] = useState<TravellersValue>(initialGuests);

  function search() {
    const p = new URLSearchParams();
    if (city?.name) p.set("city", city.name);
    if (checkIn) p.set("in", ymd(checkIn));
    // check-out must be after check-in
    if (checkOut && (!checkIn || checkOut > checkIn)) p.set("out", ymd(checkOut));
    p.set("adults", String(guests.adults));
    if (guests.childrenAges.length) p.set("children", guests.childrenAges.join(","));
    p.set("rooms", String(guests.rooms ?? 1));
    const qs = p.toString();
    startTransition(() => router.push(qs ? `/hotels?${qs}` : "/hotels"));
  }

  return (
    <div className="bg-neutral-900">
      <div className="screen-space py-3">
        <form role="search" aria-label="Search hotels" onSubmit={(e) => { e.preventDefault(); if (!isPending) search(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2.5 items-end">
            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-city">
              <Label id="label-city">City / Destination</Label>
              <LocationSearchSelect value={city} onChange={setCity} placeholder="Where are you going?" showCurrentLocation />
            </div>

            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-in">
              <Label id="label-in">Check-in</Label>
              <DatePickerField value={checkIn} onChange={setCheckIn} placeholder="Add date" />
            </div>

            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-out">
              <Label id="label-out">Check-out</Label>
              <DatePickerField value={checkOut} onChange={setCheckOut} placeholder="Add date" />
            </div>

            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-guests">
              <Label id="label-guests">Guests</Label>
              <TravellersField value={guests} onChange={setGuests} showRooms />
            </div>

            <div className="flex flex-col gap-1">
              <span className="hidden lg:block text-[10px] leading-3.5" aria-hidden="true">&nbsp;</span>
              <Button
                type="submit"
                variant="premium"
                loading={isPending}
                disabled={isPending}
                className="h-10.5 w-full lg:w-auto rounded-lg px-7 font-bold flex items-center justify-center gap-2"
              >
                <MagnifyingGlassIcon weight="bold" className="size-4" aria-hidden="true" />
                {isPending ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
