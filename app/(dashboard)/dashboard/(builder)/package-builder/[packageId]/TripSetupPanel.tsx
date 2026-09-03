"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Trip Setup — what the right-hand panel keeps.
//
// Everything here is package-level and deliberately NOT in the preview, for
// one reason: none of it is a thing you point at on the document. Travellers,
// dates and route stops are the parameters the document is generated FROM, and
// there is nothing on the page to click to change "how many adults". Putting
// them in a drawer keyed to some arbitrary element would be worse than leaving
// them where they are.
//
// They also happen to be the inputs everything else depends on:
//
//   travellers   → room and mattress counts, and therefore every price
//   travel date  → seasonal rates, check-in dates, and Mark Ready validation
//   route stops  → deriveDayLocations, the default search city for EVERY
//                  hotel and cab drawer
//   margin / GST → the package's economics
//
// So this is the block that survives when the six tabs go.
// ─────────────────────────────────────────────────────────────────────────────

import { CalendarDays, Users, MapPin, Baby, IndianRupee } from "./builder-icons";
import { cn } from "@/app/lib/utils";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { useBuilder, type PackageForm } from "./builder-context";
import { RouteStopsEditor } from "./RouteStopsEditor";
import { recalcFromStops } from "./day-mutations";
import {
  resizeAges, ageInputValue, parseAgeInput, travellersMissingAges,
  bandsOf, bandOf, ageBandsLine, pricedPartyLine, bandMismatchLines,
  normalizeAgeBands, BAND_LIMITS, AGE_MIN, AGE_MAX,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages";

function Block({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
      <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
        <Icon size={15} className="text-dashboard-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

/** One traveller's age box.
 *
 * Shows the band the typed age lands in whenever that isn't the box's own —
 * at the field, not just in the summary below, because the correction (move
 * them to the other box, or widen the band) is made right here. Tinted rather
 * than red-flagged: a 4-year-old under Children on a package whose infant band
 * runs to 5 is a perfectly ordinary thing for an exec to have typed, and the
 * price is right regardless. */
function AgeInput({ age, label, expected, bands, onChange }: {
  age: number;
  label: string;
  expected: "child" | "infant";
  bands: { infantMaxAge: number; childMaxAge: number };
  onChange: (v: number) => void;
}) {
  const band = bandOf(age, bands);
  const off = band != null && band !== expected;
  return (
    <div className="space-y-0.5">
      <Input
        type="number" min={AGE_MIN} max={AGE_MAX}
        // Empty, not 0, while unanswered — see traveller-ages.ts. A prefilled
        // 0 was the whole reason costing kept receiving ages nobody had
        // actually entered.
        value={ageInputValue(age)}
        placeholder="–"
        onChange={(e) => onChange(parseAgeInput(e.target.value))}
        className={cn(
          "h-8 w-14 text-sm",
          off && "border-dashboard-warning/70 bg-dashboard-warning/5",
        )}
        aria-label={label}
      />
      {off && (
        <span className="block text-center text-[9px] font-medium text-dashboard-warning">
          {band === "adult" ? "adult" : band === "child" ? "child" : "infant"}
        </span>
      )}
    </div>
  );
}

export function TripSetupPanel({ computed, onApplyPrice }: {
  /** What the trip currently costs, all margins and tax applied. */
  computed: { finalPrice: number; perPerson: number };
  /** Writes perPerson into the package. Explicit rather than automatic: the
   * exec is allowed to quote a number that isn't the computed one, and
   * overwriting a deliberate figure every time a hotel changed would be
   * worse than asking.
   *
   * Omitted while the package is out for review, when the quoted figure is
   * costing's — set by approve and Edit Pricing, which recompute and record
   * it. Left in, the button moved the panel's own numbers and was dropped by
   * the next save, which is a worse answer than not offering it. */
  onApplyPrice?: () => void;
}) {
  const { form, setForm, canEdit, syncDaysWithStops } = useBuilder();
  const missingAges = travellersMissingAges(form);
  const bands = bandsOf(form);
  const mismatches = bandMismatchLines(form);

  function field<K extends keyof PackageForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value as PackageForm[K] }));
  }

  /** Both boundaries are stored raw and normalised on read, so an exec can
   * type through an intermediate value (clearing "12" to type "10" passes
   * through empty) without the other bound jumping to keep the pair valid.
   * normalizeAgeBands is what guarantees infant < child everywhere it counts. */
  function setBand(key: "infantMaxAge" | "childMaxAge", raw: string) {
    const parsed = parseInt(raw, 10);
    const limits = BAND_LIMITS[key];
    const next = Number.isNaN(parsed)
      ? limits.min
      : Math.min(limits.max, Math.max(limits.min, parsed));
    setForm((f) => ({ ...f, ...normalizeAgeBands({ ...f, [key]: next }) }));
  }

  return (
    <div className={canEdit ? "space-y-4" : "space-y-4 pointer-events-none opacity-60"}>
      <Block icon={CalendarDays} title="Trip">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Travel date</span>
            <Input
              type="date"
              value={form.travelDate}
              onChange={field("travelDate")}
              // Browser-native floor on the picker itself — belt-and-braces
              // with the same rule in validateItineraryRequiredFields, which
              // is what actually blocks Download/Preview/Send if this is
              // ever bypassed (typed/pasted, or an already-past date left
              // over from before today).
              min={new Date().toISOString().slice(0, 10)}
              className="h-9 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Pickup point</span>
            <Input
              value={form.startingPoint}
              onChange={field("startingPoint")}
              placeholder="e.g. Delhi"
              className="h-9 text-sm"
            />
          </label>
        </div>
        <label className="space-y-1 block">
          <span className="text-[11px] text-dashboard-base-content/60">Destination(s)</span>
          <Input
            value={form.destination}
            onChange={field("destination")}
            placeholder="e.g. Manali, Kullu"
            className="h-9 text-sm"
          />
          <span className="text-[10px] text-dashboard-base-content/45">
            Filled in from the route stops below as you add them.
          </span>
        </label>
        <p className="text-[11px] text-dashboard-base-content/55">
          {form.totalDays} day{form.totalDays !== 1 ? "s" : ""} · {form.totalNights} night
          {form.totalNights !== 1 ? "s" : ""}
        </p>
      </Block>

      <Block icon={MapPin} title="Route">
        <RouteStopsEditor
          stops={form.stops}
          onChange={(stops) => setForm((f) => ({ ...f, stops, ...recalcFromStops(stops) }))}
          dayCount={form.itineraries.length}
          onSync={syncDaysWithStops}
        />
        <p className="text-[11px] text-dashboard-base-content/45">
          Each day&apos;s hotel and cab search defaults to the stop it falls under, so
          getting these right saves typing a city on every day.
        </p>
      </Block>

      <Block icon={Users} title="Travellers">
        {/* The bands come FIRST, above the counts, because they change what
            the counts mean. Reading down, the panel now says "on this trip an
            infant is 0–2 and a child is 3–12 — now, how many of each?", which
            is the order the question is actually asked in when an exec rings
            a property. Underneath the boxes, both, is the party as pricing
            reads it. */}
        <div className="rounded-[10px] border border-dashboard-base-300 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-dashboard-base-content/70 flex items-center gap-1">
              <Baby size={11} /> Age bands for this package
            </span>
            {(bands.infantMaxAge !== 2 || bands.childMaxAge !== 12) && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, infantMaxAge: 2, childMaxAge: 12 }))}
                className="text-[10px] font-medium text-dashboard-primary hover:underline cursor-pointer"
              >
                Reset to 2 / 12
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Infant up to (yrs)</span>
              <Input
                type="number"
                min={BAND_LIMITS.infantMaxAge.min} max={BAND_LIMITS.infantMaxAge.max}
                value={form.infantMaxAge}
                onChange={(e) => setBand("infantMaxAge", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Child up to (yrs)</span>
              <Input
                type="number"
                min={BAND_LIMITS.childMaxAge.min} max={BAND_LIMITS.childMaxAge.max}
                value={form.childMaxAge}
                onChange={(e) => setBand("childMaxAge", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
          </div>
          <p className="text-[11px] text-dashboard-base-content/55">{ageBandsLine(bands)}</p>
          <p className="text-[10px] text-dashboard-base-content/45">
            Defaults are the industry ones. Hotels don&apos;t all agree — many treat
            under-5s as infants and charge a child rate above that — so set these to
            what the stays on this trip actually use. Beds, mattresses and the
            per-person price all follow the band, not the box.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(["adults", "children", "infants"] as const).map((key) => (
            <label key={key} className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60 capitalize">{key}</span>
              <Input
                type="number" min={0}
                value={form[key]}
                onChange={(e) => {
                  const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                  setForm((f) => ({
                    ...f,
                    [key]: n,
                    // Ages are index-aligned with their count, so they resize
                    // with it rather than drifting out of sync.
                    ...(key === "children" ? { childrenAges: resizeAges(f.childrenAges, n) } : {}),
                    ...(key === "infants" ? { infantAges: resizeAges(f.infantAges, n) } : {}),
                  }));
                }}
                className="h-9 text-sm"
              />
              <span className="block text-[10px] text-dashboard-base-content/40">
                {key === "adults" ? `${bands.childMaxAge + 1}+ yrs`
                  : key === "children" ? `${bands.infantMaxAge + 1}–${bands.childMaxAge} yrs`
                    : `0–${bands.infantMaxAge} yrs`}
              </span>
            </label>
          ))}
        </div>

        {(form.children > 0 || form.infants > 0) && (
          <div className="space-y-2 pt-1">
            {form.children > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-dashboard-base-content/60 flex items-center gap-1">
                  <Baby size={11} /> Children&apos;s ages <span className="text-red-500">*</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {form.childrenAges.map((age, i) => (
                    <AgeInput
                      key={i}
                      age={age}
                      label={`Child ${i + 1} age`}
                      expected="child"
                      bands={bands}
                      onChange={(v) => setForm((f) => ({
                        ...f,
                        childrenAges: f.childrenAges.map((a, idx) => (idx === i ? v : a)),
                      }))}
                    />
                  ))}
                </div>
              </div>
            )}
            {form.infants > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-dashboard-base-content/60">
                  Infants&apos; ages <span className="text-red-500">*</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {form.infantAges.map((age, i) => (
                    <AgeInput
                      key={i}
                      age={age}
                      label={`Infant ${i + 1} age`}
                      expected="infant"
                      bands={bands}
                      onChange={(v) => setForm((f) => ({
                        ...f,
                        infantAges: f.infantAges.map((a, idx) => (idx === i ? v : a)),
                      }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Said here, where the boxes are, rather than only in the toast
                the exec gets after clicking Mark Ready and being turned away. */}
            {missingAges.length > 0 && (
              <p className="text-[11px] text-dashboard-warning">
                {missingAges.join(", ")} still {missingAges.length === 1 ? "needs an age" : "need ages"} — rooms,
                mattresses and the per-person price are worked out from the age, so this
                can&apos;t go to review without them.
              </p>
            )}

            {/* An age outside its box's band is not an error and never blocks:
                the price already follows the age. But the itinerary still reads
                "2 Children", so the difference has to be visible somewhere or
                it looks like the rooms were built wrong. */}
            {mismatches.length > 0 && (
              <div className="rounded-[10px] border border-dashboard-warning/40 bg-dashboard-warning/5 p-2.5 space-y-1">
                {mismatches.map((line) => (
                  <p key={line} className="text-[11px] text-dashboard-base-content/75">{line}</p>
                ))}
                <p className="text-[10px] text-dashboard-base-content/50">
                  Priced correctly either way — move them to the right box if the
                  itinerary should read that way too.
                </p>
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] text-dashboard-base-content/45">
          Priced as <span className="font-medium text-dashboard-base-content/70">{pricedPartyLine(form)}</span> —
          rooms, mattresses and every price are worked out from this.
        </p>
      </Block>

      <Block icon={IndianRupee} title="Package price">
        <div className="rounded-[10px] border border-dashboard-base-300 p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-dashboard-base-content/60">Works out to</span>
            <span className="text-sm font-bold tabular-nums">
              ₹{computed.perPerson.toLocaleString("en-IN")}
              <span className="text-[11px] font-normal text-dashboard-base-content/50"> / person</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-dashboard-base-content/60">Quoting</span>
            <span className={cn(
              "text-sm font-bold tabular-nums",
              !form.pricePerPerson && "text-dashboard-base-content/35",
            )}>
              {form.pricePerPerson
                ? `₹${Number(form.pricePerPerson).toLocaleString("en-IN")}`
                : "not set"}
            </span>
          </div>
          {onApplyPrice && computed.perPerson > 0 && String(computed.perPerson) !== form.pricePerPerson && (
            <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={onApplyPrice}>
              Quote ₹{computed.perPerson.toLocaleString("en-IN")} per person
            </Button>
          )}
        </div>
        <p className="text-[11px] text-dashboard-base-content/45">
          This is the figure the client sees and the one saved with the package —
          set it before sending, or costing review has nothing to check.
        </p>
      </Block>
    </div>
  );
}
