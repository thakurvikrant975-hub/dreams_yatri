import type { Metadata } from "next";
import Link from "next/link";
import { Bed, ExternalLink } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { listQuickCreatedHotels } from "../catalog-actions";
import { QuickHotelRow } from "./QuickHotelRow";

export const metadata: Metadata = {
    title: "Catalog Follow-up - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * The slow half of the fill queue.
 *
 * Quick-create deliberately captures one room and one rate while somebody waits
 * on the phone, which leaves a real but thin property behind. That trade only
 * works if there is somewhere those get finished — otherwise the catalog fills
 * with stubs and the sales team stops trusting it.
 *
 * Ordered by how much use each one is already getting, so the second pass is
 * spent on the properties the business actually leans on. Anything sharing a
 * name with another hotel sorts above all of it, because a duplicate is not
 * merely incomplete — it is actively splitting rates and history across two
 * records.
 */
export default async function CatalogFollowUpPage() {
    const hotels = await listQuickCreatedHotels();
    const duplicates = hotels.filter((h) => h.duplicateOf.length > 0);
    const used = hotels.filter((h) => h.usedInDays > 0);

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/hotel-requests">Hotel Requests</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Catalog Follow-up</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Catalog Follow-up"
                description="Hotels added straight from a request — finish the ones being used most"
                icon={Bed}
            />

            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Added from requests", value: hotels.length },
                    { label: "Already sold on", value: used.length },
                    { label: "Possible duplicates", value: duplicates.length, warn: true },
                ].map((s) => (
                    <div
                        key={s.label}
                        className={`rounded-xl border p-3 ${
                            s.warn && s.value > 0
                                ? "border-amber-300 bg-amber-50"
                                : "border-dashboard-border bg-dashboard-surface"
                        }`}
                    >
                        <p className="text-2xl font-bold tabular-nums text-dashboard-text">{s.value}</p>
                        <p className="text-[11px] text-dashboard-neutral">{s.label}</p>
                    </div>
                ))}
            </div>

            {hotels.length === 0 ? (
                <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-6 text-center">
                    <p className="text-sm font-medium text-dashboard-text">Nothing to follow up yet</p>
                    <p className="text-xs text-dashboard-neutral mt-1">
                        Hotels created from a request land here so they can be finished later.{" "}
                        <Link href="/dashboard/hotel-requests" className="underline underline-offset-2">
                            Back to the request queue
                        </Link>
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {hotels.map((h) => <QuickHotelRow key={h.id} hotel={h} />)}
                </div>
            )}

            <p className="text-[11px] text-dashboard-neutral flex items-center gap-1">
                <ExternalLink className="size-3" />
                Every one of these is already usable in the package builder. None of them is on the public site.
            </p>
        </div>
    );
}
