"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/app/components/ui/Card";
import { buttonVariants } from "@/app/components/ui/Button";
import { setRoomBookable } from "../edit/tabs/room-actions";
import { setRatePlanActive } from "./[roomId]/plan-actions";
import {
  BuildingsIcon,
  WarningCircleIcon,
  CalendarBlankIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

export type RatePlanListItem = { id: number; label: string; price: number; isActive: boolean };

export type RoomListItem = {
  id: number;
  name: string;
  numRooms: number;
  isBookable: boolean;
  thumbnail: string | null;
  ratePlans: RatePlanListItem[];
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

function RatePlanRow({
  hotelId, roomId, index, plan, onReactivated,
}: {
  hotelId: number; roomId: number; index: number; plan: RatePlanListItem;
  onReactivated: (planId: number) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reactivate() {
    setError(null);
    startTransition(async () => {
      const result = await setRatePlanActive(hotelId, roomId, plan.id, true);
      if (result.error) { setError(result.error); return; }
      onReactivated(plan.id);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <Link
        href={`/hotel-connect/properties/${hotelId}/rates/${roomId}/plans/${plan.id}`}
        className={
          "min-w-0 flex-1 truncate hover:underline " +
          (plan.isActive ? "text-neutral-700" : "text-neutral-400 line-through")
        }
      >
        {index + 1}. {plan.label} — {money(plan.price)}
      </Link>
      {plan.isActive ? (
        <span className="text-xs text-neutral-400 shrink-0">active</span>
      ) : (
        <button
          type="button"
          onClick={reactivate}
          disabled={pending}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 shrink-0 disabled:opacity-60"
        >
          {pending ? "…" : "Reactivate"}
        </button>
      )}
      {error && <span className="text-[10px] text-red-600 shrink-0">{error}</span>}
    </div>
  );
}

function RoomCard({ hotelId, room }: { hotelId: number; room: RoomListItem }) {
  const [plans, setPlans] = useState(room.ratePlans);
  const hasAnyActive = plans.some((p) => p.isActive);

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

      {!hasAnyActive && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <WarningCircleIcon size={14} weight="fill" className="text-red-500 shrink-0" />
          <span className="flex-1 text-xs text-red-700">This room has no active rate plan. Add one to start selling.</span>
        </div>
      )}

      <div className="px-4 py-3 border-t border-neutral-100 space-y-2">
        <p className="text-xs font-semibold text-neutral-700">Rate Plans</p>
        {plans.length === 0 ? (
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 rounded px-1.5 py-0.5">
            Rate Missing
          </span>
        ) : (
          <div className="space-y-1.5">
            {plans.map((plan, i) => (
              <RatePlanRow
                key={plan.id}
                hotelId={hotelId}
                roomId={room.id}
                index={i}
                plan={plan}
                onReactivated={(planId) => setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, isActive: true } : p))}
              />
            ))}
          </div>
        )}
        <Link
          href={`/hotel-connect/properties/${hotelId}/rates/${room.id}/plans/new`}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-600 pt-1"
        >
          <PlusCircleIcon size={14} weight="fill" />
          Add Rate Plan
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{hotelName}</p>
          <h1 className="text-lg font-bold text-neutral-800">Rates & Inventory</h1>
        </div>
        {rooms.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Link
              href={`/hotel-connect/properties/${hotelId}/rates/default`}
              className={buttonVariants({ variant: "outline", size: "md", className: "justify-center" })}
            >
              Default Rates & Inventory
            </Link>
            <Link
              href={`/hotel-connect/properties/${hotelId}/calendar?room=${rooms[0].id}`}
              className={buttonVariants({ variant: "outline", size: "md", className: "gap-1.5 justify-center" })}
            >
              <CalendarBlankIcon size={16} />
              Calendar View
            </Link>
          </div>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          {isHomestay
            ? "Set your base rate in the Pricing step of the listing wizard to activate rates & inventory here."
            : "No active rooms yet. Add a room to manage its rates & inventory."}
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
