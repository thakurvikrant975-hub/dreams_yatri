// The review step for a custom package, between the itinerary and payment.
//
// Server-side on purpose: the amount payable now is computed by the same
// engine that will charge it, against the same price, rather than restated in
// the browser. A client-side copy of the deposit rule would be right until
// someone changed the policy, and then wrong on the page where a client is
// deciding how much to hand over.

import { notFound } from "next/navigation";
import { getSharedPackage } from "@/app/actions/packages/fetch-shared-package";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";
import { BookCustomPackage, type BookSummary } from "./BookCustomPackage";

export const metadata = { title: "Review your booking" };

export default async function BookCustomPackagePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ option?: string }>;
}) {
  const { id } = await params;
  const { option } = await searchParams;
  const data = await getSharedPackage(id);
  // Same gate as the itinerary itself — getSharedPackage returns nothing for a
  // package that has not been sent, so a link cannot be guessed into.
  if (!data) notFound();

  // Which price is being bought. A non-recommended option is charged at its
  // own figure; the recommended one uses the package's, which is what every
  // other part of the system treats as the quote. Identical to the rule in
  // createBookingFromCustomPackage — the page must not offer a number the
  // service would then disagree with.
  const options = data.stayOptions ?? [];
  const recommendedId = (options.find((o) => o.isRecommended) ?? options[0])?.id ?? null;
  const chosen = option ? options.find((o) => o.id === option) ?? null : null;
  const useOptionPrice = chosen != null && chosen.id !== recommendedId && (chosen.totalPrice ?? 0) > 0;

  const total = useOptionPrice ? chosen!.totalPrice! : Number(data.totalPrice || 0);
  if (!total || total <= 0 || !data.travelDate) notFound();

  const schedule = computePaymentSchedule({
    totalPaise: Math.round(total * 100),
    travelDate: data.travelDate,
  });

  const summary: BookSummary = {
    packageId: id,
    title: data.title,
    destination: data.destination || null,
    coverImage: data.coverImage || null,
    travelDate: data.travelDate || null,
    nights: data.totalNights,
    travellers: data.adults + data.children,
    currency: data.currency,
    total,
    optionId: chosen?.id ?? null,
    // Named only when there was a choice to make.
    optionLabel: options.length > 1 ? (chosen ?? options.find((o) => o.id === recommendedId))?.label ?? null : null,
    // The package's discount describes the package's own total, so it is not
    // shown against a different option's price.
    discount: useOptionPrice ? null : data.discount ?? null,
    depositAmount: Math.round(schedule.depositPaise / 100),
    balanceAmount: Math.round(schedule.balancePaise / 100),
    balanceDueDate: schedule.balanceDueDate,
    mustPayFull: schedule.plan === "FULL",
  };

  return <BookCustomPackage summary={summary} />;
}
