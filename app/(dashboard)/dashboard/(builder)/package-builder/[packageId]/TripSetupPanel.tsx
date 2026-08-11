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

import { CalendarDays, Users, MapPin, Percent, Baby, IndianRupee } from "./builder-icons";
import { cn } from "@/app/lib/utils";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { useBuilder, type PackageForm } from "./builder-context";
import { RouteStopsEditor } from "./RouteStopsEditor";
import { recalcFromStops } from "./day-mutations";

/** Keeps a children/infants ages array in sync with a changed traveller count —
 * grows with 0-filled slots, shrinks by dropping the trailing ones. */
function resizeAges(ages: number[], count: number): number[] {
  if (count <= ages.length) return ages.slice(0, count);
  return [...ages, ...Array(count - ages.length).fill(0)];
}

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

export function TripSetupPanel({ computed, onApplyPrice }: {
  /** What the trip currently costs, all margins and tax applied. */
  computed: { finalPrice: number; perPerson: number };
  /** Writes perPerson into the package. Explicit rather than automatic: the
   * exec is allowed to quote a number that isn't the computed one, and
   * overwriting a deliberate figure every time a hotel changed would be
   * worse than asking. */
  onApplyPrice: () => void;
}) {
  const { form, setForm, canEdit } = useBuilder();

  function field<K extends keyof PackageForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value as PackageForm[K] }));
  }

  return (
    <div className={canEdit ? "space-y-4" : "space-y-4 pointer-events-none opacity-60"}>
      <Block icon={CalendarDays} title="Trip">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Travel date</span>
            <Input type="date" value={form.travelDate} onChange={field("travelDate")} className="h-9 text-sm" />
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
        />
        <p className="text-[11px] text-dashboard-base-content/45">
          Each day&apos;s hotel and cab search defaults to the stop it falls under, so
          getting these right saves typing a city on every day.
        </p>
      </Block>

      <Block icon={Users} title="Travellers">
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
            </label>
          ))}
        </div>

        {(form.children > 0 || form.infants > 0) && (
          <div className="space-y-2 pt-1">
            {form.children > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-dashboard-base-content/60 flex items-center gap-1">
                  <Baby size={11} /> Children&apos;s ages
                </span>
                <div className="flex flex-wrap gap-2">
                  {form.childrenAges.map((age, i) => (
                    <Input
                      key={i}
                      type="number" min={0} max={17}
                      value={age}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setForm((f) => ({
                          ...f,
                          childrenAges: f.childrenAges.map((a, idx) => (idx === i ? v : a)),
                        }));
                      }}
                      className="h-8 w-14 text-sm"
                      aria-label={`Child ${i + 1} age`}
                    />
                  ))}
                </div>
              </div>
            )}
            {form.infants > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-dashboard-base-content/60">Infants&apos; ages</span>
                <div className="flex flex-wrap gap-2">
                  {form.infantAges.map((age, i) => (
                    <Input
                      key={i}
                      type="number" min={0} max={2}
                      value={age}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setForm((f) => ({
                          ...f,
                          infantAges: f.infantAges.map((a, idx) => (idx === i ? v : a)),
                        }));
                      }}
                      className="h-8 w-14 text-sm"
                      aria-label={`Infant ${i + 1} age`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] text-dashboard-base-content/45">
          Rooms, mattresses and every price are worked out from this.
        </p>
      </Block>

      <Block icon={Percent} title="Margin & tax">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Margin %</span>
            <Input
              type="number" min={0}
              value={form.marginPercentage}
              onChange={field("marginPercentage")}
              className="h-9 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">GST %</span>
            <Input
              type="number" min={0}
              value={form.gstPercentage}
              onChange={field("gstPercentage")}
              className="h-9 text-sm"
            />
          </label>
        </div>
        <p className="text-[11px] text-dashboard-base-content/45">
          Applied on top of the hotel, cab, ticket and add-on costs.
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
          {computed.perPerson > 0 && String(computed.perPerson) !== form.pricePerPerson && (
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
