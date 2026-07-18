import { ArrowRight } from "lucide-react";
import Card from "@/app/components/ui/Card";
import { Text } from "@/app/components/ui/Typography";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[queryId]/ItineraryDocument";

/** Mirrors the catalog page's PricingCard chrome (Card, spacing, typography)
 * but with locked, total-only content — no per-adult/GST breakdown, no
 * "Book this package" quote flow. Just the frozen total and Pay Now. */
export function CustomPricingCard({ form }: { form: PreviewData }) {
  const totalPax = form.adults + form.children;
  const priceStr = form.totalPrice ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}` : "To be confirmed";
  const perPersonStr = form.pricePerPerson
    ? `${form.currency} ${Number(form.pricePerPerson).toLocaleString("en-IN")} per person`
    : null;

  return (
    <Card className="px-6 py-5">
      <Text size="xs" intent="muted" weight="medium" className="uppercase tracking-wide">
        Total Package Price
      </Text>
      <div className="flex items-baseline gap-2 mt-0.5">
        <Text as="span" size="2xl" weight="bold" intent="primary" className="font-heading tracking-tight">
          {priceStr}
        </Text>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
        <Text size="sm" intent="secondary">
          For {totalPax} traveller{totalPax !== 1 ? "s" : ""}
        </Text>
        {perPersonStr && (
          <Text size="sm" intent="secondary" weight="medium">{perPersonStr}</Text>
        )}
      </div>
      {form.infants > 0 && (
        <Text size="xs" intent="muted" className="mt-1.5 block">
          Infant charges as applicable / on request
        </Text>
      )}

      {form.paymentLink && (
        <a
          href={form.paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full mt-4 bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          Pay Now <ArrowRight size={14} />
        </a>
      )}
    </Card>
  );
}
