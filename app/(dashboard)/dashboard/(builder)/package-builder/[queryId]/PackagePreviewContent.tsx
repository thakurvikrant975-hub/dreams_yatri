"use client";

import {
  Calendar, Hotel, Car, Utensils, CheckCircle, XCircle,
  IndianRupee, Users, MapPin, Info, Eye, LogIn, LogOut,
  Plane, TrainFront, Sparkles,
} from "lucide-react";
import { Badge } from "@/app/(dashboard)/dashboard/(main)/components/ui/badge";
import type { DayItinerary, ActivityInput } from "../action";

export interface PreviewData {
  title: string;
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
  itineraries: DayItinerary[];
}

function ActivityRow({ activity }: { activity: ActivityInput }) {
  if (!activity.title.trim()) return null;
  return (
    <div className="flex gap-2">
      <Sparkles size={12} className="text-dashboard-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-dashboard-base-content">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-dashboard-base-content/60 mt-0.5">{activity.description}</p>
        )}
      </div>
    </div>
  );
}

function DayCardPreview({ day }: { day: DayItinerary }) {
  const activities = day.activities.filter((a) => a.title.trim());
  const hasHotel = day.accommodation || day.hotelCheckIn || day.hotelCheckOut || day.hotelMealPlan;

  return (
    <div className="rounded-xl border border-dashboard-base-300 overflow-hidden">
      {/* Day header — pill + title */}
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200/40">
        <span className="shrink-0 bg-dashboard-primary text-dashboard-primary-content text-xs font-semibold px-2.5 py-1 rounded-full">
          Day {day.day}
        </span>
        <p className="text-sm font-semibold text-dashboard-base-content truncate">
          {day.title || `Day ${day.day}`}
        </p>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        {day.description && (
          <p className="text-xs text-dashboard-base-content/70 leading-relaxed">{day.description}</p>
        )}

        {/* Hotel info */}
        {hasHotel && (
          <div className="rounded-lg bg-dashboard-base-200/40 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Hotel size={12} className="text-dashboard-primary shrink-0" />
              <p className="text-xs font-semibold text-dashboard-base-content">
                {day.accommodation || "Hotel (TBD)"}
              </p>
            </div>
            {(day.hotelCheckIn || day.hotelCheckOut) && (
              <div className="flex items-center gap-4 text-[11px] text-dashboard-base-content/60 pl-4.5">
                {day.hotelCheckIn && (
                  <span className="flex items-center gap-1"><LogIn size={10} /> Check-in {day.hotelCheckIn}</span>
                )}
                {day.hotelCheckOut && (
                  <span className="flex items-center gap-1"><LogOut size={10} /> Check-out {day.hotelCheckOut}</span>
                )}
              </div>
            )}
            {day.hotelMealPlan && (
              <p className="text-[11px] text-dashboard-base-content/60 pl-4.5">{day.hotelMealPlan}</p>
            )}
          </div>
        )}

        {/* Transport + meals */}
        {(day.transport || day.meals.length > 0) && (
          <div className="flex flex-wrap gap-3 text-xs text-dashboard-base-content/70">
            {day.transport && <span className="flex items-center gap-1"><Car size={11} /> {day.transport}</span>}
            {day.meals.length > 0 && <span className="flex items-center gap-1"><Utensils size={11} /> {day.meals.join(", ")}</span>}
          </div>
        )}

        {/* Activities */}
        {activities.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-dashboard-base-300">
            {activities.map((a, i) => <ActivityRow key={i} activity={a} />)}
          </div>
        )}

        {day.notes && (
          <p className="text-[11px] text-dashboard-base-content/50 italic">{day.notes}</p>
        )}
      </div>
    </div>
  );
}

export function PackagePreviewContent({ form }: { form: PreviewData }) {
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-[10px] font-normal gap-1 border-dashboard-base-300 text-dashboard-base-content/50">
          <Eye size={10} /> Live Preview — not sent to client
        </Badge>
      </div>

      <div>
        <h2 className="text-lg font-bold text-dashboard-base-content">{form.title || "Untitled Package"}</h2>
        <p className="text-sm text-dashboard-base-content/60 flex items-center gap-1 mt-0.5">
          <MapPin size={12} /> {form.startingPoint || "—"} → {form.destination || "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-dashboard-base-300 p-2.5">
          <p className="text-dashboard-base-content/50 flex items-center gap-1 mb-1"><Calendar size={11} /> Travel Date</p>
          <p className="font-semibold text-dashboard-base-content">{travelDateStr}</p>
        </div>
        <div className="rounded-lg border border-dashboard-base-300 p-2.5">
          <p className="text-dashboard-base-content/50 mb-1">Duration</p>
          <p className="font-semibold text-dashboard-base-content">{form.totalDays}D / {form.totalNights}N</p>
        </div>
        <div className="rounded-lg border border-dashboard-base-300 p-2.5">
          <p className="text-dashboard-base-content/50 flex items-center gap-1 mb-1"><Users size={11} /> Travellers</p>
          <p className="font-semibold text-dashboard-base-content">{paxLine}</p>
        </div>
        <div className="rounded-lg border border-dashboard-base-300 p-2.5">
          <p className="text-dashboard-base-content/50 flex items-center gap-1 mb-1"><IndianRupee size={11} /> Total Price</p>
          <p className="font-semibold text-dashboard-base-content">{priceStr}</p>
        </div>
      </div>

      {/* Flights & Train inclusion */}
      {(form.flightsIncluded || form.trainIncluded) && (
        <div className="flex flex-wrap gap-2">
          {form.flightsIncluded && (
            <div className="flex items-center gap-1.5 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 px-2.5 py-1.5 text-xs text-dashboard-base-content">
              <Plane size={12} className="text-dashboard-primary" />
              <span className="font-medium">Flights included</span>
              {form.flightNotes && <span className="text-dashboard-base-content/50">· {form.flightNotes}</span>}
            </div>
          )}
          {form.trainIncluded && (
            <div className="flex items-center gap-1.5 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 px-2.5 py-1.5 text-xs text-dashboard-base-content">
              <TrainFront size={12} className="text-dashboard-primary" />
              <span className="font-medium">Train included</span>
              {form.trainNotes && <span className="text-dashboard-base-content/50">· {form.trainNotes}</span>}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-dashboard-base-content/50">Day-wise Itinerary</h3>
        {form.itineraries.map((d) => <DayCardPreview key={d.day} day={d} />)}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-dashboard-success mb-2 flex items-center gap-1">
            <CheckCircle size={12} /> Inclusions
          </h3>
          <ul className="space-y-1 text-xs text-dashboard-base-content/70">
            {form.inclusions.map((i) => <li key={i}>• {i}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-dashboard-error mb-2 flex items-center gap-1">
            <XCircle size={12} /> Exclusions
          </h3>
          <ul className="space-y-1 text-xs text-dashboard-base-content/70">
            {form.exclusions.map((i) => <li key={i}>• {i}</li>)}
          </ul>
        </div>
      </div>

      {form.termsNotes && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-dashboard-base-content/50 mb-2 flex items-center gap-1">
            <Info size={12} /> Terms & Notes
          </h3>
          <p className="text-xs text-dashboard-base-content/70 whitespace-pre-line">{form.termsNotes}</p>
        </div>
      )}
    </div>
  );
}
