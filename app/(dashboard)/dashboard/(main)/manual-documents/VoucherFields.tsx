"use client";

import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ManualVoucherPayload } from "@/app/lib/manual-documents";
import { Field, RepeatableRow, RepeatableSection, StringListEditor, StatusFields, EmptyRows } from "./editor-ui";

/**
 * The voucher body — every section the automatic voucher renders, filled in by
 * hand.
 *
 * The form mirrors the printed document's structure rather than the database's:
 * a day carries its own hotel, meals and activities because that is how it
 * appears in the day-by-day table, and how ops reads a trip out loud over the
 * phone.
 *
 * `isPackage` gates the same three sections the automatic voucher gates: turn it
 * off and the itinerary, inclusions and policies stop rendering, leaving the
 * hotel-and-transport voucher that a bare stay actually needs. The fields stay
 * filled in underneath — flipping it back restores the work rather than
 * discarding it.
 */

type Day = ManualVoucherPayload["days"][number];
type Hotel = ManualVoucherPayload["hotels"][number];
type Cab = ManualVoucherPayload["cabs"][number];

export default function VoucherFields({
    payload,
    onChange,
    errors,
    tripStartDate,
}: {
    payload: ManualVoucherPayload;
    onChange: (next: ManualVoucherPayload) => void;
    errors: Record<string, string[]>;
    /** The header's trip start, used to date newly added rows. A day added to a
     *  trip starting on the 12th should default to the 12th, not to today. */
    tripStartDate: string;
}) {
    const set = (patch: Partial<ManualVoucherPayload>) => onChange({ ...payload, ...patch });
    const err = (key: string) => errors[key]?.[0];

    /** Day N's date, counting from the trip start. Blank when the header has no
     *  start date yet — better an empty date input than a date from 1970. */
    const dayDate = (dayNumber: number): string => {
        if (!tripStartDate) return "";
        const [y, m, d] = tripStartDate.split("-").map(Number);
        const date = new Date(y, m - 1, d + (dayNumber - 1));
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    const patchDay = (i: number, patch: Partial<Day>) =>
        set({ days: payload.days.map((d, k) => (k === i ? { ...d, ...patch } : d)) });
    const patchHotel = (i: number, patch: Partial<Hotel>) =>
        set({ hotels: payload.hotels.map((h, k) => (k === i ? { ...h, ...patch } : h)) });
    const patchCab = (i: number, patch: Partial<Cab>) =>
        set({ cabs: payload.cabs.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

    return (
        <div className="space-y-5">
            {/* ── What kind of voucher ── */}
            <section className="rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100 p-4">
                <div className="flex items-start gap-3 rounded-lg bg-dashboard-base-200/50 px-3 py-2.5">
                    <Switch
                        id="is-package"
                        checked={payload.isPackage}
                        onCheckedChange={(checked) => set({ isPackage: checked })}
                    />
                    <div>
                        <Label htmlFor="is-package" className="cursor-pointer text-xs font-medium">
                            Package voucher
                        </Label>
                        <p className="mt-0.5 text-[11px] text-dashboard-base-content/50">
                            {payload.isPackage
                                ? "Prints the day-by-day itinerary, inclusions/exclusions and policies."
                                : "Prints accommodation and transport only — the right document for a stay with no itinerary around it."}
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Duration label" hint="Optional — e.g. “5 Nights / 6 Days”">
                        <Input
                            value={payload.durationLabel ?? ""}
                            placeholder="5 Nights / 6 Days"
                            onChange={(e) => set({ durationLabel: e.target.value || null })}
                        />
                    </Field>
                    <Field label="Stay category" hint="Optional — printed in the trip summary strip">
                        <Input
                            value={payload.stayLabel ?? ""}
                            placeholder="Deluxe"
                            onChange={(e) => set({ stayLabel: e.target.value || null })}
                        />
                    </Field>
                </div>
            </section>

            {/* ── Day-by-day ── */}
            {payload.isPackage && (
                <RepeatableSection
                    title="Day-by-day itinerary"
                    description="One row per day of the trip, as it prints in the summary table."
                    addLabel="Add day"
                    onAdd={() => {
                        const day = payload.days.length + 1;
                        set({
                            days: [
                                ...payload.days,
                                {
                                    day,
                                    title: "",
                                    date: dayDate(day) || null,
                                    hotelName: null,
                                    hotelStars: null,
                                    roomLabel: null,
                                    hotelStatus: null,
                                    meals: [],
                                    mealPlan: null,
                                    mealsIncluded: [],
                                    activities: [],
                                },
                            ],
                        });
                    }}
                >
                    {payload.days.length === 0 ? (
                        <EmptyRows>No days added — the itinerary table will be omitted from the voucher.</EmptyRows>
                    ) : (
                        payload.days.map((day, i) => (
                            <RepeatableRow
                                key={i}
                                label={`Day ${day.day}`}
                                onRemove={() => set({ days: payload.days.filter((_, k) => k !== i) })}
                            >
                                <div className="grid gap-3 sm:grid-cols-[80px_1fr_160px]">
                                    <Field label="Day no.">
                                        <Input
                                            type="number"
                                            min={1}
                                            value={day.day}
                                            onChange={(e) => patchDay(i, { day: Number(e.target.value) || 1 })}
                                        />
                                    </Field>
                                    <Field label="Day title" error={err(`payload.days.${i}.title`)}>
                                        <Input
                                            value={day.title}
                                            placeholder="Arrival in Shimla & local sightseeing"
                                            onChange={(e) => patchDay(i, { title: e.target.value })}
                                        />
                                    </Field>
                                    <Field label="Date">
                                        <Input
                                            type="date"
                                            value={day.date ?? ""}
                                            onChange={(e) => patchDay(i, { date: e.target.value || null })}
                                        />
                                    </Field>
                                </div>

                                <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_90px_1.5fr]">
                                    <Field label="Hotel" hint="Leave blank for a day with no stay">
                                        <Input
                                            value={day.hotelName ?? ""}
                                            placeholder="Hotel Willow Banks"
                                            onChange={(e) => patchDay(i, { hotelName: e.target.value || null })}
                                        />
                                    </Field>
                                    <Field label="Stars">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={5}
                                            value={day.hotelStars ?? ""}
                                            onChange={(e) => patchDay(i, { hotelStars: e.target.value ? Number(e.target.value) : null })}
                                        />
                                    </Field>
                                    <Field label="Room">
                                        <Input
                                            value={day.roomLabel ?? ""}
                                            placeholder="Deluxe Double"
                                            onChange={(e) => patchDay(i, { roomLabel: e.target.value || null })}
                                        />
                                    </Field>
                                </div>

                                {/* A stay's confirmation state only means something on a day
                                    that has a hotel — printing a badge under a blank cell
                                    would be a confirmation of nothing. */}
                                {day.hotelName && (
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <Field label="Meal plan" hint="Falls back into the Meals column when no meals are listed">
                                            <Input
                                                value={day.mealPlan ?? ""}
                                                placeholder="MAP — with Breakfast & Dinner"
                                                onChange={(e) => patchDay(i, { mealPlan: e.target.value || null })}
                                            />
                                        </Field>
                                        <StatusFields
                                            isConfirmed={day.hotelStatus?.isConfirmed ?? false}
                                            status={day.hotelStatus?.status ?? "PENDING"}
                                            onChange={(hotelStatus) => patchDay(i, { hotelStatus })}
                                        />
                                    </div>
                                )}

                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label className="text-xs font-medium text-dashboard-base-content/80">Meals listed</Label>
                                        <p className="mt-0.5 mb-2 text-[11px] text-dashboard-base-content/50">Shown in the Meals column.</p>
                                        <StringListEditor
                                            values={day.meals}
                                            onChange={(meals) => patchDay(i, { meals })}
                                            placeholder="Breakfast"
                                            addLabel="Add meal"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-medium text-dashboard-base-content/80">Included with the room</Label>
                                        <p className="mt-0.5 mb-2 text-[11px] text-dashboard-base-content/50">Prints as “… included” under the hotel.</p>
                                        <StringListEditor
                                            values={day.mealsIncluded}
                                            onChange={(mealsIncluded) => patchDay(i, { mealsIncluded })}
                                            placeholder="Breakfast"
                                            addLabel="Add meal"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <Label className="text-xs font-medium text-dashboard-base-content/80">Activities</Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() =>
                                                patchDay(i, {
                                                    activities: [...day.activities, { name: "", isOptional: false, isConfirmed: false, status: "PENDING" }],
                                                })
                                            }
                                        >
                                            <Plus /> Add activity
                                        </Button>
                                    </div>
                                    {day.activities.length === 0 ? (
                                        <p className="text-[11px] text-dashboard-base-content/45">No activities — the cell prints a dash.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {day.activities.map((activity, a) => (
                                                <div key={a} className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                                                    <Input
                                                        value={activity.name}
                                                        placeholder="Kufri excursion"
                                                        onChange={(e) =>
                                                            patchDay(i, {
                                                                activities: day.activities.map((x, k) => (k === a ? { ...x, name: e.target.value } : x)),
                                                            })
                                                        }
                                                    />
                                                    <label className="flex h-10 cursor-pointer items-center gap-1.5 text-[11px] text-dashboard-base-content/70">
                                                        <input
                                                            type="checkbox"
                                                            className="size-3.5"
                                                            checked={activity.isOptional}
                                                            onChange={(e) =>
                                                                patchDay(i, {
                                                                    activities: day.activities.map((x, k) => (k === a ? { ...x, isOptional: e.target.checked } : x)),
                                                                })
                                                            }
                                                        />
                                                        Optional
                                                    </label>
                                                    <label className="flex h-10 cursor-pointer items-center gap-1.5 text-[11px] text-dashboard-base-content/70">
                                                        <input
                                                            type="checkbox"
                                                            className="size-3.5 accent-dashboard-success"
                                                            checked={activity.isConfirmed}
                                                            onChange={(e) =>
                                                                patchDay(i, {
                                                                    activities: day.activities.map((x, k) =>
                                                                        k === a
                                                                            ? { ...x, isConfirmed: e.target.checked, status: e.target.checked ? "CONFIRMED" : "PENDING" }
                                                                            : x,
                                                                    ),
                                                                })
                                                            }
                                                        />
                                                        Confirmed
                                                    </label>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Remove activity"
                                                        onClick={() =>
                                                            patchDay(i, { activities: day.activities.filter((_, k) => k !== a) })
                                                        }
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </RepeatableRow>
                        ))
                    )}
                </RepeatableSection>
            )}

            {/* ── Accommodation ──
                Printed as its own table only on a non-package voucher; on a package
                the day-by-day table above already names the property for every
                night. Kept available either way because the confirmed-count summary
                at the foot of the voucher counts these rows. */}
            <RepeatableSection
                title="Accommodation"
                description={
                    payload.isPackage
                        ? "Feeds the confirmed-count summary. The itinerary above is what prints the hotels."
                        : "Prints as the voucher's accommodation table."
                }
                addLabel="Add stay"
                onAdd={() =>
                    set({
                        hotels: [
                            ...payload.hotels,
                            {
                                dayNumber: payload.hotels.length + 1,
                                hotelName: "",
                                city: null,
                                state: null,
                                checkInDate: tripStartDate,
                                checkOutDate: tripStartDate,
                                roomType: "",
                                roomsCount: 1,
                                isConfirmed: false,
                                status: "PENDING",
                            },
                        ],
                    })
                }
            >
                {payload.hotels.length === 0 ? (
                    <EmptyRows>No stays added.</EmptyRows>
                ) : (
                    payload.hotels.map((hotel, i) => (
                        <RepeatableRow
                            key={i}
                            label={`Stay ${i + 1}`}
                            onRemove={() => set({ hotels: payload.hotels.filter((_, k) => k !== i) })}
                        >
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Field label="Hotel" error={err(`payload.hotels.${i}.hotelName`)}>
                                    <Input
                                        value={hotel.hotelName}
                                        placeholder="Hotel Willow Banks"
                                        onChange={(e) => patchHotel(i, { hotelName: e.target.value })}
                                    />
                                </Field>
                                <Field label="City">
                                    <Input
                                        value={hotel.city ?? ""}
                                        placeholder="Shimla"
                                        onChange={(e) => patchHotel(i, { city: e.target.value || null })}
                                    />
                                </Field>
                                <Field label="State">
                                    <Input
                                        value={hotel.state ?? ""}
                                        placeholder="Himachal Pradesh"
                                        onChange={(e) => patchHotel(i, { state: e.target.value || null })}
                                    />
                                </Field>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <Field label="Check-in" error={err(`payload.hotels.${i}.checkInDate`)}>
                                    <Input
                                        type="date"
                                        value={hotel.checkInDate}
                                        onChange={(e) => patchHotel(i, { checkInDate: e.target.value })}
                                    />
                                </Field>
                                <Field label="Check-out" error={err(`payload.hotels.${i}.checkOutDate`)}>
                                    <Input
                                        type="date"
                                        value={hotel.checkOutDate}
                                        onChange={(e) => patchHotel(i, { checkOutDate: e.target.value })}
                                    />
                                </Field>
                                <Field label="Room type">
                                    <Input
                                        value={hotel.roomType}
                                        placeholder="Deluxe Double"
                                        onChange={(e) => patchHotel(i, { roomType: e.target.value })}
                                    />
                                </Field>
                                <Field label="Rooms">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={hotel.roomsCount}
                                        onChange={(e) => patchHotel(i, { roomsCount: Number(e.target.value) || 1 })}
                                    />
                                </Field>
                            </div>
                            <div className="mt-3">
                                <StatusFields
                                    isConfirmed={hotel.isConfirmed}
                                    status={hotel.status}
                                    onChange={(next) => patchHotel(i, next)}
                                />
                            </div>
                        </RepeatableRow>
                    ))
                )}
            </RepeatableSection>

            {/* ── Transport ── */}
            <RepeatableSection
                title="Transport"
                description="One row per leg. Consecutive legs on the same vehicle fold into one row on the printed voucher."
                addLabel="Add leg"
                onAdd={() =>
                    set({
                        cabs: [
                            ...payload.cabs,
                            {
                                legNumber: payload.cabs.length + 1,
                                fromLocation: "",
                                toLocation: "",
                                transferDate: tripStartDate,
                                cabType: "Cab",
                                cabCount: 1,
                                capacity: 0,
                                isConfirmed: false,
                                status: "PENDING",
                                driverName: null,
                                driverPhone: null,
                                vehicleNumber: null,
                            },
                        ],
                    })
                }
            >
                {payload.cabs.length === 0 ? (
                    <EmptyRows>No transport — the voucher prints “No transport included in this booking”.</EmptyRows>
                ) : (
                    payload.cabs.map((cab, i) => (
                        <RepeatableRow
                            key={i}
                            label={`Leg ${cab.legNumber}`}
                            onRemove={() => set({ cabs: payload.cabs.filter((_, k) => k !== i) })}
                        >
                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
                                <Field label="Pickup point">
                                    <Input
                                        value={cab.fromLocation}
                                        placeholder="Chandigarh Airport"
                                        onChange={(e) => patchCab(i, { fromLocation: e.target.value })}
                                    />
                                </Field>
                                <Field label="Drop point">
                                    <Input
                                        value={cab.toLocation}
                                        placeholder="Shimla"
                                        onChange={(e) => patchCab(i, { toLocation: e.target.value })}
                                    />
                                </Field>
                                <Field label="Date" error={err(`payload.cabs.${i}.transferDate`)}>
                                    <Input
                                        type="date"
                                        value={cab.transferDate}
                                        onChange={(e) => patchCab(i, { transferDate: e.target.value })}
                                    />
                                </Field>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <Field label="Vehicle">
                                    <Input
                                        value={cab.cabType}
                                        placeholder="Innova Crysta"
                                        onChange={(e) => patchCab(i, { cabType: e.target.value })}
                                    />
                                </Field>
                                <Field label="Count">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={cab.cabCount}
                                        onChange={(e) => patchCab(i, { cabCount: Number(e.target.value) || 1 })}
                                    />
                                </Field>
                                <Field label="Seats" hint="0 omits the note">
                                    <Input
                                        type="number"
                                        min={0}
                                        value={cab.capacity}
                                        onChange={(e) => patchCab(i, { capacity: Number(e.target.value) || 0 })}
                                    />
                                </Field>
                                <Field label="Vehicle number">
                                    <Input
                                        value={cab.vehicleNumber ?? ""}
                                        placeholder="HP 03 A 1234"
                                        onChange={(e) => patchCab(i, { vehicleNumber: e.target.value || null })}
                                    />
                                </Field>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <Field label="Driver">
                                    <Input
                                        value={cab.driverName ?? ""}
                                        placeholder="Optional until assigned"
                                        onChange={(e) => patchCab(i, { driverName: e.target.value || null })}
                                    />
                                </Field>
                                <Field label="Driver phone">
                                    <Input
                                        value={cab.driverPhone ?? ""}
                                        placeholder="+91 …"
                                        onChange={(e) => patchCab(i, { driverPhone: e.target.value || null })}
                                    />
                                </Field>
                                <StatusFields
                                    isConfirmed={cab.isConfirmed}
                                    status={cab.status}
                                    onChange={(next) => patchCab(i, next)}
                                />
                            </div>
                        </RepeatableRow>
                    ))
                )}
            </RepeatableSection>

            {/* ── Inclusions / exclusions / policies ── */}
            {payload.isPackage && (
                <>
                    <section className="rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100 p-4">
                        <h3 className="mb-3 text-sm font-semibold text-dashboard-base-content">Inclusions &amp; exclusions</h3>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <Label className="text-xs font-medium text-dashboard-base-content/80">Inclusions</Label>
                                <div className="mt-2">
                                    <StringListEditor
                                        values={payload.inclusions}
                                        onChange={(inclusions) => set({ inclusions })}
                                        placeholder="Accommodation on twin-sharing basis"
                                        addLabel="Add inclusion"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs font-medium text-dashboard-base-content/80">Exclusions</Label>
                                <div className="mt-2">
                                    <StringListEditor
                                        values={payload.exclusions}
                                        onChange={(exclusions) => set({ exclusions })}
                                        placeholder="Airfare and train tickets"
                                        addLabel="Add exclusion"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <RepeatableSection
                        title="Policies"
                        description="Each block prints with its title and bulleted points."
                        addLabel="Add policy"
                        onAdd={() => set({ policies: [...payload.policies, { title: "", points: [""] }] })}
                    >
                        {payload.policies.length === 0 ? (
                            <EmptyRows>No policies — the section will be omitted.</EmptyRows>
                        ) : (
                            payload.policies.map((policy, i) => (
                                <RepeatableRow
                                    key={i}
                                    label={`Policy ${i + 1}`}
                                    onRemove={() => set({ policies: payload.policies.filter((_, k) => k !== i) })}
                                >
                                    <Field label="Title" error={err(`payload.policies.${i}.title`)}>
                                        <Input
                                            value={policy.title}
                                            placeholder="Cancellation policy"
                                            onChange={(e) =>
                                                set({ policies: payload.policies.map((p, k) => (k === i ? { ...p, title: e.target.value } : p)) })
                                            }
                                        />
                                    </Field>
                                    <div className="mt-3">
                                        <Label className="text-xs font-medium text-dashboard-base-content/80">Points</Label>
                                        <div className="mt-2">
                                            <StringListEditor
                                                values={policy.points}
                                                onChange={(points) =>
                                                    set({ policies: payload.policies.map((p, k) => (k === i ? { ...p, points } : p)) })
                                                }
                                                placeholder="50% refundable up to 15 days before departure"
                                                addLabel="Add point"
                                            />
                                        </div>
                                    </div>
                                </RepeatableRow>
                            ))
                        )}
                    </RepeatableSection>
                </>
            )}
        </div>
    );
}
