import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";

export default function PackagesLoading() {
    return (
        <>
            <Header />

            {/* Search bar skeleton */}
            <div className="bg-neutral-900">
                <div className="screen-space py-3 flex flex-wrap gap-2.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-[42px] flex-1 min-w-40 rounded-lg bg-white/10" />
                    ))}
                    <div className="h-[42px] w-28 rounded-lg bg-white/15" />
                </div>
            </div>

            <div className="screen-space py-8">
                <div className="skeleton-box h-8 w-72 rounded-lg mb-2" />
                <div className="skeleton-box h-4 w-56 rounded mb-7" />
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

            <Footer />
        </>
    );
}
