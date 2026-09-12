import { cache } from "react";
import type { Metadata } from "next";
import { getSharedPackage, getSharedPackageBooking } from "@/app/actions/packages/fetch-shared-package";
import { getOGImage } from "@/app/lib/imageUrl";
import { ViewTracker } from "./ViewTracker";
import { PublishedItinerary } from "./components/PublishedItinerary";

// Memoized per request — generateMetadata below and the page component each
// need the same package, and without this every share-link open would run
// the full nested itineraries/tickets/add-ons query twice.
const getSharedPackageCached = cache(getSharedPackage);

// This is what a client actually sees when the link is forwarded on
// WhatsApp/iMessage/Slack before anyone taps it — a bare "dreamsyatri.in"
// preview reads as a suspicious link, so it needs a destination, duration,
// price and cover photo to look like the real, personal itinerary it is.
// Still never indexed (see robots below): this is a client's own price and
// private link, not a page meant to surface in search — WhatsApp/Facebook's
// unfurl crawlers read openGraph regardless of robots, so the two are
// independent knobs, not a contradiction.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getSharedPackageCached(id);

  if (!data) {
    return { title: "Your Itinerary", robots: { index: false, follow: false } };
  }

  const duration = `${data.totalDays}D/${data.totalNights}N`;
  const heading = data.title?.trim() || `${data.destination} Package`;
  const title = `${heading} – ${duration} | Dreams Yatri`;
  const priceLine = data.pricePerPerson && Number(data.pricePerPerson) > 0
    ? `From ₹${Math.round(Number(data.pricePerPerson)).toLocaleString("en-IN")} per person. `
    : "";
  const description = `${priceLine}Your personalised ${duration} trip to ${data.destination} — `
    + `handpicked hotels, sightseeing and transfers, curated by Dreams Yatri.`;
  // getOGImage no-ops (empty string) for a package with no cover photo yet —
  // omit the image entirely rather than let WhatsApp render a broken thumbnail.
  const ogImage = data.coverImage ? getOGImage(data.coverImage) : "";
  // Relative, resolved against whatever domain the site's own metadataBase
  // says is canonical (app/(website)/layout.tsx) — this page has no opinion
  // of its own on which domain that is.
  const canonical = `/custom-package/${id}`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Dreams Yatri",
      type: "website",
      locale: "en_IN",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: heading }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

// The client's live copy of the itinerary. What renders here is the package
// builder's own document — the same component the exec designs against and the
// same one the PDF is captured from — so the template, colours and fonts they
// chose are what the client opens. See components/PublishedItinerary.
//
// Still gated on status === "SENT" inside getSharedPackage: a draft is not
// visible to someone who merely knows the id, and a price costing hasn't
// approved never reaches this page.
export default async function CustomPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSharedPackageCached(id);
  // The client keeps this link and reopens it after paying — see
  // getSharedPackageBooking for why the page has to know.
  const booking = data ? await getSharedPackageBooking(id) : null;

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-neutral-800">This link isn&apos;t available</p>
          <p className="text-sm text-neutral-500">
            It may have expired, or the package hasn&apos;t been sent yet. Please reach out to your travel manager.
          </p>
        </div>
      </div>
    );
  }

  return (
    // No gutter and no tray. The document is 210mm of its own paper with a
    // 10mm margin already inside it; a grey surround with the sheet floating
    // in the middle is what made this look like a PDF someone embedded rather
    // than the page it is. The ground matches the document's own paper so the
    // two meet without a seam on screens wider than the page.
    <div className="min-h-screen bg-white">
      <ViewTracker packageId={id} />
      <PublishedItinerary form={data} packageId={id} booking={booking} />
    </div>
  );
}
