"use client";

import {
  Calendar, Hotel, Car, Utensils, CheckCircle, XCircle,
  IndianRupee, Users, MapPin, Info,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { Badge } from "../../../components/ui/badge";
import type { DayItinerary } from "../action";

interface PreviewData {
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
  itineraries: DayItinerary[];
}

export function PackagePreviewDialog({
  open, onOpenChange, form,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: PreviewData;
}) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-normal border-dashboard-base-300 text-dashboard-base-content/50">
              Preview — not sent to client
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-dashboard-base-content">{form.title || "Untitled Package"}</h2>
            <p className="text-sm text-dashboard-base-content/60 flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {form.startingPoint || "—"} → {form.destination || "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-dashboard-base-content/50">Day-wise Itinerary</h3>
            {form.itineraries.map((d) => (
              <div key={d.day} className="rounded-lg border border-dashboard-base-300 p-3">
                <p className="text-sm font-semibold text-dashboard-base-content">
                  Day {d.day}{d.title ? `: ${d.title}` : ""}
                </p>
                {d.description && <p className="text-xs text-dashboard-base-content/60 mt-1">{d.description}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-dashboard-base-content/70">
                  {d.accommodation && <span className="flex items-center gap-1"><Hotel size={11} /> {d.accommodation}</span>}
                  {d.transport && <span className="flex items-center gap-1"><Car size={11} /> {d.transport}</span>}
                  {d.meals.length > 0 && <span className="flex items-center gap-1"><Utensils size={11} /> {d.meals.join(", ")}</span>}
                </div>
              </div>
            ))}
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
      </DialogContent>
    </Dialog>
  );
}
