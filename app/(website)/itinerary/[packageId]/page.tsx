import type { Metadata } from "next";
import { getSharedPackage } from "@/app/actions/packages/fetch-shared-package";
import { ItineraryDocument } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[queryId]/ItineraryDocument";
import { ViewTracker } from "./ViewTracker";

export const metadata: Metadata = {
  title: "Your Itinerary | DreamsYatri",
  robots: { index: false, follow: false },
};

export default async function SharedItineraryPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  const data = await getSharedPackage(packageId);

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
    <div className="min-h-screen bg-neutral-100 py-6 px-3">
      <ViewTracker packageId={packageId} />
      <ItineraryDocument form={data} />
    </div>
  );
}
