"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "@heroicons/react/24/outline";
import { UserGroupIcon } from "@heroicons/react/24/solid";
import { PencilRulerIcon, BedIcon, EyeIcon } from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import type { Room } from "./dummy";

export default function RoomDetailsModal({
  room,
  open,
  onClose,
}: {
  room: Room | null;
  open: boolean;
  onClose: () => void;
}) {
  const [imgIndex, setImgIndex] = useState(0);

  // Reset to the first photo every time a (possibly different) room's modal opens.
  useEffect(() => {
    if (open) setImgIndex(0);
  }, [open, room?.id]);

  if (!open || !room) return null;

  const groups = room.allAmenities ?? [];
  const multi = room.images.length > 1;

  return (
    <div
      className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${room.name} details`}
    >
      <div
        className="relative bg-white w-full sm:max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-neutral-100 shrink-0">
          <h2 className="text-lg font-bold text-neutral-800">{room.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 size-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto">
          {/* Photo carousel */}
          <div className="relative h-64 sm:h-80 bg-neutral-100 group">
            <Image
              src={room.images[imgIndex]}
              alt={room.name}
              fill
              className="object-cover"
              sizes="(max-width:640px) 100vw, 640px"
            />
            {multi && (
              <>
                <button
                  type="button"
                  onClick={() => setImgIndex((v) => (v - 1 + room.images.length) % room.images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Previous photo"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-neutral-700" />
                </button>
                <button
                  type="button"
                  onClick={() => setImgIndex((v) => (v + 1) % room.images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Next photo"
                >
                  <ChevronRightIcon className="w-5 h-5 text-neutral-700" />
                </button>
                <span className="absolute bottom-2 right-2 text-[11px] font-semibold text-white bg-black/55 rounded-full px-2 py-0.5">
                  {imgIndex + 1} / {room.images.length}
                </span>
              </>
            )}
          </div>

          <div className="px-5 py-4">
            {/* Specs */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-700">
              {room.size && (
                <span className="flex items-center gap-1.5"><PencilRulerIcon className="size-4 text-neutral-400" /> {room.size}</span>
              )}
              {room.bed && (
                <span className="flex items-center gap-1.5"><BedIcon className="size-4 text-neutral-400" /> {room.bed}</span>
              )}
              {room.view && (
                <span className="flex items-center gap-1.5"><EyeIcon className="size-4 text-neutral-400" /> {room.view}</span>
              )}
              <span className="flex items-center gap-1.5"><UserGroupIcon className="size-4 text-neutral-400" /> {room.occupancy}</span>
            </div>

            {room.roomsLeft != null && room.roomsLeft <= 5 && (
              <p className="mt-2 text-xs font-bold text-red-500">
                Only {room.roomsLeft} room{room.roomsLeft === 1 ? "" : "s"} left at this price!
              </p>
            )}

            {/* Amenities */}
            {groups.length > 0 && (
              <div className="mt-5 pt-4 border-t border-neutral-100 space-y-5">
                <p className="text-sm font-bold text-neutral-800">Room Amenities</p>
                {groups.map((g) => (
                  <div key={g.group}>
                    <p className={cn("text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2")}>{g.group}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                      {g.items.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5 text-sm text-neutral-700">
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
