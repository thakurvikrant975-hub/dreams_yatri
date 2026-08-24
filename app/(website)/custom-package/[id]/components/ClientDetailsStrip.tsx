import { User, Calendar, Mail } from "lucide-react";
import { Text } from "@/app/components/ui/Typography";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import { parseCalendarDay, formatCalendarDayLong } from "@/app/lib/dates/calendar-day";

function refCode(queryId: string): string {
  return queryId.slice(-8).toUpperCase();
}

/** Compact "who this trip is for" strip below the hero — replaces the
 * catalog page's Send Enquiry sidebar slot, which doesn't apply here since
 * this itinerary is already built for one specific, named client. */
export function ClientDetailsStrip({ form }: { form: PreviewData }) {
  if (!form.clientName && !form.execName) return null;

  const paxLine = [
    `${form.adults} Adult${form.adults !== 1 ? "s" : ""}`,
    form.children > 0 ? `${form.children} Child${form.children !== 1 ? "ren" : ""}` : null,
    form.infants > 0 ? `${form.infants} Infant${form.infants !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-2 px-4 py-3 rounded-2xl bg-neutral-50 border border-neutral-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex items-center justify-center size-9 rounded-full bg-primary-100 text-primary-600 shrink-0">
          <User size={16} />
        </span>
        <div className="min-w-0">
          <Text size="sm" weight="semibold" intent="primary" className="font-heading truncate">
            Prepared for {form.clientName || "you"}
          </Text>
          <div className="flex items-center gap-2 flex-wrap">
            <Text size="xs" intent="secondary">{paxLine}</Text>
            {form.travelDate && (
              <>
                <span className="text-muted text-xs">·</span>
                <Text size="xs" intent="secondary" className="flex items-center gap-1">
                  <Calendar size={11} />
                  {formatCalendarDayLong(parseCalendarDay(form.travelDate))}
                </Text>
              </>
            )}
            {form.queryId && (
              <>
                <span className="text-muted text-xs">·</span>
                <Text size="xs" intent="muted">Ref: {refCode(form.queryId)}</Text>
              </>
            )}
          </div>
        </div>
      </div>

      {form.execName && (
        <div className="text-right shrink-0">
          <Text size="sm" weight="semibold" intent="primary" className="font-heading">
            {form.execName}
            {form.execDesignation && <span className="font-normal text-secondary"> · {form.execDesignation}</span>}
          </Text>
          {form.execEmail && (
            <a href={`mailto:${form.execEmail}`} className="flex items-center justify-end gap-1 text-primary-600 text-xs mt-0.5 hover:underline">
              <Mail size={11} /> {form.execEmail}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
