import type { Metadata } from "next";
import { getSharedPackage } from "@/app/actions/packages/fetch-shared-package";
import { ViewTracker } from "./ViewTracker";
import { PublishedItinerary } from "./components/PublishedItinerary";

export const metadata: Metadata = {
  title: "Your Itinerary",
  robots: { index: false, follow: false },
};

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
  const data = await getSharedPackage(id);

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
      <PublishedItinerary form={data} packageId={id} />
    </div>
  );
}
