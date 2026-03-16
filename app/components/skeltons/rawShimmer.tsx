import { cn } from "@/app/lib/utils";
import { SkeletonI } from "@/app/types/skelton";

export function Skeleton({ className }: SkeletonI) {
    return <span className={cn('skeleton-box block', className)} />
}