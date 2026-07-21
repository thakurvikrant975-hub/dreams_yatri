import type { Metadata } from "next";
import { getSharedPackage } from "@/app/actions/packages/fetch-shared-package";
import PackagePolicy from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/policy/policy";
import { ViewTracker } from "./ViewTracker";
import { CustomPackageHero } from "./components/CustomPackageHero";
import { ClientDetailsStrip } from "./components/ClientDetailsStrip";
import { CustomPackageTabs } from "./components/CustomPackageTabs";
import { CustomPricingCard } from "./components/CustomPricingCard";
import { CustomMobileFooterBar } from "./components/CustomMobileFooterBar";
import { CustomItinerarySection } from "./components/CustomItinerarySection";
import { CustomHighlightsTab } from "./components/CustomHighlightsTab";

export const metadata: Metadata = {
  title: "Your Itinerary",
  robots: { index: false, follow: false },
};

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
    <div className="screen-space pt-6 pb-10">
      <ViewTracker packageId={id} />
      <CustomPackageHero form={data} />
      <ClientDetailsStrip form={data} />
      <CustomPackageTabs
        pricing={<CustomPricingCard form={data} packageId={id} />}
        itinerary={<CustomItinerarySection form={data} />}
        highlights={<CustomHighlightsTab form={data} />}
        policies={<PackagePolicy />}
        mobileFooter={<CustomMobileFooterBar form={data} packageId={id} />}
      />
    </div>
  );
}
