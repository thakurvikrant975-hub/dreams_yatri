"use client";

import {
  Calendar, Hotel, Car, Utensils, CheckCircle, XCircle,
  IndianRupee, Users, MapPin, Info, LogIn, LogOut,
  Plane, TrainFront, Sparkles, Phone, Mail,
  Coffee, Soup, UtensilsCrossed,
} from "lucide-react";
import { ItineraryMap } from "./ItineraryMap";

/** "1 Room | 2 Adults, 1 Child" — computed against room capacity so it
 * always reflects the query's actual traveller count, not stale text. */
function occupancyText(capacity: number | null, adults: number, children: number): string {
  const totalPax = adults + children;
  const rooms = capacity && capacity > 0 ? Math.max(1, Math.ceil(totalPax / capacity)) : 1;
  return `${rooms} Room${rooms !== 1 ? "s" : ""} | ${adults} Adult${adults !== 1 ? "s" : ""}` +
    (children > 0 ? `, ${children} Child${children !== 1 ? "ren" : ""}` : "");
} 

/** Parses free-text meal-plan strings ("MAP - Breakfast & Dinner") into a
 * clean "Breakfast & Dinner included" summary line. */
function mealIncludedText(planText: string): string | null { 
  if (!planText) return null;
  const lower = planText.toLowerCase();
  const found: string[] = [];
  if (lower.includes("breakfast")) found.push("Breakfast");
  if (lower.includes("lunch")) found.push("Lunch");
  if (lower.includes("dinner")) found.push("Dinner");
  if (found.length === 0) return null;
  const joined = found.length <= 2
    ? found.join(" & ")
    : `${found.slice(0, -1).join(", ")} & ${found[found.length - 1]}`;
  return `${joined} included`;
}
import DyLogo from "@/app/components/ui/DyLogo";
import type { DayItinerary, ActivityInput, StopInput } from "../action";

export interface PreviewData {
  title: string;
  description: string;
  coverImage: string;
  destination: string;
  startingPoint: string;
  totalDays: number;
  totalNights: number;
  travelDate: string;
  adults: number;  
  children: number;
  infants: number;
  pricePerPerson: string;
  totalPrice: string;
  currency: string;
  inclusions: string[];   
  exclusions: string[];
  termsNotes: string;
  flightsIncluded: boolean;
  flightNotes: string;
  flightFrom: string;
  flightTo: string;
  trainIncluded: boolean;
  trainNotes: string;
  trainFrom: string;
  trainTo: string;
  stops: StopInput[];
  itineraries: DayItinerary[];
  execName: string;
  execEmail: string;
  execDesignation: string;
}

function Kicker({ label }: { label: string }) {
  return (
    <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-[10px] font-bold tracking-widest uppercase">
      {label}
    </span>
  );
}

