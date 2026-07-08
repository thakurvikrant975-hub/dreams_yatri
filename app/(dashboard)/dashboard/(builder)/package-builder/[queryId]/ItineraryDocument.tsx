"use client";

import {
  Calendar, Hotel, Car, Utensils, CheckCircle, XCircle,
  IndianRupee, Users, MapPin, Info, LogIn, LogOut,
  Plane, TrainFront, Sparkles, Phone, Mail,
} from "lucide-react";
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
  trainIncluded: boolean;
  trainNotes: string;
  stops: StopInput[];
  itineraries: DayItinerary[];
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
  return (
    <div className="flex gap-2.5">
      {activity.photo ? (
        /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
        <img src={activity.photo} alt="" className="size-10 rounded-lg object-cover shrink-0" />
      ) : (
        <span className="flex items-center justify-center size-5 rounded-full bg-primary-100 text-primary-600 shrink-0 mt-0.5">
          <Sparkles size={11} />
        </span>
      )}
      <div>
        <p className="text-xs font-semibold text-neutral-800">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-neutral-500 mt-0.5">{activity.description}</p>
        )}
      </div>
    </div>
  );
}

function DayCardPreview({ day }: { day: DayItinerary }) {
  const activities = day.activities.filter((a) => a.title.trim());
  const hasHotel = day.accommodation || day.hotelCheckIn || day.hotelCheckOut || day.hotelMealPlan;

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
          <div className="rounded-lg bg-primary-50/60 border border-primary-100 p-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              {day.accommodationPhoto && (
                /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                <img src={day.accommodationPhoto} alt="" className="h-10 w-14 rounded-md object-cover shrink-0" />
              )}
              <div className="flex items-center gap-1.5">
                <Hotel size={12} className="text-primary-600 shrink-0" />
                <p className="text-xs font-semibold text-neutral-800">
                  {day.accommodation || "Hotel (TBD)"}
                </p>
              </div>
            </div>
            {(day.hotelCheckIn || day.hotelCheckOut) && (
              <div className="flex items-center gap-4 text-[11px] text-neutral-500 pl-4.5">
                {day.hotelCheckIn && (
                  <span className="flex items-center gap-1"><LogIn size={10} /> Check-in {day.hotelCheckIn}</span>
                )}
                {day.hotelCheckOut && (
                  <span className="flex items-center gap-1"><LogOut size={10} /> Check-out {day.hotelCheckOut}</span>
                )}
              </div>
            )}
            {day.hotelMealPlan && (
              <p className="text-[11px] text-neutral-500 pl-4.5">{day.hotelMealPlan}</p>
            )}
          </div>
        )}

        {/* Transport + meals */}
        {(day.transport || day.meals.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
            {day.transport && (
              <span className="flex items-center gap-1.5">
                {day.transportPhoto ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                  <img src={day.transportPhoto} alt="" className="h-6 w-9 rounded object-cover shrink-0" />
                ) : (
                  <Car size={11} className="text-primary-500" />
                )}
                {day.transport}
              </span>
            )}
            {day.meals.length > 0 && <span className="flex items-center gap-1"><Utensils size={11} className="text-primary-500" /> {day.meals.join(", ")}</span>}
          </div>
        )}

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
            <Kicker label="Itinerary" />
            <div className="space-y-3">
              {form.itineraries.map((d) => <DayCardPreview key={d.day} day={d} />)}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
