"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { Text } from "@/app/components/ui/Typography";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[queryId]/ItineraryDocument";
import { useBookCustomPackage } from "./useBookCustomPackage";

/** Mirrors the catalog page's MobileFooterBar — fixed bottom bar, mobile
 * only, showing the locked total + a real Book Now (see useBookCustomPackage)
 * instead of a manual payment link. */
export function CustomMobileFooterBar({ form, packageId }: { form: PreviewData; packageId: string }) {
  const priceStr = form.totalPrice ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}` : "To be confirmed";
  const { handleBookNow, submitting } = useBookCustomPackage(packageId);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-300 lg:hidden bg-white border-t border-neutral-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex flex-col min-w-0">
        <Text as="span" size="lg" weight="bold" intent="primary" className="font-heading tracking-tight truncate">
          {priceStr}
        </Text>
        <Text as="span" size="xs" intent="muted">Total package price</Text>
      </div>
      {form.totalPrice ? (
        <button
          type="button"
          onClick={handleBookNow}
          disabled={submitting}
          className="flex items-center gap-1.5 shrink-0 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <>Book Now <ArrowRight size={14} /></>}
        </button>
      ) : null}
    </div>
  );
}
