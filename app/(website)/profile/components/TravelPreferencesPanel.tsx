// app/(website)/profile/components/TravelPreferencesPanel.tsx

'use client'

import { Section }       from "./Section"
import { SectionLabel }  from "./SectionLabel"
import { TravelBadge }   from "./TravelBadge"
import { useState }      from "react"
import { cn }            from "@/app/lib/utils"
import Button            from "@/app/components/ui/Button"

// ── Maps — DB enum → display label ───────────────────────────────────────────
const BUDGET_DB_TO_UI: Record<string, string> = {
  Budget:      "Budget",
  MidRange:    "Mid-range",
  Luxury:      "Luxury",
  UltraLuxury: "Ultra-luxury",
};

const DURATION_DB_TO_UI: Record<string, string> = {
  Weekend: "Weekend (2–3N)",
  Short:   "Short (4–5N)",
  Week:    "Week (6–8N)",
  Long:    "Long (9–14N)",
  Extended:"Extended (15N+)",
};

const budgetMap: Record<string, string> = {
  "Budget":       "Budget",
  "Mid-range":    "MidRange",
  "Luxury":       "Luxury",
  "Ultra-luxury": "UltraLuxury",
};

const durationMap: Record<string, string> = {
  "Weekend (2–3N)":  "Weekend",
  "Short (4–5N)":    "Short",
  "Week (6–8N)":     "Week",
  "Long (9–14N)":    "Long",
  "Extended (15N+)": "Extended",
};

// ─────────────────────────────────────────────────────────────────────────────

