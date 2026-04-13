// app/(website)/profile/components/TravelPreferencesPanel.tsx

'use client'

import { useEffect, useState } from "react"
import { Section }             from "./Section"
import { SectionLabel }        from "./SectionLabel"
import { TravelBadge }         from "./TravelBadge"
import Button                  from "@/app/components/ui/Button"
import { cn }                  from "@/app/lib/utils"
import {
  MountainIcon,
  UmbrellaIcon,
  HeartIcon,
  UsersIcon,
  BriefcaseIcon,
  BackpackIcon,
  PawPrintIcon,
  UserIcon,
  HeartHandshakeIcon,
  BabyIcon,
  WalletIcon,
  SparklesIcon,
  CrownIcon,
  GemIcon,
  CalendarIcon,
  ClockIcon,
} from "lucide-react"
import Label from "@/app/components/forms/Label"
import { Heading, Text } from "@/app/components/ui/Typography"

// ── Maps ──────────────────────────────────────────────────────────────────────

const BUDGET_DB_TO_UI: Record<string, string> = {
  Budget: "Budget", MidRange: "Mid-range", Luxury: "Luxury", UltraLuxury: "Ultra-luxury",
};
const DURATION_DB_TO_UI: Record<string, string> = {
  Weekend: "Weekend (2–3N)", Short: "Short (4–5N)", Week: "Week (6–8N)",
  Long: "Long (9–14N)", Extended: "Extended (15N+)",
};
const budgetMap: Record<string, string> = {
  "Budget": "Budget", "Mid-range": "MidRange", "Luxury": "Luxury", "Ultra-luxury": "UltraLuxury",
};
const durationMap: Record<string, string> = {
  "Weekend (2–3N)": "Weekend", "Short (4–5N)": "Short", "Week (6–8N)": "Week",
  "Long (9–14N)": "Long", "Extended (15N+)": "Extended",
};

// ── Static data ───────────────────────────────────────────────────────────────

const allTripTypes = [
  { label: "Adventure",   icon: MountainIcon      },
  { label: "Leisure",     icon: UmbrellaIcon      },
  { label: "Pilgrimage",  icon: HeartHandshakeIcon },
  { label: "Honeymoon",   icon: HeartIcon         },
  { label: "Family",      icon: BabyIcon          },
  { label: "Corporate",   icon: BriefcaseIcon     },
  { label: "Backpacking", icon: BackpackIcon      },
  { label: "Wildlife",    icon: PawPrintIcon      },
];

const groupOptions = [
  { label: "Solo",   sub: "Just me",       icon: UserIcon  },
  { label: "Couple", sub: "2 travellers",  icon: HeartIcon },
  { label: "Family", sub: "With kids",     icon: UsersIcon },
  { label: "Group",  sub: "6+ people",     icon: UsersIcon },
];

const budgetOptions = [
  { label: "Budget",       range: "Under ₹15,000", icon: WalletIcon   },
  { label: "Mid-range",    range: "₹15K – 35K",    icon: SparklesIcon },
  { label: "Luxury",       range: "₹35K – 75K",    icon: CrownIcon    },
  { label: "Ultra-luxury", range: "₹75,000+",      icon: GemIcon      },
];

const durationOptions = [
  { label: "Weekend (2–3N)", sub: "Quick escape"    },
  { label: "Short (4–5N)",   sub: "Mini vacation"   },
  { label: "Week (6–8N)",    sub: "Standard trip"   },
  { label: "Long (9–14N)",   sub: "Deep dive"       },
  { label: "Extended (15N+)",sub: "Long journey"    },
];

const monthOptions = [
  { label: "Jan", peak: false }, { label: "Feb", peak: false },
  { label: "Mar", peak: true  }, { label: "Apr", peak: true  },
  { label: "May", peak: true  }, { label: "Jun", peak: false },
  { label: "Jul", peak: false }, { label: "Aug", peak: false },
  { label: "Sep", peak: true  }, { label: "Oct", peak: true  },
  { label: "Nov", peak: true  }, { label: "Dec", peak: false },
];

// ─────────────────────────────────────────────────────────────────────────────

