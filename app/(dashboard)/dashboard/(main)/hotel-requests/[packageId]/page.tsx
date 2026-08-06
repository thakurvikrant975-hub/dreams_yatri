import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Users } from "lucide-react";
import { db } from "@/app/lib/db";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { FillHotelForm } from "./FillHotelForm";

export const metadata: Metadata = {
    title: "Fill Hotel Request - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function HotelRequestDetailPage({ params }: { params: Promise<{ packageId: string }> }) {
    const { packageId } = await params;

    const pkg = await db.custom_packages.findUnique({
        where: { id: packageId },
        select: {
            id: true, title: true, destination: true, travelDate: true,
            totalDays: true, adults: true, children: true, infants: true,
            builtByName: true,
            query: { select: { name: true, phone: true } },
            stops: { orderBy: { sortOrder: "asc" }, select: { name: true, nights: true } },
            itineraries: {
                orderBy: { day: "asc" },
                select: { day: true, hotelPending: true, hotelPendingNote: true, accommodationLocation: true },
            },
        },
    });

    if (!pkg) notFound();

    const dayLocations = deriveDayLocations(pkg.stops, pkg.totalDays);
    const pendingDays = pkg.itineraries.filter((it) => it.hotelPending);
    const paxLabel = `${pkg.adults} Adult${pkg.adults !== 1 ? "s" : ""}${pkg.children ? `, ${pkg.children} Child${pkg.children !== 1 ? "ren" : ""}` : ""}`;

    return (
        <div className="space-y-5 max-w-3xl">
            <Link href="/dashboard/hotel-requests" className="inline-flex items-center gap-1 text-sm text-dashboard-neutral hover:text-dashboard-primary transition-colors">
                <ArrowLeft className="size-3.5" /> Back to Hotel Requests
            </Link>

            <div>
                <h1 className="text-xl font-semibold text-dashboard-base-content">{pkg.title}</h1>
                <p className="text-sm text-dashboard-neutral mt-0.5 flex items-center gap-1.5">
                    {pkg.destination}
                    {pkg.query?.name && <span>· {pkg.query.name}{pkg.query.phone ? ` (${pkg.query.phone})` : ""}</span>}
                </p>
                <p className="text-xs text-dashboard-neutral mt-1 flex items-center gap-1">
                    <Users className="size-3" /> {paxLabel}
                    {pkg.builtByName && <span>· Requested by {pkg.builtByName}</span>}
                </p>
            </div>

            {pendingDays.length === 0 ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-center gap-2 text-emerald-800 text-sm font-medium">
                    <CheckCircle2 className="size-4 shrink-0" /> No pending hotel requests for this package — every day is filled.
                </div>
            ) : (
                <div className="space-y-3">
                    {pendingDays.map((it) => {
                        const location = it.accommodationLocation || dayLocations[it.day - 1] || null;
                        const dayDate = pkg.travelDate
                            ? new Date(new Date(pkg.travelDate).getTime() + (it.day - 1) * 24 * 60 * 60 * 1000)
                            : null;
                        const dateLabel = dayDate
                            ? dayDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : null;
                        return (
                            <FillHotelForm
                                key={it.day}
                                packageId={pkg.id}
                                day={it.day}
                                location={location}
                                dateLabel={dateLabel}
                                paxLabel={paxLabel}
                                note={it.hotelPendingNote}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
