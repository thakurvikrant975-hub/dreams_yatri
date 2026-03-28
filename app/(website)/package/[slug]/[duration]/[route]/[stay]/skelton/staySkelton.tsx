import { Skeleton } from "@/app/components/skeltons/rawShimmer"

function StaySkelton({ count = 1 }: { count: number }) {
  return (
    <div className="flex flex-row gap-2.5 mt-1">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="w-38 h-8.5 rounded-pill" />
      ))}
    </div>
  )
}

export default StaySkelton
