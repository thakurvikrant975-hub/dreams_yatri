import { Skeleton } from "@/app/components/skeltons/rawShimmer"

function rootSkelton({ count = 1 }: { count: number }) {
    return (
        <div className="flex flex-col gap-2 mt-1">
            {
                Array.from({ length: count }).map((_, i) =>
                    <div key={i} className="py-0.5">
                        <Skeleton key={i} className="w-full h-11 rounded-2xl" />
                    </div>
                )

            }
        </div>
    )
}

export default rootSkelton
