"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/app/components/ui/Card";
import { setRoomBookable } from "../edit/tabs/room-actions";
import {
  BuildingsIcon,
  WarningCircleIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react/dist/ssr";

export type RoomListItem = {
  id: number;
  name: string;
  numRooms: number;
  isBookable: boolean;
  thumbnail: string | null;
  baseRate: number | null;
};

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function BookableToggle({ hotelId, room }: { hotelId: number; room: RoomListItem }) {
  const [checked, setChecked] = useState(room.isBookable);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !checked;
    setChecked(next); // optimistic
    startTransition(async () => {
      const result = await setRoomBookable(hotelId, room.id, next);
      if (result.error) setChecked(!next); // revert on failure
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="flex items-center gap-2 shrink-0 disabled:opacity-60"
      title={checked ? "Open — click to close for sale" : "Closed — click to open for sale"}
    >
      <span
        className={
          "hidden sm:inline text-xs font-semibold " +
          (checked ? "text-emerald-600" : "text-neutral-400")
        }
      >
        {checked ? "Open" : "Closed"}
      </span>
      <span
        className={
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
          (checked ? "bg-emerald-500" : "bg-neutral-300")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-4.5" : "translate-x-0.5")
          }
        />
      </span>
    </button>
  );
}

function RoomCard({ hotelId, room }: { hotelId: number; room: RoomListItem }) {
  const hasRate = room.baseRate != null;
  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <div className="flex items-center gap-3 p-4">
        <div className="relative w-16 h-14 shrink-0 rounded-lg overflow-hidden bg-neutral-100">
          {room.thumbnail ? (
            <Image src={room.thumbnail} alt={room.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BuildingsIcon size={22} weight="duotone" className="text-neutral-400/50" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-800 truncate">{room.name}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{room.numRooms} room{room.numRooms !== 1 ? "s" : ""}</p>
        </div>
        <BookableToggle hotelId={hotelId} room={room} />
      </div>

      {!hasRate && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <WarningCircleIcon size={14} weight="fill" className="text-red-500 shrink-0" />
          <span className="flex-1 text-xs text-red-700">This room has no rates. Add rates to start selling.</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-neutral-100">
        <div>
          <p className="text-xs font-semibold text-neutral-700">Nightly Rate</p>
          {hasRate ? (
            <p className="text-sm font-bold text-neutral-800 mt-0.5">{money(room.baseRate!)}</p>
          ) : (
            <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 rounded px-1.5 py-0.5">
              Rate Missing
            </span>
          )}
        </div>
        <Link
          href={`/hotel-connect/properties/${hotelId}/rates/${room.id}`}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700"
        >
          {hasRate ? "Manage all rates" : "Add rates"}
        </Link>
      </div>
    </Card>
  );
}

export default function RoomListClient({
  hotelId,
  hotelName,
  rooms,
  isHomestay,
}: {
  hotelId: number;
  hotelName: string;
  rooms: RoomListItem[];
  isHomestay?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{hotelName}</p>
          <h1 className="text-lg font-bold text-neutral-800">Rates & Availability</h1>
        </div>
        {rooms.length > 0 && (
          <Link
            href={`/hotel-connect/properties/${hotelId}/calendar?room=${rooms[0].id}`}
            className="h-10 flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
          >
            <CalendarBlankIcon size={16} />
            Calendar View
          </Link>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          {isHomestay
            ? "Set your base rate in the Pricing step of the listing wizard to activate rates & availability here."
            : "No active rooms yet. Add a room to manage its rates & availability."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} hotelId={hotelId} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