export function TravelPreferencesPanel() {
  const [tripTypes, setTripTypes] = useState<string[]>([]);
  const [groupType, setGroupType] = useState<string | null>(null);
  const [budget,    setBudget]    = useState<string | null>(null);
  const [duration,  setDuration]  = useState<string | null>(null);
  const [months,    setMonths]    = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveStatus,setSaveStatus]= useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res  = await fetch("/api/user/preferences");
        if (!res.ok) throw new Error();
        const json = await res.json();
        const data = json.data ?? json;
        setTripTypes(data?.tripTypes ?? []);
        setGroupType(data?.groupType ?? null);
        setBudget(data?.budget   ? (BUDGET_DB_TO_UI[data.budget]     ?? null) : null);
        setDuration(data?.duration ? (DURATION_DB_TO_UI[data.duration] ?? null) : null);
        setMonths(data?.months ?? []);
      } catch {
        console.error("Error loading preferences");
      } finally {
        setLoading(false);
      }
    }
    fetchPreferences();
  }, []);

  function toggleMulti(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/user/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tripTypes,
          groupType: groupType  ?? undefined,
          budget:    budget     ? budgetMap[budget]     : undefined,
          duration:  duration   ? durationMap[duration] : undefined,
          months,
        }),
      });
      if (!res.ok) throw new Error();
      setSaveStatus("success");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      <Section title="Travel Preferences" subtitle="Help us personalise your experience">
        <div className="space-y-6">

          {/* ── Trip Type ──────────────────────────────────────────────── */}
          <div>
            <SectionLabel title="Trip Type" hint="Select all that apply" />
            <div className="flex flex-wrap gap-2 mt-2">
              {allTripTypes.map(({ label, icon: Icon }) => {
                const active = tripTypes.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggleMulti(tripTypes, setTripTypes, label)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                      active
                        ? "bg-primary-100 text-primary-600 border-primary-200 shadow-sm"
                        : "bg-neutral-100 text-secondary border-(--border-default)  hover:bg-white"
                    )}
                  >
                    <Icon size={13} className={active ? "text-primary-400" : "text-muted"} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Travelling As ──────────────────────────────────────────── */}
          <div>
            <SectionLabel title="Travelling As" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {groupOptions.map(({ label, sub, icon: Icon }) => {
                const active = groupType === label;
                return (
                  <button
                    key={label}
                    onClick={() => setGroupType(label)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all cursor-pointer",
                      active
                        ? "bg-primary-100 text-white border-primary-200 shadow-sm"
                        : "bg-neutral-100 text-secondary border-(--border-default) hover:border-primary/30 hover:text-primary hover:bg-primary/5 "
                    )}
                  >
                    <span className={cn(
                      "size-10 rounded-lg flex items-center justify-center",
                      active ? "bg-primary-500" : "bg-white shadow-md shadow-neutral-200"
                    )}>
                      <Icon size={16} className={active ? "text-white" : "text-muted"} />
                    </span>
                    <Text size='sm' weight='semibold' className={active ? "text-primary-600" : "text-primary" }>{label}</Text>
                    <Text size='xs' className={active ? "text-primary-500" : "text-secondary"}>{ 
                      sub
                    }</Text>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Budget ─────────────────────────────────────────────────── */}
          <div>
            <SectionLabel title="Budget Per Person" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {budgetOptions.map(({ label, range, icon: Icon }) => {
                const active = budget === label;
                return (
                  <button
                    key={label}
                    onClick={() => setBudget(label)}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      active
                        ? "bg-primary-100 text-white border-primary-200 shadow-sm"
                        : "bg-neutral-50 border-(--border-default) hover:border-primary/30 hover:bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "size-10 rounded-lg flex items-center justify-center",
                      active ? "bg-primary-500" : "bg-white shadow-md shadow-neutral-200"
                    )}>
                      <Icon className={cn('size-4', active ? "text-white" : "text-neutral-500")} />
                    </span>
                    <div>
                      <Text size='sm' weight='semibold' className={cn( active ? "text-primary-600" : "text-primary")}>
                        {label}
                      </Text>
                      <Text size='xs' className={cn("mt-0.5", active ? "text-primary-500" : "text-secondary")}>
                        {range}
                      </Text>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Trip Duration ──────────────────────────────────────────── */}
          <div>
            <SectionLabel title="Trip Duration" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {durationOptions.map(({ label, sub }) => {
                const active = duration === label;
                return (
                  <button
                    key={label}
                    onClick={() => setDuration(prev => prev === label ? null : label)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer",
                      active
                        ? "bg-primary-100 text-primary border-primary-200 shadow-sm"
                        : "bg-neutral-100 border-(--border-default) hover:border-primary/30 hover:bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "size-7 shrink-0 rounded-lg flex items-center justify-center",
                      active ? "bg-primary-500" : "bg-white shadow-md shadow-neutral-200"
                    )}>
                      <ClockIcon size={13} className={active ? "text-white" : "text-neutral-500"} />
                    </span>
                    <div>
                      <Text size="xs" className={cn("font-semibold", active ? "text-primary-600" : "text-neutral-800")}>
                        {label}
                      </Text>
                      <Text size="xss" className={cn("mt-0.5", active ? "text-primary-500" : "text-secondary")}>
                        {sub}
                      </Text>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Preferred Month ────────────────────────────────────────── */}
          <div>
            <SectionLabel
              title="Preferred Month"
              hint={<>Select all that work &nbsp;<span className="text-amber-500">●</span> peak season</>}
            />
            <div className="grid grid-cols-6 gap-1.5 mt-2">
              {monthOptions.map(({ label, peak }) => {
                const active = months.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggleMulti(months, setMonths, label)}
                    className={cn(
                      "relative flex flex-col items-center rounded-lg border py-2.5 text-xs font-medium transition-all cursor-pointer",
                      active
                        ? "bg-primary-100 text-primary-500 border-primary-400 shadow-sm"
                        : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:border-primary/30 hover:text-primary hover:bg-primary/5"
                    )}
                  >
                    {label}
                    {peak && (
                      <span className={cn(
                        "mt-1 h-1 w-1 rounded-full",
                        active ? "bg-primary-400" : "bg-warning-400"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <CalendarIcon size={11} className="text-neutral-400" />
              <Text size="xss" className="text-secondary">
                Peak months reflect Himachal Pradesh &amp; Kashmir seasonality
              </Text>
            </div>
          </div>

          {/* ── Save ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 border-t border-(--border-default) pt-4">
            {saveStatus === "success" && (
              <span className="text-xs text-green-600 font-medium">Preferences saved</span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-red-500 font-medium">Failed to save. Try again.</span>
            )}
            <Button size="sm" loading={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save Preferences"}
            </Button>
          </div>

        </div>
      </Section>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
          <div className="h-4 w-40 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="px-6 py-5 space-y-6 animate-pulse">
          <div>
            <div className="h-3 w-24 bg-neutral-200 rounded mb-3" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-7 w-24 bg-neutral-200 rounded-full" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-3 w-28 bg-neutral-200 rounded mb-3" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-neutral-200 rounded-xl" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-3 w-32 bg-neutral-200 rounded mb-3" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-neutral-200 rounded-xl" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-3 w-28 bg-neutral-200 rounded mb-3" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-neutral-200 rounded-xl" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-3 w-36 bg-neutral-200 rounded mb-3" />
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-10 bg-neutral-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}