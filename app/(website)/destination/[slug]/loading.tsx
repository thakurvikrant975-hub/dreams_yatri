function DestinationLoading() {
    return (
        <>
            {/* Cover hero skeleton */}
            <div className="skeleton-box w-full h-64 sm:h-80 lg:h-96" />

            <div className="screen-space pt-8 pb-12">
                {/* Package grid skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden border border-neutral-100">
                            <div className="skeleton-box aspect-3/2 w-full" />
                            <div className="p-4 space-y-3">
                                <div className="skeleton-box h-5 w-3/4 rounded" />
                                <div className="skeleton-box h-4 w-1/2 rounded" />
                                <div className="skeleton-box h-8 w-full rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

export default DestinationLoading;
