"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BedIcon, BathtubIcon, ForkKnifeIcon, PlusIcon, MinusIcon,
  StarIcon, CaretDownIcon, CaretUpIcon,
  TrashIcon, PencilSimpleIcon, WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { saveHomestayRooms, type HomestayRoomsState } from "./homestay-rooms-actions";
import {
  saveHomestayRoomCounts,
  addHomestayBedroom, deleteHomestayBedroom,
  addHomestayBathroom, deleteHomestayBathroom,
  addHomestayKitchen, removeHomestayKitchen,
  addHomestaySpace, deleteHomestaySpace,
} from "./homestay-rooms-crud-actions";
import {
  SPACE_TYPES,
  type BathroomDetail, type KitchenDetail, type SpaceItem,
} from "./homestay-rooms-types";
import type { BedroomDetail } from "../bedroom/[n]/bedroom-types";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HomestayRoomsData = {
  id: number;
  hs_bedrooms: number | null;   // null → counts not yet saved (Phase 1)
  hs_bathrooms: number | null;
  hs_has_kitchen: boolean | null;
  hs_bedroom_details: BedroomDetail[] | null;
  hs_bathroom_details: BathroomDetail[] | null;
  hs_kitchen_details: KitchenDetail | null;
  hs_space_items: SpaceItem[] | null;
};

// ── Shared stepper ────────────────────────────────────────────────────────────

function Stepper({
  value, onChange, min = 0, max = 99, disabled,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean;
}) {
  return (
    <div className="flex items-center shrink-0">
      <button type="button" disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-l-lg border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <MinusIcon size={13} weight="bold" />
      </button>
      <div className="w-11 h-8 border-t border-b border-neutral-300 flex items-center justify-center text-sm font-semibold text-neutral-800 bg-white">
        {String(value).padStart(2, "0")}
      </div>
      <button type="button" disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-r-lg border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <PlusIcon size={13} weight="bold" />
      </button>
    </div>
  );
}

// ── Shared FAQ accordion item ─────────────────────────────────────────────────

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-3 py-3 text-left">
        <p className={cn("text-xs font-medium leading-snug", open ? "text-primary-600" : "text-neutral-700")}>{q}</p>
        {open
          ? <CaretUpIcon size={14} className="text-primary-500 shrink-0 mt-0.5" />
          : <CaretDownIcon size={14} className="text-neutral-400 shrink-0 mt-0.5" />
        }
      </button>
      {open && <p className="text-xs text-neutral-500 leading-relaxed pb-3">{a}</p>}
    </div>
  );
}

// ── Phase 1: Count form ────────────────────────────────────────────────────────

