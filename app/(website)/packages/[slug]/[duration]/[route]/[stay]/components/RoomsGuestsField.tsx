'use client';

import { useEffect, useState } from 'react';
import { Popover } from 'radix-ui';
import { UsersFourIcon, CaretDownIcon, PlusIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { Stepper, notifyLimit } from '@/app/components/ui/Stepper';
import Button from '@/app/components/ui/Button';
import { cn } from '@/app/lib/utils';
import { useBooking, type RoomGuests } from './PackageBookingProvider';

const MAX_CHILDREN_PER_ROOM = 10;
const CHILD_AGE_MAX = 11; // children = below 12 years
const MAX_ROOM_CARDS = 20; // UI ceiling — independent of real hotel inventory, checked on Apply

// Dropdown must sit above the package page's sticky info band / tab bar (z-210).
const MENU_Z = 'z-250';

function summarizeRoom(r: RoomGuests): string {
    const parts = [`${r.adults} Adult${r.adults > 1 ? 's' : ''}`];
    if (r.childAges.length) parts.push(`${r.childAges.length} Child${r.childAges.length > 1 ? 'ren' : ''}`);
    return parts.join(', ');
}

function summarizeTrip(rooms: RoomGuests[]): string {
    const adults = rooms.reduce((sum, r) => sum + r.adults, 0);
    const children = rooms.reduce((sum, r) => sum + r.childAges.length, 0);
    const parts = [`${adults} Adult${adults !== 1 ? 's' : ''}`];
    if (children) parts.push(`${children} Child${children !== 1 ? 'ren' : ''}`);
    parts.push(`${rooms.length} Room${rooms.length !== 1 ? 's' : ''}`);
    return parts.join(', ');
}

/** MMT-style rooms/guests picker: each room is configured independently
 *  (its own Adults/Children, capped at that room's real occupancy), with
 *  the actual hotel-inventory check deferred to Apply — see the plan doc
 *  for why this replaces TravellersField on the package page specifically. */
export default function RoomsGuestsField() {
    const { roomGuests, setRoomGuests, maxRooms, personsPerRoom } = useBooking();
    const [open, setOpen] = useState(false);

    // Draft edited inside the popover; committed on Apply (mirrors MMT).
    const [draftRooms, setDraftRooms] = useState<RoomGuests[]>(roomGuests);
    const [expandedIndex, setExpandedIndex] = useState(0);

    useEffect(() => {
        if (open) {
            setDraftRooms(roomGuests);
            setExpandedIndex(0);
        }
    }, [open, roomGuests]);

    function updateRoom(idx: number, patch: Partial<RoomGuests>) {
        setDraftRooms((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    }

    function addRoom() {
        if (draftRooms.length >= MAX_ROOM_CARDS) {
            notifyLimit(`Maximum ${MAX_ROOM_CARDS} rooms per booking`);
            return;
        }
        setExpandedIndex(draftRooms.length);
        setDraftRooms((prev) => [...prev, { adults: 1, childAges: [] }]);
    }

    function removeRoom(idx: number) {
        setDraftRooms((prev) => prev.filter((_, i) => i !== idx));
        setExpandedIndex((cur) => (cur >= idx ? Math.max(0, cur - 1) : cur));
    }

    const hasUnsetAge = draftRooms.some((r) => r.childAges.some((a) => a < 0));

    function apply() {
        if (hasUnsetAge) return;
        if (draftRooms.length > maxRooms) {
            notifyLimit(`Only up to ${maxRooms} room${maxRooms > 1 ? 's' : ''} available for this trip's hotels — you have ${draftRooms.length}, please remove ${draftRooms.length - maxRooms}.`);
            return;
        }
        setRoomGuests(draftRooms);
        setOpen(false);
    }

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    className={cn(
                        'flex w-full items-center rounded-input border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors cursor-pointer',
                        'focus:outline-none focus:border-primary-400 border-[0.13em] focus:ring-[0.11em] focus:ring-primary-100',
                        open && 'border-primary-400 border-[0.13em] ring-[0.11em] ring-primary-100',
                    )}
                >
                    <UsersFourIcon weight="fill" className="mr-2 size-4.5 shrink-0 text-muted" />
                    <span className="flex-1 truncate text-sm text-neutral-800">{summarizeTrip(roomGuests)}</span>
                    <CaretDownIcon className={cn('ml-2 size-4 shrink-0 text-neutral-400 transition-transform', open && 'rotate-180')} />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    avoidCollisions
                    collisionPadding={12}
                    className={cn(MENU_Z, 'w-[min(92vw,380px)] max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-white p-4 shadow-xl shadow-black/10')}
                >
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Rooms & Guests</p>

                    <div className="space-y-3">
                        {draftRooms.map((room, idx) => {
                            const guestCount = room.adults + room.childAges.length;
                            const atCap = guestCount >= personsPerRoom;
                            const expanded = idx === expandedIndex;

                            return (
                                <div key={idx} className="rounded-lg border border-neutral-200 p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Room {idx + 1}</p>
                                            {!expanded && (
                                                <p className="text-sm font-semibold text-neutral-800">{summarizeRoom(room)}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {!expanded && (
                                                <button
                                                    type="button"
                                                    className="text-xs font-semibold text-primary-500 hover:underline cursor-pointer"
                                                    onClick={() => setExpandedIndex(idx)}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {idx > 0 && (
                                                <button
                                                    type="button"
                                                    className="text-xs font-semibold text-neutral-400 hover:text-error-500 cursor-pointer"
                                                    onClick={() => removeRoom(idx)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {expanded && (
                                        <div className="mt-3 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-neutral-800">Adults</p>
                                                    <p className="text-xs text-neutral-400">Above 12 years</p>
                                                </div>
                                                <Stepper
                                                    value={room.adults}
                                                    min={1}
                                                    max={Math.max(1, personsPerRoom - room.childAges.length)}
                                                    onChange={(n) => updateRoom(idx, { adults: n })}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-neutral-800">Children</p>
                                                    <p className="text-xs text-neutral-400">Below 12 years</p>
                                                </div>
                                                <Stepper
                                                    value={room.childAges.length}
                                                    min={0}
                                                    max={Math.min(MAX_CHILDREN_PER_ROOM, Math.max(0, personsPerRoom - room.adults))}
                                                    onChange={(n) => {
                                                        const nextAges = n > room.childAges.length
                                                            ? [...room.childAges, ...Array(n - room.childAges.length).fill(-1)]
                                                            : room.childAges.slice(0, n);
                                                        updateRoom(idx, { childAges: nextAges });
                                                    }}
                                                />
                                            </div>

                                            {atCap && (
                                                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                                                    <WarningCircleIcon weight="fill" className="mt-0.5 size-4 shrink-0 text-amber-500" />
                                                    <p className="text-xs text-amber-700">
                                                        Maximum <strong>{personsPerRoom} guests</strong> are allowed in this room
                                                    </p>
                                                </div>
                                            )}

                                            {room.childAges.length > 0 && (
                                                <div className="rounded-lg bg-neutral-50 p-3">
                                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                                                        Age of each child <span className="text-primary-500">*</span>
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {room.childAges.map((age, ai) => (
                                                            <div key={ai} className="flex items-center gap-2">
                                                                <span className="shrink-0 text-xs text-neutral-500">Child {ai + 1}</span>
                                                                <select
                                                                    value={age}
                                                                    onChange={(e) => {
                                                                        const nextAges = room.childAges.map((a, i) => (i === ai ? Number(e.target.value) : a));
                                                                        updateRoom(idx, { childAges: nextAges });
                                                                    }}
                                                                    className={cn(
                                                                        'flex-1 rounded-md border bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none transition-colors',
                                                                        age < 0 ? 'border-primary-300 text-neutral-400' : 'border-neutral-200',
                                                                    )}
                                                                >
                                                                    <option value={-1} disabled>Age</option>
                                                                    {Array.from({ length: CHILD_AGE_MAX + 1 }).map((_, a) => (
                                                                        <option key={a} value={a}>{a === 0 ? '< 1 yr' : `${a} yr`}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {room.childAges.some((a) => a < 0) && (
                                                        <p className="mt-2 text-[11px] text-primary-500">Select an age for each child.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRoom}
                        className="mt-3 w-full !text-primary-500 !ring-1 !ring-inset !ring-primary-200"
                    >
                        <PlusIcon weight="bold" className="size-3.5" />
                        Add Another Room
                    </Button>

                    <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                        <span className="text-xs text-neutral-400">{summarizeTrip(draftRooms)}</span>
                        <Button variant="premium" size="sm" disabled={hasUnsetAge} onClick={apply} className="rounded-lg px-6">
                            Apply
                        </Button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
