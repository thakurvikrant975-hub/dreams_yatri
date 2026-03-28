import { cn } from "@/app/lib/utils";
import { SkeletonI } from "@/app/types/skelton";

export function Skeleton({ className }: SkeletonI) {
    return <div className={cn('skeleton-box block', className)} />
}