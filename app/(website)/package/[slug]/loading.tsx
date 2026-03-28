import DurationOptionSkelton from "./[duration]/[route]/[stay]/skelton/durationOptionSkelton"
import IntroSkelton from "./[duration]/[route]/[stay]/skelton/introSkelton"
import PackageTab from "./[duration]/[route]/[stay]/components/PackageTab"
import RootSkelton from "./[duration]/[route]/[stay]/skelton/rootSkelton"
import StaySkelton from "./[duration]/[route]/[stay]/skelton/staySkelton"
import { Heading } from "@/app/components/ui/Typography"
import ItinaryHeaderSkelton from "./[duration]/[route]/[stay]/skelton/itinaryHeaderSkelton"
import PricingCardSkelton from "./[duration]/[route]/[stay]/skelton/pricingCardSkelton"
import CoupenCardSkelton from "./[duration]/[route]/[stay]/skelton/coupenCardSkelton"
import EnquiryFormSkeleton from "./[duration]/[route]/[stay]/skelton/enquiryFormSkelton"

function loading() {
  return (
    <div>
      <IntroSkelton />
      <div className="flex gap-10 py-section-sm">
        <div className="flex-1">
          <div className="pointer-events-none">
            <PackageTab slug='dummy' duration='dummy' route='dummy' stay='dummy' />
          </div>

          <div className="py-6 flex flex-col gap-8">
            <div>
              <Heading level={3} weight='semibold'>Choose Trip Duration</Heading>
              <DurationOptionSkelton count={4} />
            </div>
            <div>
              <Heading level={3} weight='semibold'>Destination Routes</Heading>
              <RootSkelton count={2} />
            </div>
            <div>
              <Heading level={3} weight='semibold'>Stay Category</Heading>
              <StaySkelton count={3} />
            </div>
            <div>

              <div className="bg-white rounded-2xl ring-1 ring-(--border-default)">
                <ItinaryHeaderSkelton />
              </div>

            </div>
          </div>
        </div>
        <div className="sticky top-(--header-height) w-[27%]">
          <div className="flex flex-col gap-3">
            <PricingCardSkelton />
            <CoupenCardSkelton />
            <EnquiryFormSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

export default loading;
