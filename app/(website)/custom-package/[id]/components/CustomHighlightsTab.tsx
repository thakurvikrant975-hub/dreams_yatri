import { CheckCircle, XCircle, Calendar, Milestone } from "lucide-react";
import { Text } from "@/app/components/ui/Typography";
import { deriveTransportFields } from "@/app/lib/deriveTicketTransport";
import { ItineraryMap } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[queryId]/ItineraryMap";
import {
  DaySummaryTable, TicketsSection,
  type PreviewData,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/[queryId]/ItineraryDocument";

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

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary-500" />
          <Text size="sm" weight="bold" intent="primary" className="font-heading">Day-wise Summary</Text>
        </div>
        <DaySummaryTable itineraries={form.itineraries} />
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