function ActivityRow({ activity }: { activity: ActivityInput }) {
  if (!activity.title.trim()) return null;
  const gallery = activity.photos.length > 0 ? activity.photos : (activity.photo ? [activity.photo] : []);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="flex items-center justify-center size-5 rounded-full bg-primary-100 text-primary-600 shrink-0 mt-0.5">
          <Sparkles size={11} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-neutral-800">{activity.title}</p>
          {activity.description && (
            <p className="text-xs text-neutral-500 mt-0.5">{activity.description}</p>
          )}
        </div>
      </div>
      {gallery.length > 0 && (
        <div className="ml-7 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary-600">Glimpses of the experience</p>
          <div className="grid grid-cols-3 gap-1.5">
            {gallery.slice(0, 3).map((src, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */}
                <img src={src} alt={activity.photoLabels[i] || activity.title} className="w-full h-30 object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/10 to-transparent px-1.5 py-1 pt-3">
                  <p className="text-[9px] text-white font-medium truncate">{activity.photoLabels[i] || activity.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MEAL_CHIPS = [
  { key: "breakfast", label: "Breakfast", icon: Coffee },
  { key: "lunch", label: "Lunch", icon: Soup },
  { key: "dinner", label: "Dinner", icon: UtensilsCrossed },
] as const;

/** Only shows meals actually included — an excluded meal (e.g. no breakfast
 * on this plan) is simply left out, not shown crossed-out/disabled. */
function MealsRow({ meals }: { meals: string[] }) {
  const included = MEAL_CHIPS.filter(({ key }) => meals.some((m) => m.toLowerCase().includes(key)));
  const extras = meals.filter((m) => !MEAL_CHIPS.some((c) => m.toLowerCase().includes(c.key)));
  if (included.length === 0 && extras.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {included.length > 0 && (
        <div className="flex items-stretch gap-1.5">
          {included.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="flex-1 flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium bg-emerald-50/60 border-emerald-200 text-neutral-700"
            >
              <span className="flex items-center gap-1">
                <Icon size={12} className="text-emerald-600" />
                {label}
              </span>
              <CheckCircle size={12} className="text-emerald-600 shrink-0" />
            </div>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <p className="text-[10px] text-neutral-500">+ {extras.join(", ")}</p>
      )}
    </div>
  );
}

/** Compact "Day | Hotel | Meals | Cab" grid so the pattern across the whole
 * trip is visible at a glance, ahead of the detailed per-day cards below. */
function DaySummaryTable({ itineraries }: { itineraries: DayItinerary[] }) {
  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-neutral-50 text-neutral-500 uppercase tracking-wide text-[9px]">
            <th className="text-left px-3 py-2 font-semibold">Day</th>
            <th className="text-left px-3 py-2 font-semibold">Hotel</th>
            <th className="text-left px-3 py-2 font-semibold">Meals</th>
            <th className="text-left px-3 py-2 font-semibold">Cab</th>
          </tr>
        </thead>
        <tbody>
          {itineraries.map((d) => (
            <tr key={d.day} className="border-t border-neutral-100">
              <td className="px-3 py-2 font-semibold text-neutral-700 whitespace-nowrap">Day {d.day}</td>
              <td className="px-3 py-2 text-neutral-600">{d.accommodation || "—"}</td>
              <td className="px-3 py-2 text-neutral-600">{d.meals.length > 0 ? d.meals.join(", ") : "—"}</td>
              <td className="px-3 py-2 text-neutral-600">{d.transport || d.transportVehicleType || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayCardPreview({ day, adults, childCount }: { day: DayItinerary; adults: number; childCount: number }) {
  const activities = day.activities.filter((a) => a.title.trim());
  const hasHotel = day.accommodation || day.hotelCheckIn || day.hotelCheckOut || day.hotelMealPlan;
  const mealText = mealIncludedText(day.hotelMealPlan);
  const hasPhotos = day.accommodationPhoto || day.accommodationRoomPhotos.length > 0;

  return (
    <div
      className="rounded-xl border border-neutral-200 overflow-hidden bg-white"
      style={{ breakInside: "avoid" }}
    >
      {/* Day header — pill + title */}
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-neutral-100">
        <span className="shrink-0 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          Day {day.day}
        </span>
        <p className="text-sm font-bold text-neutral-800 truncate">
          {day.title || `Day ${day.day}`}
        </p>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        {day.description && (
          <p className="text-xs text-neutral-600 leading-relaxed">{day.description}</p>
        )}

        {/* Hotel info */}
        {hasHotel && (
          <div className="rounded-lg bg-primary-50/60 border border-primary-100 p-2.5">
            <div className="flex gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Hotel size={12} className="text-primary-600 shrink-0" />
                  <p className="text-xs font-semibold text-neutral-800">
                    {day.accommodation || "Hotel (TBD)"}
                  </p>
                </div>

                {day.accommodationLocation && (
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <MapPin size={10} className="text-neutral-400 shrink-0" /> {day.accommodationLocation}
                  </p>
                )}

                <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                  <Users size={10} className="text-neutral-400 shrink-0" />
                  {occupancyText(day.accommodationRoomCapacity, adults, childCount)}
                </p>

                {(day.hotelCheckIn || day.hotelCheckOut) && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <LogIn size={12} className="text-primary-500" />
                      <span className="text-[8px] text-neutral-400 font-medium uppercase tracking-wide">Check-in</span>
                      <span className="text-[11px] font-semibold text-neutral-700">{day.hotelCheckIn || "—"}</span>
                    </div>
                    <div className="flex-1 border-t border-dashed border-neutral-300 self-center" />
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <LogOut size={12} className="text-primary-500" />
                      <span className="text-[8px] text-neutral-400 font-medium uppercase tracking-wide">Check-out</span>
                      <span className="text-[11px] font-semibold text-neutral-700">{day.hotelCheckOut || "—"}</span>
                    </div>
                  </div>
                )}

                {day.accommodationRoomSpecs && (
                  <p className="text-[11px] text-neutral-500">({day.accommodationRoomSpecs})</p>
                )}

                {mealText && (
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <Utensils size={10} className="text-primary-400 shrink-0" /> {mealText}
                  </p>
                )}
              </div>

              {hasPhotos && (
                <div className="w-40 shrink-0 space-y-1">
                  {day.accommodationPhoto && (
                    /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                    <img src={day.accommodationPhoto} alt="Hotel" className="w-40 h-24 rounded-lg object-cover" />
                  )}
                  {day.accommodationRoomPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-1">
                      {day.accommodationRoomPhotos.slice(0, 2).map((src, i) => (
                        /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                        <img key={i} src={src} alt={`Room ${i + 1}`} className="h-14 w-full rounded-md object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transport */}
        {(day.transport || day.transportPickup || day.transportDrop) && (
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Car size={12} className="text-primary-600 shrink-0" />
              <p className="text-xs font-semibold text-neutral-800">Transport</p>
              {(day.transportDistanceKm || (day.transportPickup && day.transportDrop)) && (
                <span className="text-[11px] text-neutral-400 truncate">
                  · {[
                    day.transportDistanceKm ? `${day.transportDistanceKm} km` : null,
                    day.transportPickup && day.transportDrop ? `${day.transportPickup} → ${day.transportDrop}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                {day.transport && (
                  <p className="text-sm font-semibold text-neutral-800">
                    {day.transport}
                    {day.transportVehicleType && <span className="font-normal text-neutral-500"> · {day.transportVehicleType}</span>}
                    {day.transportSeats && <span className="font-normal text-neutral-500"> · {day.transportSeats} Seats</span>}
                  </p>
                )}

                {(day.transportPickup || day.transportDrop) && (
                  <div className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <MapPin size={13} className="text-neutral-400 shrink-0" />
                      <span className="w-0.5 flex-1 min-h-6 bg-primary-200 my-1" />
                      <MapPin size={13} className="text-neutral-400 shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between text-xs py-0.5">
                      <p className="text-neutral-500">
                        Pickup Point: <span className="font-semibold text-neutral-800">{day.transportPickup || "—"}</span>
                      </p>
                      {day.transportDistanceKm && (
                        <p className="text-[11px] text-neutral-400 py-1">{day.transportDistanceKm} km</p>
                      )}
                      <p className="text-neutral-500">
                        Drop Point: <span className="font-semibold text-neutral-800">{day.transportDrop || "—"}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {day.transportPhoto && (
                <div className="relative rounded-lg overflow-hidden w-52 h-36 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */}
                  <img src={day.transportPhoto} alt="" className="w-52 h-36 object-cover" />
                  {day.transport && (
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/20 to-transparent px-2 py-1.5 pt-6">
                      <p className="text-xs text-white font-medium truncate">{day.transport}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meals */}
        {day.meals.length > 0 && <MealsRow meals={day.meals} />}

        {/* Activities */}
        {activities.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-neutral-100">
            {activities.map((a, i) => <ActivityRow key={i} activity={a} />)}
          </div>
        )}

        {day.notes && (
          <p className="text-[11px] text-neutral-400 italic">{day.notes}</p>
        )}
      </div>
    </div>
  );
}

// Global print rules — scoped so only the .itinerary-print-area prints,
// hiding the rest of the builder chrome (dashboard header, edit tabs, etc).
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    .itinerary-print-area, .itinerary-print-area * { visibility: visible; }
    .itinerary-print-area { position: absolute; inset: 0; width: 210mm; box-shadow: none !important; margin: 0 !important; }
    .no-print { display: none !important; }
    @page { size: A4; margin: 0; }
  }
`;

export function ItineraryDocument({ form }: { form: PreviewData }) {
  const travelDateStr = form.travelDate
    ? new Date(form.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "TBD";

  const paxLine =
    `${form.adults} Adult${form.adults !== 1 ? "s" : ""}` +
    (form.children ? `, ${form.children} Child${form.children !== 1 ? "ren" : ""}` : "") +
    (form.infants ? `, ${form.infants} Infant${form.infants !== 1 ? "s" : ""}` : "");

  const priceStr = form.totalPrice
    ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}`
    : "To be confirmed";

  return (
    <div>
      <style>{PRINT_STYLES}</style>

      {/* ── A4 page ─────────────────────────────────────────────────────────── */}
      <div
        className="itinerary-print-area mx-auto bg-white rounded-lg shadow-xl"
        style={{ width: "210mm", minHeight: "297mm", padding: "15mm" }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="space-y-4 pb-5 border-b-4 border-primary-500">
          <div className="flex items-center justify-between">
            <DyLogo className="h-8 text-primary-600" />
            <div className="text-right text-[11px] text-neutral-500 space-y-0.5">
              <p className="flex items-center justify-end gap-1"><Phone size={10} className="text-primary-500" /> +91 98765 43210</p>
              <p className="flex items-center justify-end gap-1"><Mail size={10} className="text-primary-500" /> hello@dreamsyatri.com</p>
            </div>
          </div>

          {form.coverImage && (
            <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-neutral-100 ring-1 ring-primary-100 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external/catalog URL, not a static app asset */}
              <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div>
            <h1 className="text-3xl font-bold text-neutral-900 mt-2">{form.title || "Untitled Package"}</h1>
            <p className="text-sm text-primary-600 font-medium flex items-center gap-1 mt-1.5">
              <MapPin size={13} /> {form.startingPoint || "—"} → {form.destination || "—"}
            </p>
            {form.stops.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {form.stops.map((s, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-full">
                      {s.name || "—"} · {s.nights}N
                    </span>
                    {i < form.stops.length - 1 && <span className="text-neutral-300">→</span>}
                  </span>
                ))}
              </div>
            )}
            {form.description && (
              <p className="text-sm text-neutral-600 leading-relaxed mt-2.5">{form.description}</p>
            )}
          </div>
        </header>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <main className="space-y-6 pt-6">
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-3">
              <p className="text-primary-600/70 flex items-center gap-1 mb-1 font-medium"><Calendar size={11} /> Travel Date</p>
              <p className="font-bold text-neutral-800">{travelDateStr}</p>
            </div>
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-3">
              <p className="text-primary-600/70 mb-1 font-medium">Duration</p>
              <p className="font-bold text-neutral-800">{form.totalDays}D / {form.totalNights}N</p>
            </div>
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-3">
              <p className="text-primary-600/70 flex items-center gap-1 mb-1 font-medium"><Users size={11} /> Travellers</p>
              <p className="font-bold text-neutral-800">{paxLine}</p>
            </div>
            <div className="rounded-xl bg-primary-500 p-3">
              <p className="text-white/80 flex items-center gap-1 mb-1 font-medium"><IndianRupee size={11} /> Total Price</p>
              <p className="font-bold text-white">{priceStr}</p>
            </div>
          </div>

          {form.execName && (
            <div className="rounded-xl border border-primary-100 bg-white p-3 flex items-center justify-between gap-3 text-xs flex-wrap">
              <div>
                <p className="text-[10px] text-primary-600/70 font-medium uppercase tracking-wide mb-0.5">Your Travel Manager</p>
                <p className="font-bold text-neutral-800">
                  {form.execName}
                  {form.execDesignation && <span className="font-normal text-neutral-500"> · {form.execDesignation}</span>}
                </p>
              </div>
              {form.execEmail && (
                <a href={`mailto:${form.execEmail}`} className="flex items-center gap-1 text-primary-600 hover:underline shrink-0">
                  <Mail size={11} /> {form.execEmail}
                </a>
              )}
            </div>
          )}

          {/* Flights & Train inclusion */}
          {(form.flightsIncluded || form.trainIncluded) && (
            <div className="flex flex-wrap gap-2">
              {form.flightsIncluded && (
                <div className="flex items-center gap-1.5 rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs text-neutral-700">
                  <Plane size={12} className="text-primary-600" />
                  <span className="font-semibold">Flights included</span>
                  {form.flightNotes && <span className="text-neutral-500">· {form.flightNotes}</span>}
                </div>
              )}
              {form.trainIncluded && (
                <div className="flex items-center gap-1.5 rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs text-neutral-700">
                  <TrainFront size={12} className="text-primary-600" />
                  <span className="font-semibold">Train included</span>
                  {form.trainNotes && <span className="text-neutral-500">· {form.trainNotes}</span>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Kicker label="Day-wise Summary" />
            <DaySummaryTable itineraries={form.itineraries} />
          </div>

          <div className="space-y-3">
            <Kicker label="Itinerary" />
            <div className="space-y-3">
              {form.itineraries.map((d) => (
                <DayCardPreview key={d.day} day={d} adults={form.adults} childCount={form.children} />
              ))}
            </div>
          </div>

          <ItineraryMap
            startingPoint={form.startingPoint}
            stops={form.stops}
            itineraries={form.itineraries}
            flightsIncluded={form.flightsIncluded}
            flightFrom={form.flightFrom}
            flightTo={form.flightTo}
            trainIncluded={form.trainIncluded}
            trainFrom={form.trainFrom}
            trainTo={form.trainTo}
          />

          <div className="grid gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-2.5 flex items-center gap-1.5">
                <span className="flex items-center justify-center size-5 rounded-full bg-emerald-100"><CheckCircle size={12} className="text-emerald-600" /></span>
                Inclusions
              </h3>
              <ul className="space-y-1.5 text-xs text-neutral-600">
                {form.inclusions.map((i) => <li key={i}>• {i}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-primary-700 mb-2.5 flex items-center gap-1.5">
                <span className="flex items-center justify-center size-5 rounded-full bg-primary-100"><XCircle size={12} className="text-primary-600" /></span>
                Exclusions
              </h3>
              <ul className="space-y-1.5 text-xs text-neutral-600">
                {form.exclusions.map((i) => <li key={i}>• {i}</li>)}
              </ul>
            </div>
          </div>

          {form.termsNotes && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2.5 flex items-center gap-1.5">
                <Info size={13} className="text-primary-500" /> Terms & Notes
              </h3>
              <p className="text-xs text-neutral-600 whitespace-pre-line leading-relaxed">{form.termsNotes}</p>
            </div>
          )}
        </main>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="mt-8 rounded-xl bg-primary-50 py-5 text-center space-y-1.5">
          <DyLogo className="h-5 text-primary-600 mx-auto" />
          <p className="text-[11px] text-neutral-600 font-medium">
            Thank you for choosing Dreams Yatri — happy travels!
          </p>
          <p className="text-[10px] text-neutral-400">
            This is a custom itinerary and is subject to availability at the time of booking.
          </p>
        </footer>
      </div>
    </div>
  );
}
