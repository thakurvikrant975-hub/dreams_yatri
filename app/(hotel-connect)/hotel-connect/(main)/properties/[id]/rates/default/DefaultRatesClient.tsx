"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { saveDefaultRates, setDefaultInventory, type DefaultRatesDetail } from "../[roomId]/plan-actions";
import { RateField, occupancyTiers, OccupancyField } from "../rate-fields";
import { Input } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/input";
import { Label } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/label";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { Card } from "@/app/components/ui/Card";
import { Button, buttonVariants } from "@/app/components/ui/Button";

export type RoomDefaultData = {
  id: number;
  name: string;
  numRooms: number;
  maxAdults: number;
  plans: { id: number; label: string; detail: DefaultRatesDetail }[];
};

function PlanDefaultRatesForm({
  hotelId, roomId, planId, label, initial,
}: {
  hotelId: number; roomId: number; planId: number; label: string; initial: DefaultRatesDetail;
}) {
  const [basePrice, setBasePrice] = useState<number | null>(initial.basePrice);
  const [occupancyPrices, setOccupancyPrices] = useState<Record<number, number | null>>(initial.occupancyPrices);
  const [extraChildRate, setExtraChildRate] = useState<number | null>(initial.extraChildRate);
  const [extraAdultRate, setExtraAdultRate] = useState<number | null>(initial.extraAdultRate);
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function setOcc(occupancy: number, raw: string) {
    setOccupancyPrices((prev) => ({ ...prev, [occupancy]: raw.trim() === "" ? null : Number(raw) }));
  }

  function handleSave() {
    setMsg(null);
    if (basePrice == null || basePrice <= 0) { setMsg("Base rate (2 adults) is required."); return; }
    startSave(async () => {
      const result = await saveDefaultRates(hotelId, roomId, planId, {
        basePrice, occupancyPrices, extraChildRate, extraAdultRate,
      });
      setMsg(result.error ?? "Saved.");
    });
  }

  const tiers = occupancyTiers(initial.maxAdults);

  return (
    <Card variant="default" radius="sm" padding="sm" className="space-y-3">
      <p className="text-sm font-bold text-neutral-800">{label}</p>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">Base Rates</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <OccupancyField occupancy={2} value={basePrice} onChange={(v) => setBasePrice(v.trim() === "" ? null : Number(v))} />
          {tiers.map((n) => (
            <OccupancyField key={n} occupancy={n} value={occupancyPrices[n] ?? null} onChange={(v) => setOcc(n, v)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-neutral-100">
        <div>
          <Label className="mb-1">Free Child Rate (0-6 years)</Label>
          <div className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center px-2.5 text-sm text-neutral-400">Free</div>
        </div>
        <RateField value={extraChildRate} title="Paid Child Rate" subtitle="7-17 years" onChange={(v) => setExtraChildRate(v.trim() === "" ? null : Number(v))} />
        <RateField value={extraAdultRate} title="Extra Adult Charge" subtitle="18 years and above" onChange={(v) => setExtraAdultRate(v.trim() === "" ? null : Number(v))} />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {msg && <p className="text-xs text-neutral-500">{msg}</p>}
      </div>
    </Card>
  );
}

function DefaultInventoryField({ hotelId, room }: { hotelId: number; room: RoomDefaultData }) {
  const [value, setValue] = useState(String(room.numRooms));
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function handleSave() {
    setMsg(null);
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) { setMsg("Must be a whole number of at least 1."); return; }
    startSave(async () => {
      const result = await setDefaultInventory(hotelId, room.id, n);
      setMsg(result.error ?? "Saved.");
    });
  }

  const inputId = `default-inventory-${room.id}`;
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
      <div className="w-full sm:w-auto">
        <Label htmlFor={inputId} className="mb-1">Default Inventory</Label>
        <Input
          id={inputId}
          type="number" min={1} step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full sm:w-28 h-9"
        />
      </div>
      <Button variant="outline" size="sm" onClick={handleSave} loading={saving} className="w-full sm:w-auto justify-center">
        {saving ? "Saving…" : "Save"}
      </Button>
      {msg && <p className="text-xs text-neutral-500">{msg}</p>}
    </div>
  );
}

export default function DefaultRatesClient({
  hotelId, hotelName, rooms,
}: {
  hotelId: number; hotelName: string; rooms: RoomDefaultData[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{hotelName}</p>
          <h1 className="text-lg font-bold text-neutral-800">Default Rates & Inventory</h1>
        </div>
        <Link
          href={`/hotel-connect/properties/${hotelId}/rates`}
          className={buttonVariants({ variant: "outline", size: "md" })}
        >
          ← Back to Rates & Inventory
        </Link>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
        <InformationCircleIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          These rates and inventory count apply to any date you haven&apos;t explicitly set on the calendar —
          they&apos;re what keeps a listing bookable even for dates you haven&apos;t gotten around to pricing yet.
          Once you set a specific date&apos;s rate on the calendar, that date uses your override instead of these defaults.
        </p>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No active rooms yet.
        </div>
      ) : (
        <div className="space-y-5">
          {rooms.map((room) => (
            <SectionCard
              key={room.id}
              title={room.name}
              desc={`Max ${room.maxAdults} adults`}
              headerAction={<DefaultInventoryField hotelId={hotelId} room={room} />}
            >
              {room.plans.length === 0 ? (
                <p className="text-xs text-red-600">No active rate plans on this room yet.</p>
              ) : (
                room.plans.map((plan) => (
                  <PlanDefaultRatesForm
                    key={plan.id}
                    hotelId={hotelId}
                    roomId={room.id}
                    planId={plan.id}
                    label={plan.label}
                    initial={plan.detail}
                  />
                ))
              )}
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