export function TravelPreferencesPanel({ preferences }: { preferences: any }) {

  // ── Initialize from DB values ─────────────────────────────────────────────
  const [tripTypes, setTripTypes] = useState<string[]>(preferences?.tripTypes  ?? []);
  const [groupType, setGroupType] = useState<string | null>(preferences?.groupType ?? null);
  const [budget,    setBudget]    = useState<string | null>(
    preferences?.budget   ? (BUDGET_DB_TO_UI[preferences.budget]     ?? null) : null
  );
  const [duration,  setDuration]  = useState<string | null>(
    preferences?.duration ? (DURATION_DB_TO_UI[preferences.duration] ?? null) : null
  );
  const [months,    setMonths]    = useState<string[]>(preferences?.months ?? []);

  const [saving,     setSaving]     = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // ── Static options ────────────────────────────────────────────────────────
  const allTripTypes = [
    { label: "Adventure",   icon: "⛰️" },
    { label: "Leisure",     icon: "🌴" },
    { label: "Pilgrimage",  icon: "🧳" },
    { label: "Honeymoon",   icon: "❤️" },
    { label: "Family",      icon: "👨‍👩‍👧" },
    { label: "Corporate",   icon: "💼" },
    { label: "Backpacking", icon: "🏕️" },
    { label: "Wildlife",    icon: "🐆" },
  ];

  const groupOptions = [
    { label: "Solo",   sub: "Just me",      icon: "👤" },
    { label: "Couple", sub: "2 travellers", icon: "💑" },
    { label: "Family", sub: "With kids",    icon: "👨‍👩‍👧" },
    { label: "Group",  sub: "6+ people",    icon: "👥" },
  ];

  const budgetOptions = [
    { label: "Budget",       range: "Under ₹15,000" },
    { label: "Mid-range",    range: "₹15K – 35K"    },
    { label: "Luxury",       range: "₹35K – 75K"    },
    { label: "Ultra-luxury", range: "₹75,000+"       },
  ];

  const durationOptions = [
    "Weekend (2–3N)", "Short (4–5N)", "Week (6–8N)", "Long (9–14N)", "Extended (15N+)",
  ];

  const monthOptions = [
    { label: "Jan", peak: false }, { label: "Feb", peak: false },
    { label: "Mar", peak: true  }, { label: "Apr", peak: true  },
    { label: "May", peak: true  }, { label: "Jun", peak: false },
    { label: "Jul", peak: false }, { label: "Aug", peak: false },
    { label: "Sep", peak: true  }, { label: "Oct", peak: true  },
    { label: "Nov", peak: true  }, { label: "Dec", peak: false },
  ];

  function toggleMulti(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");

    const payload = {
      tripTypes,
      groupType: groupType  ?? undefined,
      budget:    budget     ? budgetMap[budget]     : undefined,
      duration:  duration   ? durationMap[duration] : undefined,
      months,
    };

    try {
      const res = await fetch("/api/user/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("Preferences save failed:", json.error);
        setSaveStatus("error");
        return;
      }

      setSaveStatus("success");
    } catch (e) {
      console.error("Network error:", e);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Section title="Travel Preferences" subtitle="Help us personalise your experience">
        <div className="space-y-4">

          {/* Trip Type */}
          <div>
            <SectionLabel title="Trip Type" hint="Select all that apply" />
            <div className="flex flex-wrap gap-2">
              {allTripTypes.map(({ label, icon }) => (
                <TravelBadge
                  key={label}
                  label={`${icon} ${label}`}
                  active={tripTypes.includes(label)}
                  onClick={() => toggleMulti(tripTypes, setTripTypes, label)}
                />
              ))}
            </div>
          </div>

          {/* Travelling As */}
          <div>
            <SectionLabel title="Travelling As" />
            <div className="grid grid-cols-4 gap-2">
              {groupOptions.map(({ label, sub, icon }) => (
                <button
                  key={label}
                  onClick={() => setGroupType(label)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors",
                    groupType === label
                      ? "border-[--accent] bg-[--accent-subtle] text-[--accent]"
                      : "border-[--border] bg-[--surface] text-[--text] hover:bg-[--surface-hover]"
                  )}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="text-xs font-semibold">{label}</span>
                  <span className={cn("text-[10px]", groupType === label ? "text-[--accent]" : "text-[--text-muted]")}>
                    {sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <SectionLabel title="Budget Per Person" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {budgetOptions.map(({ label, range }) => (
                <button
                  key={label}
                  onClick={() => setBudget(label)}
                  className={cn(
                    "flex flex-col rounded-lg border p-3 text-left transition-colors",
                    budget === label
                      ? "border-[--accent] bg-[--accent-subtle]"
                      : "border-[--border] bg-[--surface] hover:bg-[--surface-hover]"
                  )}
                >
                  <span className={cn("text-xs font-semibold", budget === label ? "text-[--accent]" : "text-[--text]")}>
                    {label}
                  </span>
                  <span className={cn("text-[10px] mt-0.5", budget === label ? "text-[--accent]" : "text-[--text-muted]")}>
                    {range}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <SectionLabel title="Trip Duration" />
            <div className="flex flex-wrap gap-2">
              {durationOptions.map(d => (
                <TravelBadge
                  key={d}
                  label={d}
                  active={duration === d}
                  onClick={() => setDuration(prev => prev === d ? null : d)}
                />
              ))}
            </div>
          </div>

          {/* Months */}
          <div>
            <SectionLabel
              title="Preferred Month"
              hint={<>Select all that work &nbsp;<span className="text-amber-500">●</span> peak season</>}
            />
            <div className="grid grid-cols-6 gap-1.5">
              {monthOptions.map(({ label, peak }) => (
                <button
                  key={label}
                  onClick={() => toggleMulti(months, setMonths, label)}
                  className={cn(
                    "relative flex flex-col items-center rounded-md border py-2 text-xs transition-colors",
                    months.includes(label)
                      ? "border-[--accent] bg-[--accent-subtle] font-semibold text-[--accent]"
                      : "border-[--border] bg-[--surface] text-[--text] hover:bg-[--surface-hover]"
                  )}
                >
                  {label}
                  {peak && (
                    <span className={cn(
                      "mt-1 h-1 w-1 rounded-full",
                      months.includes(label) ? "bg-[--accent]" : "bg-amber-400"
                    )} />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-[--text-muted]">
              Peak months reflect Himachal Pradesh &amp; Kashmir seasonality
            </p>
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3 border-t border-[--border] pt-3">
            {saveStatus === "success" && (
              <span className="text-xs text-green-600 font-medium">Preferences saved</span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-red-500 font-medium">Failed to save. Try again.</span>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Preferences"}
            </Button>
          </div>

        </div>
      </Section>
    </div>
  );
}