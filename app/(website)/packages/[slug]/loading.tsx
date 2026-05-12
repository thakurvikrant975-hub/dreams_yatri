import PackageTab from "./[duration]/[route]/[stay]/components/PackageTab"
import IntroSkelton from "./[duration]/[route]/[stay]/skelton/introSkelton"
import DurationOptionSkelton from "./[duration]/[route]/[stay]/skelton/durationOptionSkelton"
import RootSkelton from "./[duration]/[route]/[stay]/skelton/rootSkelton"
import StaySkelton from "./[duration]/[route]/[stay]/skelton/staySkelton"
import ItinaryHeaderSkelton from "./[duration]/[route]/[stay]/skelton/itinaryHeaderSkelton"
import PricingCardSkelton from "./[duration]/[route]/[stay]/skelton/pricingCardSkelton"
import CoupenCardSkelton from "./[duration]/[route]/[stay]/skelton/coupenCardSkelton"
import EnquiryFormSkeleton from "./[duration]/[route]/[stay]/skelton/enquiryFormSkelton"
import { Heading } from "@/app/components/ui/Typography"

function loading() {
  return (
    <div>
      <IntroSkelton />
      <PackageTab
        itinerary={
          <div className="flex flex-col gap-8">
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
            <ItinaryHeaderSkelton />
          </div>
        }
        highlights={<></>}
        policies={<></>}
        pricing={<PricingCardSkelton />}
        coupon={<CoupenCardSkelton />}
        enquiry={<EnquiryFormSkeleton />}
      />
    </div>
  )
}

export default loading;
