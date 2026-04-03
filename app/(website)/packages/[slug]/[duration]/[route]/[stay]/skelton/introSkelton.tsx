import { Skeleton } from "@/app/components/skeltons/rawShimmer"

function IntroSkelton() {
    return (
        <div className="w-full">
            <Skeleton className="w-full h-5 rounded-lg max-w-sm" />
            <Skeleton className="w-full h-9 rounded-lg mt-3 mb-0.5" />
            <Skeleton className="w-full h-8.5 rounded-lg mt-2" />
            <Skeleton className="w-full h-9 rounded-lg mt-4 mb-5" />
            <div className="grid grid-cols-4 grid-rows-2 gap-2 h-105 md:h-120 rounded-2xl overflow-hidden">
                <Skeleton className="col-span-2 row-span-2" />
                <Skeleton />
                <Skeleton />
                <Skeleton />
                <Skeleton />
            </div>
        </div>
    )
}

export default IntroSkelton
