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
  // The flag, never a position. getSharedPackage drops options with no hotel
  // on any night, so the recommended one can be missing from this list — and
  // falling back to options[0] then declared a NON-recommended option to be
  // the recommended one. This page would price it at the package total while
  // the service, reading isRecommended from the row, charged the option's own
  // price. Two different numbers for one click.
  //
  // With the flag alone, a filtered-out recommendation simply means no option
  // here is the recommended one, and every option is priced at its own figure
  // — which is exactly what the service does with the same input.
  const recommendedId = options.find((o) => o.isRecommended)?.id ?? null;
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
    days: data.totalDays,
    travellers: data.adults + data.children,
    // The cover's lockup is addressed to a person — see the hero on the
    // itinerary this page came from.
    clientName: data.clientName || null,
    // As entered, not as classified: this is the client's own description of
    // who is travelling, and it is what the itinerary's own stats card shows.
    paxLine: [
      `${data.adults} Adult${data.adults !== 1 ? "s" : ""}`,
      data.children > 0 ? `${data.children} Child${data.children !== 1 ? "ren" : ""}` : null,
      data.infants > 0 ? `${data.infants} Infant${data.infants !== 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(", "),
    currency: data.currency,
    total,
    optionId: chosen?.id ?? null,
    // Named only when there was a choice to make.
    optionLabel: options.length > 1
      ? (chosen ?? options.find((o) => o.id === recommendedId))?.label ?? null
      : null,
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