function CountsForm({ hotel }: { hotel: HomestayRoomsData }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [bedrooms,   setBedrooms]   = useState(hotel.hs_bedrooms  ?? 1);
  const [bathrooms,  setBathrooms]  = useState(hotel.hs_bathrooms ?? 1);
  const [hasKitchen, setHasKitchen] = useState(hotel.hs_has_kitchen ?? false);
  const [spaces, setSpaces] = useState<Record<string, number>>(
    Object.fromEntries(SPACE_TYPES.map(s => [s.key, 0]))
  );

  function setSpace(key: string, val: number) {
    setSpaces(prev => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    startTransition(async () => {
      await saveHomestayRoomCounts(hotel.id, {
        bedrooms, bathrooms, hasKitchen, spaceCounts: spaces,
      });
    });
  }

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-neutral-900">Rooms & Spaces</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Please add all the rooms &amp; spaces of your property. You can also specify whether a
          particular space is accessible to the guests or not.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-3">

          {/* Bedrooms */}
          <div className="bg-white rounded-xl border border-neutral-200 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <BedIcon size={18} className="text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">Bedrooms</p>
                <p className="text-xs text-neutral-400 leading-none mt-0.5">Listed together as an Entire property</p>
              </div>
            </div>
            <Stepper value={bedrooms} onChange={setBedrooms} min={1} disabled={isPending} />
          </div>

          {/* Bathrooms */}
          <div className="bg-white rounded-xl border border-neutral-200 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <BathtubIcon size={18} className="text-primary-500" />
              </div>
              <p className="text-sm font-semibold text-neutral-800">Bathrooms</p>
            </div>
            <Stepper value={bathrooms} onChange={setBathrooms} min={1} disabled={isPending} />
          </div>

          {/* Kitchen */}
          <div className="bg-white rounded-xl border border-neutral-200 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <ForkKnifeIcon size={18} className="text-primary-500" />
              </div>
              <p className="text-sm font-semibold text-neutral-800">Kitchen</p>
            </div>
            <div className="flex items-center gap-5">
              {(["no", "yes"] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                  <input type="radio" name="kitchen" value={opt}
                    checked={hasKitchen === (opt === "yes")}
                    onChange={() => setHasKitchen(opt === "yes")}
                    disabled={isPending}
                    className="h-4 w-4 accent-primary-500 cursor-pointer" />
                  {opt === "no" ? "No" : "Yes"}
                </label>
              ))}
            </div>
          </div>

          {/* Additional Spaces */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800">Additional Spaces</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Add the other spaces available in your property (Excluding bedrooms &amp; bathrooms)
              </p>
            </div>
            <div className="divide-y divide-neutral-100">
              {SPACE_TYPES.map(s => (
                <div key={s.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <p className="text-sm text-neutral-700">{s.label}</p>
                  <Stepper
                    value={spaces[s.key] ?? 0}
                    onChange={v => setSpace(s.key, v)}
                    min={0}
                    disabled={isPending}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>

        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl overflow-hidden bg-linear-to-br from-primary-500 to-primary-700 text-white p-5 relative">
            <StarIcon size={72} weight="fill" className="absolute -top-3 -right-3 text-white/10" />
            <p className="text-sm font-bold mb-2 relative">Step Detail</p>
            <p className="text-xs leading-relaxed relative text-white/85">
              Provide details about the total number of bedrooms, bathrooms &amp; additional spaces
              such as living room, parking space, etc. available on your property.
              It will help your guests learn the layout of your property.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 px-5 py-2">
            <div className="flex items-center justify-between py-3 border-b border-neutral-100">
              <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Frequently Asked Questions</p>
            </div>
            <FaqItem defaultOpen
              q="What kind of details should I provide for rooms & spaces on my property?"
              a="You need to add details such as the name, facilities, amenities, and access to guests. This helps guests learn how many people can be accommodated on your property."
            />
            <FaqItem
              q="Can I add or edit the details of rooms/spaces after the property is onboarded?"
              a="Yes, you can update your room and space details anytime from your property dashboard after it goes live."
            />
            <FaqItem
              q="Can I personalise the names & descriptions for rooms & spaces?"
              a="Yes — after setting the counts, you'll be able to add individual details for each room and space."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Phase 2: List edit view ───────────────────────────────────────────────────

function SectionHeader({
  icon, title, count, collapsed, onToggle,
}: {
  icon: React.ReactNode; title: string; count: string;
  collapsed: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-200">
      <div className="flex items-center gap-2.5">
        <span className="text-neutral-500">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-neutral-800">{title}</p>
          <p className="text-xs text-neutral-400">{count}</p>
        </div>
      </div>
      <button type="button" onClick={onToggle}
        className="text-xs font-medium text-primary-600 hover:text-primary-700">
        {collapsed ? "Show" : "Hide"}
      </button>
    </div>
  );
}

function RoomCard({
  name, summary, hasDetails, editHref, onDelete, isDeleting,
}: {
  name: string; summary?: string; hasDetails: boolean;
  editHref: string; onDelete: () => void; isDeleting: boolean;
}) {
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">{name}</p>
          {summary && <p className="text-xs text-neutral-400 truncate mt-0.5">{summary}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onDelete} disabled={isDeleting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
            <TrashIcon size={14} />
          </button>
          <Link href={editHref}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
            <PencilSimpleIcon size={14} />
          </Link>
        </div>
      </div>
      {!hasDetails && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <WarningIcon size={13} weight="fill" className="text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700">Add Details</span>
        </div>
      )}
    </div>
  );
}

function bedroomSummary(d: BedroomDetail): string {
  const bedParts = Object.entries(d.beds ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} x ${k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`);
  const parts: string[] = [];
  if (bedParts.length) parts.push(bedParts.join(" · "));
  if (d.has_bathroom) parts.push(d.bathroom_type || "Private Bathroom");
  if (d.has_balcony) parts.push("Private Balcony");
  return parts.join(" | ");
}

function ListEditView({ hotel }: { hotel: HomestayRoomsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [bedroomsOpen,  setBedroomsOpen]  = useState(true);
  const [bathroomsOpen, setBathroomsOpen] = useState(true);
  const [kitchenOpen,   setKitchenOpen]   = useState(true);
  const [spacesOpen,    setSpacesOpen]    = useState(true);
  const [spaceDropdownOpen, setSpaceDropdownOpen] = useState(false);

  const boundAction = saveHomestayRooms.bind(null, hotel.id);
  const [state, formAction] = useActionState<HomestayRoomsState, FormData>(boundAction, {});

  useEffect(() => {
    if (state.ok) window.location.href = `/hotel-connect/properties/${hotel.id}/edit?tab=4`;
  }, [state.ok, hotel.id]);

  const bedrooms  = (hotel.hs_bedroom_details  ?? []) as BedroomDetail[];
  const bathrooms = (hotel.hs_bathroom_details ?? []) as BathroomDetail[];
  const kitchen   = hotel.hs_kitchen_details as KitchenDetail | null;
  const spaces    = (hotel.hs_space_items    ?? []) as SpaceItem[];

  function mutate(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="p-5 space-y-4">
      {/* Hidden form — WizardShell "Save & Continue" footer submits this */}
      <form id="wizard-form" action={formAction} className="hidden" />

      {/* ── Bedrooms ── */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <SectionHeader
          icon={<BedIcon size={16} />}
          title="Bedrooms"
          count={`${bedrooms.length} Bedroom${bedrooms.length !== 1 ? "s" : ""} (Listed together as an Entire property)`}
          collapsed={!bedroomsOpen}
          onToggle={() => setBedroomsOpen(v => !v)}
        />
        {bedroomsOpen && (
          <>
            {bedrooms.map((b, i) => (
              <RoomCard
                key={i}
                name={b.name || `Bedroom ${i + 1}`}
                summary={bedroomSummary(b) || undefined}
                hasDetails={(b.step_reached ?? 0) >= 4}
                editHref={`/hotel-connect/properties/${hotel.id}/edit/bedroom/${i + 1}`}
                isDeleting={isPending}
                onDelete={() => mutate(() => deleteHomestayBedroom(hotel.id, i + 1))}
              />
            ))}
            <div className="px-4 py-3">
              <button type="button" disabled={isPending}
                onClick={() => mutate(async () => {
                  const { n } = await addHomestayBedroom(hotel.id);
                  router.push(`/hotel-connect/properties/${hotel.id}/edit/bedroom/${n}`);
                })}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50">
                <PlusIcon size={14} weight="bold" />
                Add New
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Bathrooms ── */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <SectionHeader
          icon={<BathtubIcon size={16} />}
          title="Bathrooms"
          count={`${bathrooms.length} Bathroom${bathrooms.length !== 1 ? "s" : ""}`}
          collapsed={!bathroomsOpen}
          onToggle={() => setBathroomsOpen(v => !v)}
        />
        {bathroomsOpen && (
          <>
            {bathrooms.map((b, i) => (
              <RoomCard
                key={i}
                name={b.name || `Bathroom ${i + 1}`}
                summary={b.type || undefined}
                hasDetails={(b.step_reached ?? 0) >= 1}
                editHref={`/hotel-connect/properties/${hotel.id}/edit/bathroom/${i + 1}`}
                isDeleting={isPending}
                onDelete={() => mutate(() => deleteHomestayBathroom(hotel.id, i + 1))}
              />
            ))}
            <div className="px-4 py-3">
              <button type="button" disabled={isPending}
                onClick={() => mutate(async () => {
                  const { n } = await addHomestayBathroom(hotel.id);
                  router.push(`/hotel-connect/properties/${hotel.id}/edit/bathroom/${n}`);
                })}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50">
                <PlusIcon size={14} weight="bold" />
                Add New
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Kitchen ── */}
      {hotel.hs_has_kitchen && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <SectionHeader
            icon={<ForkKnifeIcon size={16} />}
            title="Kitchen"
            count={kitchen?.type || "Details pending"}
            collapsed={!kitchenOpen}
            onToggle={() => setKitchenOpen(v => !v)}
          />
          {kitchenOpen && (
            <div className="border-b border-neutral-100">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm font-medium text-neutral-800">Kitchen Details</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" disabled={isPending}
                    onClick={() => mutate(() => removeHomestayKitchen(hotel.id))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                    <TrashIcon size={14} />
                  </button>
                  <Link href={`/hotel-connect/properties/${hotel.id}/edit/kitchen`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                    <PencilSimpleIcon size={14} />
                  </Link>
                </div>
              </div>
              {!kitchen?.type && (
                <div className="mx-4 mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <WarningIcon size={13} weight="fill" className="text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700">Kitchen Details missing</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Additional Spaces ── */}
      {spaces.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <SectionHeader
            icon={<span className="text-xs font-bold">⊞</span>}
            title="Additional Spaces"
            count={`${spaces.length} Additional space${spaces.length !== 1 ? "s" : ""}`}
            collapsed={!spacesOpen}
            onToggle={() => setSpacesOpen(v => !v)}
          />
          {spacesOpen && (
            <>
              {spaces.map((s, i) => (
                <RoomCard
                  key={s.id}
                  name={`${s.label} ${s.instance}`}
                  hasDetails={s.details_added}
                  editHref={`/hotel-connect/properties/${hotel.id}/edit/space/${i}`}
                  isDeleting={isPending}
                  onDelete={() => mutate(() => deleteHomestaySpace(hotel.id, i))}
                />
              ))}
              {/* Add more spaces */}
              <div className="px-4 py-3 relative">
                <button type="button" disabled={isPending}
                  onClick={() => setSpaceDropdownOpen(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50">
                  <PlusIcon size={14} weight="bold" />
                  Add New
                  <CaretDownIcon size={12} className={cn("transition-transform", spaceDropdownOpen && "rotate-180")} />
                </button>
                {spaceDropdownOpen && (
                  <div className="absolute bottom-full left-4 mb-1 w-52 bg-white rounded-xl border border-neutral-200 shadow-lg py-1 z-10 max-h-56 overflow-y-auto">
                    {SPACE_TYPES.map(st => (
                      <button key={st.key} type="button" disabled={isPending}
                        onClick={() => { setSpaceDropdownOpen(false); mutate(() => addHomestaySpace(hotel.id, st.key)); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        {st.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HomestayRoomsTab({ hotel }: { hotel: HomestayRoomsData }) {
  const countsSaved = hotel.hs_bedrooms != null;
  return countsSaved ? <ListEditView hotel={hotel} /> : <CountsForm hotel={hotel} />;
}
