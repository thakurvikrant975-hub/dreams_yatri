import IntroSkelton from "./[duration]/[route]/[stay]/skelton/introSkelton"
import DurationOptionSkelton from "./[duration]/[route]/[stay]/skelton/durationOptionSkelton"
import RootSkelton from "./[duration]/[route]/[stay]/skelton/rootSkelton"
import StaySkelton from "./[duration]/[route]/[stay]/skelton/staySkelton"
import ItinaryHeaderSkelton from "./[duration]/[route]/[stay]/skelton/itinaryHeaderSkelton"
import PricingCardSkelton from "./[duration]/[route]/[stay]/skelton/pricingCardSkelton"
import EnquiryFormSkeleton from "./[duration]/[route]/[stay]/skelton/enquiryFormSkelton"
import { Heading } from "@/app/components/ui/Typography"
import { Skeleton } from "@/app/components/skeltons/rawShimmer"

function loading() {
  return (
    <div className="screen-space pt-6 pb-10">
      <IntroSkelton />

      {/* Tab bar skeleton — plain in-flow row, no sticky */}
      <div
        className="border-b border-(--border-muted) mt-4"
        style={{
          marginLeft:  'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
        }}
      >
        <div
          className="mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 py-1"
          style={{ maxWidth: 'var(--max-width-container, 1400px)' }}
        >
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-10 py-section-sm">

        {/* Main content */}
        <div className="flex-1 min-w-0 py-2 pb-20 lg:pb-2">
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
        </div>

        {/* Sidebar — desktop only */}
        <aside className="hidden lg:flex w-[27%] flex-col gap-3">
          <PricingCardSkelton />
          <EnquiryFormSkeleton />
        </aside>

      </div>
    </div>
  )
}

export default loading;
