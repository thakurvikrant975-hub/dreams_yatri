import { Skeleton } from "@/app/components/skeltons/rawShimmer"

/**
 * Mirrors <TravelerInputBar />: a full-bleed dark bar (bg-neutral-900) holding
 * three labelled fields — "Leaving from" (wide), "Departure date", "Travellers".
 * Without this, the real input bar pops in on load and shoves the whole page
 * down. Field widths/heights match the live component so there's no shift.
 */
function Field({ labelWidth, className }: { labelWidth: string; className?: string }) {
    return (
        <div className={`flex flex-col gap-1 ${className ?? ''}`}>
            <Skeleton className={`h-2.5 ${labelWidth} rounded`} />
            <Skeleton className="h-11 w-full rounded-input" />
        </div>
    )
}

function TravelerInputBarSkelton() {
    return (
        <div className="bg-neutral-900">
            <div className="screen-space py-3 flex flex-wrap items-end gap-3">
                <Field labelWidth="w-20" className="min-w-72 flex-1 max-w-sm" />
                <Field labelWidth="w-24" className="min-w-48" />
                <Field labelWidth="w-20" className="min-w-48" />
            </div>
        </div>
    )
}

export default TravelerInputBarSkelton
