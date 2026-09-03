import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Users } from "lucide-react";
import { db } from "@/app/lib/db";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { groupPendingStayDays, stayDayLocation } from "@/app/lib/hotel-request-stay-groups";
import { getMealTypes } from "@/app/(dashboard)/dashboard/(main)/hotels/actions";
import { FillHotelForm } from "./FillHotelForm";
import { RejectAllButton } from "./RejectAllButton";

export const metadata: Metadata = {
    title: "Fill Hotel Request - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function HotelRequestDetailPage({ params }: { params: Promise<{ packageId: string }> }) {
    const { packageId } = await params;

    const [pkg, mealTypes] = await Promise.all([
        db.custom_packages.findUnique({
            where: { id: packageId },
            select: {
                id: true, title: true, destination: true, travelDate: true,
                totalDays: true, adults: true, children: true, infants: true,
                builtByName: true,
                query: { select: { name: true, phone: true } },
                stops: { orderBy: { sortOrder: "asc" }, select: { name: true, nights: true } },
                itineraries: {
                    orderBy: { day: "asc" },
                    select: {
                        day: true, hotelPending: true, hotelPendingNote: true, accommodationLocation: true,
                        hotelRequestType: true, roomsCount: true, manualExtraBeds: true, hotelMealPlan: true,
                        hotelRejectedAt: true, hotelRejectedByName: true, hotelRejectionNote: true,
                    },
                },
            },
        }),
        getMealTypes(),
    ]);

    if (!pkg) notFound();

    const dayLocations = deriveDayLocations(pkg.stops, pkg.totalDays);
    // hotelPending alone isn't enough — it stays true after a reject (see the
    // field's doc comment in schema.prisma), so a rejected day is no longer
    // something the hotel team can act on and must not keep this page (or the
    // Reject All button, or the "done" state below) thinking it's still open.
    const pendingDays = pkg.itineraries.filter((it) => it.hotelPending && !it.hotelRejectedAt);
    const paxLabel = `${pkg.adults} Adult${pkg.adults !== 1 ? "s" : ""}${pkg.children ? `, ${pkg.children} Child${pkg.children !== 1 ? "ren" : ""}` : ""}`;

    const locationOf = (it: (typeof pendingDays)[number]) => stayDayLocation(it, dayLocations);
    // One stay, one form — see groupPendingStayDays for why a gap in the days
    // always splits a group even when the request is word-for-word identical.
    const stayGroups = groupPendingStayDays(pendingDays, dayLocations);

    return (
        <div className="space-y-5 max-w-3xl">
            <Link href="/dashboard/hotel-requests-v2" className="inline-flex items-center gap-1 text-sm text-dashboard-neutral hover:text-dashboard-primary transition-colors">
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
                    {pendingDays.length > 1 && (
                        <div className="flex justify-end">
                            <RejectAllButton packageId={pkg.id} pendingCount={pendingDays.length} />
                        </div>
                    )}
                    {stayGroups.map((group) => {
                        const it = group[0];
                        const location = locationOf(it);
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
                                dayDateISO={dayDate ? dayDate.toISOString().slice(0, 10) : null}
                                siblingDays={pendingDays
                                    .filter((o) => o.day !== it.day)
                                    .map((o) => ({ day: o.day, location: locationOf(o) }))}
                                // Ticked on arrival rather than guessed at in
                                // the browser: the grouping above already
                                // decided these nights are one stay, and it can
                                // see the whole request to do it.
                                groupDays={group.slice(1).map((o) => o.day)}
                                paxLabel={paxLabel}
                                note={it.hotelPendingNote}
                                requestedType={it.hotelRequestType}
                                requestedRooms={it.roomsCount}
                                requestedMattresses={it.manualExtraBeds}
                                requestedMealPlan={it.hotelMealPlan}
                                mealTypes={mealTypes}
                                rejectedAt={it.hotelRejectedAt}
                                rejectedByName={it.hotelRejectedByName}
                                rejectionNote={it.hotelRejectionNote}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
