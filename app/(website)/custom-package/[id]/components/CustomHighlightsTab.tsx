import { CheckCircle, XCircle, Calendar, Milestone, Sparkles, IndianRupee, Info } from "lucide-react";
import { Text } from "@/app/components/ui/Typography";
import { deriveTransportFields } from "@/app/lib/deriveTicketTransport";
import { ItineraryMap } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryMap";
import {
  DaySummaryTable, TicketsSection,
  type PreviewData,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";

/** Trip-level overview content — description, inclusions/exclusions, the
 * day-wise summary table, ticket details, and the route map. Mirrors the
 * catalog page's Highlights tab role (non-day-specific trip content), 
 * reusing the exact same day-summary/ticket components the internal
 * PDF/preview document already uses so the meal-shift logic never drifts
 * between the two views. */
export function CustomHighlightsTab({ form }: { form: PreviewData }) {
  const transport = deriveTransportFields(form.tickets);

  return (
    <div className="flex flex-col gap-8">
      {form.description && (
        <Text size="sm" intent="secondary" className="leading-relaxed block">{form.description}</Text>
      )}
 
      {(form.inclusions.length > 0 || form.exclusions.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.inclusions.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <Text size="sm" weight="bold" intent="primary" className="font-heading mb-2 block">Inclusions</Text>
              <ul className="space-y-1.5">
                {form.inclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-success-600 shrink-0 mt-0.5" />
                    <Text size="sm" intent="secondary">{item}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {form.exclusions.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <Text size="sm" weight="bold" intent="primary" className="font-heading mb-2 block">Exclusions</Text>
              <ul className="space-y-1.5">
                {form.exclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle size={14} className="text-error-500 shrink-0 mt-0.5" />
                    <Text size="sm" intent="secondary">{item}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(form.termsConditions.length > 0 || form.paymentPolicy.length > 0 || form.amendmentPolicy.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.termsConditions.length > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-blue-600" />
                <Text size="sm" weight="bold" className="font-heading text-blue-700">Terms & Conditions</Text>
              </div>
              <ul className="space-y-1.5">
                {form.termsConditions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 size-1 rounded-full bg-blue-400 shrink-0" />
                    <Text size="sm" intent="secondary">{item}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {form.paymentPolicy.length > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <IndianRupee size={14} className="text-amber-600" />
                <Text size="sm" weight="bold" className="font-heading text-amber-700">Payment Policy</Text>
              </div>
              <ul className="space-y-1.5">
                {form.paymentPolicy.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 size-1 rounded-full bg-amber-400 shrink-0" />
                    <Text size="sm" intent="secondary">{item}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {form.amendmentPolicy.length > 0 && (
            <div className="rounded-2xl border border-purple-100 bg-purple-50/30 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-purple-600" />
                <Text size="sm" weight="bold" className="font-heading text-purple-700">Amendment Policy</Text>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {form.amendmentPolicy.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 size-1 rounded-full bg-purple-400 shrink-0" />
                    <Text size="sm" intent="secondary">{item}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {form.travelBenefits.length > 0 && (
        <div className="rounded-2xl border border-teal-100 bg-white p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} className="text-teal-600" />
            <Text size="xs" weight="bold" className="font-heading text-teal-700 uppercase tracking-wide">Why Book With Us</Text>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {form.travelBenefits.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1 rounded-full bg-teal-400 shrink-0" />
                <Text size="xs" intent="secondary">{item}</Text>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary-500" />
          <Text size="sm" weight="bold" intent="primary" className="font-heading">Day-wise Summary</Text>
        </div>
        <DaySummaryTable itineraries={form.itineraries} travelDate={form.travelDate} stops={form.stops} />
      </div>

      {form.tickets.length > 0 && <TicketsSection tickets={form.tickets} />}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Milestone size={16} className="text-primary-500" />
          <Text size="sm" weight="bold" intent="primary" className="font-heading">Route Map</Text>
        </div>
        <ItineraryMap
          startingPoint={form.startingPoint}
          stops={form.stops}
          flightsIncluded={transport.flightsIncluded}
          flightFrom={transport.flightFrom}
          flightTo={transport.flightTo}
          trainIncluded={transport.trainIncluded}
          trainFrom={transport.trainFrom}
          trainTo={transport.trainTo}
        />
      </div>
    </div>
  );
}