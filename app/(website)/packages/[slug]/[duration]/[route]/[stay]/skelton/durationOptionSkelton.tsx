import { Skeleton } from "@/app/components/skeltons/rawShimmer"
import { div } from "motion/react-client";

function DurationOptionSkelton({ count = 1 }: { count?: number }) {
    return (
        <div className="flex flex-row gap-3 overflow-x-auto py-3 px-2 pb-1 mt-1">
            {
                Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex flex-col w-24 shrink-0 rounded-[14px]">
                        <Skeleton className="w-full aspect-square object-cover rounded-[11px]" />
                        <div className="py-1.5">
                            <Skeleton className="w-full h-3.5 rounded-lg" />
                            <Skeleton className="w-full h-4.5 rounded-lg mt-1" />
                        </div>
                    </div>
                ))
            }
        </div>
    )
}

export default DurationOptionSkelton;
