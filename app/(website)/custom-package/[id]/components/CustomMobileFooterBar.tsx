import { ArrowRight } from "lucide-react";
import { Text } from "@/app/components/ui/Typography";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[queryId]/ItineraryDocument";

/** Mirrors the catalog page's MobileFooterBar — fixed bottom bar, mobile
 * only, showing the locked total + Pay Now instead of a live per-adult price
 * + "Book this package". */
export function CustomMobileFooterBar({ form }: { form: PreviewData }) {
  const priceStr = form.totalPrice ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}` : "To be confirmed";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-300 lg:hidden bg-white border-t border-neutral-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex flex-col min-w-0">
        <Text as="span" size="lg" weight="bold" intent="primary" className="font-heading tracking-tight truncate">
          {priceStr}
        </Text>
        <Text as="span" size="xs" intent="muted">Total package price</Text>
      </div>
      {form.paymentLink ? (
        <a
          href={form.paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 shrink-0 bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          Pay Now <ArrowRight size={14} />
        </a>
      ) : null}
    </div>
  );
}
