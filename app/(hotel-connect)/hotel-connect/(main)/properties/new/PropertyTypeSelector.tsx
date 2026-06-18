"use client";

import { useState, useTransition } from "react";
import {
  Buildings,
  Building,
  BuildingApartment,
  House,
  HouseLine,
  HouseSimple,
  Crown,
  Boat,
  Umbrella,
  Tree,
  TreeEvergreen,
  Plant,
  Tent,
  CheckCircle,
  ArrowRight,
} from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import Button from "@/app/components/ui/Button";
import { createDraftProperty } from "./actions";
import type { PropertySubType } from "@/app/generated/prisma";

type TypeConfig = {
  subType: PropertySubType;
  label: string;
  desc: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  iconColor: string;
  iconBg: string;
};

const HOTEL_TYPES: TypeConfig[] = [
  {
    subType: "HOTEL",
    label: "Hotel",
    desc: "Full-service property with staff & amenities",
    Icon: Buildings,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    subType: "RESORT",
    label: "Resort",
    desc: "Leisure destination with recreational facilities",
    Icon: Umbrella,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-50",
  },
  {
    subType: "LODGE",
    label: "Lodge",
    desc: "Cozy retreat, often in a nature setting",
    Icon: Tree,
    iconColor: "text-green-700",
    iconBg: "bg-green-50",
  },
  {
    subType: "GUEST_HOUSE",
    label: "Guest House",
    desc: "Family-run, homely accommodation",
    Icon: House,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
  },
  {
    subType: "PALACE",
    label: "Palace / Heritage",
    desc: "Historic royal or heritage property",
    Icon: Crown,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-50",
  },
  {
    subType: "HOUSEBOAT",
    label: "Houseboat",
    desc: "Floating accommodation on water",
    Icon: Boat,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-50",
  },
  {
    subType: "MOTEL",
    label: "Motel",
    desc: "Drive-to-room highway accommodation",
    Icon: Building,
    iconColor: "text-slate-600",
    iconBg: "bg-slate-100",
  },
];

const HOMESTAY_TYPES: TypeConfig[] = [
  {
    subType: "HOMESTAY",
    label: "Homestay",
    desc: "Stay with a local host family",
    Icon: HouseLine,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-50",
  },
  {
    subType: "VILLA",
    label: "Villa",
    desc: "Private villa with exclusive amenities",
    Icon: HouseSimple,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50",
  },
  {
    subType: "APARTMENT",
    label: "Apartment",
    desc: "Fully equipped apartment for rent",
    Icon: BuildingApartment,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
  },
  {
    subType: "FARMHOUSE",
    label: "Farmhouse",
    desc: "Rural stay with an open-air experience",
    Icon: Plant,
    iconColor: "text-lime-700",
    iconBg: "bg-lime-50",
  },
  {
    subType: "TREEHOUSE",
    label: "Treehouse",
    desc: "Elevated woodland accommodation",
    Icon: TreeEvergreen,
    iconColor: "text-emerald-700",
    iconBg: "bg-emerald-50",
  },
  {
    subType: "TENT_CAMP",
    label: "Tent / Camp",
    desc: "Glamping or camping experience",
    Icon: Tent,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
  },
];

function TypeCard({
  config,
  selected,
  disabled,
  onClick,
}: {
  config: TypeConfig;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { label, desc, Icon, iconColor, iconBg } = config;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center text-center gap-3 p-5 rounded-xl border-2 transition-all cursor-pointer select-none",
        selected
          ? "border-primary-500 bg-primary-50/60 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {selected && (
        <CheckCircle
          size={18}
          weight="fill"
          className="absolute top-2.5 right-2.5 text-primary-500"
        />
      )}
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon size={26} weight="duotone" className={iconColor} />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-800 leading-snug">{label}</p>
        <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{desc}</p>
      </div>
    </button>
  );
}

function Section({ title, types, selected, disabled, onSelect }: {
  title: string;
  types: TypeConfig[];
  selected: PropertySubType | null;
  disabled: boolean;
  onSelect: (t: PropertySubType) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {types.map((config) => (
          <TypeCard
            key={config.subType}
            config={config}
            selected={selected === config.subType}
            disabled={disabled}
            onClick={() => onSelect(config.subType)}
          />
        ))}
      </div>
    </div>
  );
}

export default function PropertyTypeSelector() {
  const [selected, setSelected] = useState<PropertySubType | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleContinue() {
    if (!selected) return;
    startTransition(async () => {
      await createDraftProperty(selected);
    });
  }

  return (
    <div className="space-y-8">
      <Section
        title="Hotels & Commercial Properties"
        types={HOTEL_TYPES}
        selected={selected}
        disabled={isPending}
        onSelect={setSelected}
      />
      <Section
        title="Homestays & Private Properties"
        types={HOMESTAY_TYPES}
        selected={selected}
        disabled={isPending}
        onSelect={setSelected}
      />

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleContinue}
          disabled={!selected || isPending}
          className="h-11 px-8 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Creating your listing…
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={15} weight="bold" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
