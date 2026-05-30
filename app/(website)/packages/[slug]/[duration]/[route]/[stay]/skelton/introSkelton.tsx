import { Skeleton } from "@/app/components/skeltons/rawShimmer"

function IntroSkelton() {
    return (
        <div className="w-full">
            {/* Breadcrumb */}
            <Skeleton className="w-full h-5 rounded-lg max-w-sm" />

            {/* Sentinel — matches the real hero's h-0 sentinel */}
            <div className="h-0" aria-hidden="true" />

            {/* Sticky info band — mirrors the real #package-info-band exactly */}
            <div
                id="package-info-band"
                className="sticky top-0 z-210 bg-white"
                style={{
                    marginLeft:  'calc(50% - 50vw)',
                    marginRight: 'calc(50% - 50vw)',
                }}
            >
                <div
                    className="mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-4"
                    style={{ maxWidth: 'var(--max-width-container, 1400px)' }}
                >
                    <Skeleton className="w-full h-9 rounded-lg mb-0.5" />
                    <Skeleton className="w-full h-8.5 rounded-lg mt-2" />
                </div>
            </div>

            {/* Inclusions row */}
            <Skeleton className="w-full h-9 rounded-lg mt-4 mb-5" />

            {/* Photo grid */}
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
